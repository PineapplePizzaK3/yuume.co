import { createClient } from '@supabase/supabase-js'
import { ensureInvoiceForPaidOrder } from '../server-lib/invoiceGenerator.js'

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseMoneyAmount(value, { assumeCents = false } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  if (assumeCents && Number.isInteger(n) && n >= 100) return Number((n / 100).toFixed(2))
  return Number(n.toFixed(2))
}

function extractEvent(payload) {
  return String(
    payload?.event
      || payload?.event_name
      || payload?.type
      || payload?.name
      || payload?.data?.event
      || ''
  ).trim().toLowerCase()
}

function extractOrderData(payload) {
  if (payload?.order && typeof payload.order === 'object') return payload.order
  if (payload?.data?.order && typeof payload.data.order === 'object') return payload.data.order
  if (payload?.data && typeof payload.data === 'object') return payload.data
  return payload
}

function extractOrderId(payload, orderData) {
  const value = orderData?.order_id
    ?? orderData?.id
    ?? orderData?.partner_reference
    ?? orderData?.partnerReference
    ?? orderData?.reference
    ?? payload?.order_id
    ?? payload?.id
    ?? payload?.partner_reference
    ?? payload?.partnerReference
    ?? payload?.reference
    ?? payload?.data?.order_id
    ?? payload?.data?.partner_reference
    ?? payload?.data?.partnerReference
    ?? payload?.data?.reference
  if (value == null) return null
  const normalized = String(value).trim()
  const uuidMatch = normalized.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  return uuidMatch ? uuidMatch[0] : normalized
}

function isPaidEvent(eventName, payload, orderData) {
  if (eventName === 'event_order_paid') return true
  const statusText = String(
    orderData?.status_text
      || payload?.status_text
      || payload?.status
      || ''
  ).trim().toLowerCase()
  return ['paid', 'approved', 'confirmed', 'pago'].includes(statusText)
}

function isWebhookAuthorized(req) {
  const expected = String(process.env.PARCELOW_WEBHOOK_SECRET || '').trim()
  if (!expected) return true
  const headerSecret = String(
    req.headers['x-parcelow-webhook-secret']
      || req.headers['x-webhook-secret']
      || ''
  ).trim()
  if (headerSecret && headerSecret === expected) return true
  const authHeader = String(req.headers.authorization || '').trim()
  if (authHeader.toLowerCase() === `bearer ${expected.toLowerCase()}`) return true
  return false
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isWebhookAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized webhook' })
  }

  let rawBody
  try {
    rawBody = await getRawBody(req)
  } catch {
    rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
  }
  const payload = parseJsonSafe(rawBody) || {}
  const eventName = extractEvent(payload)
  const orderData = extractOrderData(payload)
  const orderId = extractOrderId(payload, orderData)

  if (!orderId) return res.status(200).json({ received: true })
  if (!isPaidEvent(eventName, payload, orderData)) {
    return res.status(200).json({ received: true })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(200).json({ received: true })

  const externalId = String(
    orderData?.payment_id
      || orderData?.transaction_id
      || payload?.payment_id
      || payload?.transaction_id
      || orderData?.id
      || orderId
  ).trim()
  const paymentId = `parcelow_${externalId}`
  const currencyRaw = String(
    orderData?.currency
      ?? payload?.currency
      ?? orderData?.amount_currency
      ?? ''
  )
    .trim()
    .toUpperCase()
  const isUsd = currencyRaw === 'USD'
  const hasUsdField =
    orderData?.total_usd != null
    || orderData?.amount_usd != null
    || payload?.total_usd != null
    || payload?.amount_usd != null
  const payCurrency = isUsd || hasUsdField ? 'USD' : 'BRL'
  const amount = parseMoneyAmount(
    payCurrency === 'USD'
      ? orderData?.total_usd
        ?? payload?.total_usd
        ?? orderData?.amount_usd
        ?? payload?.amount_usd
        ?? orderData?.amount
        ?? payload?.amount
      : orderData?.total_brl
        ?? payload?.total_brl
        ?? orderData?.amount
        ?? payload?.amount,
    { assumeCents: true }
  )
  // Tentativa de conciliação de recarga de carteira via Parcelow.
  const { data: topupReq } = await supabase
    .from('wallet_topup_requests')
    .select('id, user_id, amount_jpy, status')
    .eq('id', orderId)
    .maybeSingle()
  if (topupReq && topupReq.status === 'pending') {
    const paymentAlreadyRecorded = await supabase
      .from('payments')
      .select('id')
      .eq('stripe_payment_id', paymentId)
      .limit(1)
    const existingRows = paymentAlreadyRecorded?.data || []
    if (!existingRows.length) {
      await supabase.from('payments').insert({
        order_id: null,
        stripe_payment_id: paymentId,
        status: 'completed',
        amount: amount ?? null,
        currency: payCurrency,
      })
    }
    await supabase.rpc('wallet_credit', {
      p_user_id: topupReq.user_id,
      p_amount: Number(topupReq.amount_jpy),
      p_type: 'topup',
      p_description: `Recarga Parcelow - solicitação ${String(orderId).slice(0, 8)}`,
      p_reference_type: 'wallet_topup',
      p_reference_id: topupReq.id,
    })
    await supabase
      .from('wallet_topup_requests')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('id', topupReq.id)
      .eq('status', 'pending')
    return res.status(200).json({ received: true, flow: 'wallet_topup' })
  }

  let resolvedOrderId = orderId
  let finalizedFromIntent = false

  let { data: order } = await supabase
    .from('orders')
    .select('id, order_source, ship_immediately, status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) {
    const { data: realOid, error: finErr } = await supabase.rpc(
      'service_finalize_store_checkout_intent_as_paid',
      { p_intent_id: orderId }
    )
    if (finErr || !realOid) {
      return res.status(200).json({ received: true })
    }
    resolvedOrderId = realOid
    finalizedFromIntent = true
    const { data: order2 } = await supabase
      .from('orders')
      .select('id, order_source, ship_immediately, status')
      .eq('id', resolvedOrderId)
      .maybeSingle()
    order = order2
    if (!order) return res.status(200).json({ received: true })
  }

  const { data: existingCompleted } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', resolvedOrderId)
    .eq('status', 'completed')
    .eq('stripe_payment_id', paymentId)
    .limit(1)

  if (!existingCompleted || existingCompleted.length === 0) {
    const { data: pendingRows } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', resolvedOrderId)
      .eq('status', 'pending')
      .like('stripe_payment_id', 'parcelow_order_%')
      .order('created_at', { ascending: true })
      .limit(1)

    if (pendingRows && pendingRows.length > 0) {
      await supabase
        .from('payments')
        .update({
          stripe_payment_id: paymentId,
          status: 'completed',
          amount: amount ?? undefined,
          currency: payCurrency,
        })
        .eq('id', pendingRows[0].id)
    } else {
      await supabase.from('payments').insert({
        order_id: resolvedOrderId,
        stripe_payment_id: paymentId,
        status: 'completed',
        amount: amount ?? null,
        currency: payCurrency,
      })
    }
  }

  if (finalizedFromIntent) {
    if (order.status === 'paid' || order.status === 'products_paid') {
      await ensureInvoiceForPaidOrder(supabase, resolvedOrderId).catch((e) =>
        console.error('ensureInvoice (parcelow webhook intent):', e?.message || e)
      )
    }
    return res.status(200).json({ received: true })
  }

  const newStatus = order.order_source === 'store' && order.ship_immediately
    ? 'products_paid'
    : 'paid'
  const { error: updateOrderError } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', resolvedOrderId)
    .eq('status', 'awaiting_payment')
  if (updateOrderError) {
    console.error('Parcelow webhook: failed to update order status:', updateOrderError)
  }

  if (order.order_source === 'store' && !order.ship_immediately && !updateOrderError) {
    const { error: invErr } = await supabase.rpc('store_order_add_to_inventory', {
      p_order_id: resolvedOrderId,
    })
    if (invErr) console.error('Parcelow webhook: inventory update failed:', invErr)
  }

  if (!updateOrderError && (newStatus === 'paid' || newStatus === 'products_paid')) {
    await ensureInvoiceForPaidOrder(supabase, resolvedOrderId).catch((e) =>
      console.error('ensureInvoice (parcelow webhook):', e?.message || e)
    )
  }

  return res.status(200).json({ received: true })
}

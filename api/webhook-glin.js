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

function isWebhookAuthorized(req) {
  const expected = String(process.env.GLIN_WEBHOOK_SECRET || '').trim()
  if (!expected) return true
  const headerSecret = String(
    req.headers['x-glin-webhook-secret']
      || req.headers['x-glin-signature']
      || req.headers['x-webhook-secret']
      || ''
  ).trim()
  if (headerSecret && headerSecret === expected) return true
  const authHeader = String(req.headers.authorization || '').trim()
  if (authHeader.toLowerCase() === `bearer ${expected.toLowerCase()}`) return true
  return false
}

function extractEvent(payload) {
  return String(
    payload?.event
      || payload?.event_name
      || payload?.type
      || payload?.name
      || payload?.data?.event
      || payload?.data?.type
      || ''
  ).trim().toLowerCase()
}

function extractOrderData(payload) {
  if (payload?.remittance && typeof payload.remittance === 'object') return payload.remittance
  if (payload?.payment && typeof payload.payment === 'object') return payload.payment
  if (payload?.order && typeof payload.order === 'object') return payload.order
  if (payload?.data && typeof payload.data === 'object') return payload.data
  return payload
}

function extractOrderId(payload, orderData) {
  const value = orderData?.externalReference
    ?? orderData?.external_reference
    ?? orderData?.partner_reference
    ?? orderData?.reference
    ?? orderData?.order_id
    ?? payload?.externalReference
    ?? payload?.external_reference
    ?? payload?.partner_reference
    ?? payload?.reference
    ?? payload?.order_id
    ?? payload?.data?.externalReference
    ?? payload?.data?.external_reference
    ?? payload?.data?.order_id
  if (value == null) return null
  const normalized = String(value).trim()
  const uuidMatch = normalized.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  return uuidMatch ? uuidMatch[0] : normalized
}

function isPaidEvent(eventName, payload, orderData) {
  if (
    eventName.includes('paid')
    || eventName.includes('approved')
    || eventName.includes('captured')
    || eventName.includes('succeeded')
  ) {
    return true
  }
  const statusText = String(
    orderData?.status
      || orderData?.status_text
      || orderData?.payment_status
      || payload?.status
      || payload?.status_text
      || ''
  ).trim().toLowerCase()
  return ['paid', 'approved', 'confirmed', 'succeeded', 'captured', 'pago'].includes(statusText)
}

function buildPaymentId(payload, orderData, orderId) {
  const externalId = String(
    orderData?.payment_id
      || orderData?.transaction_id
      || orderData?.id
      || payload?.payment_id
      || payload?.transaction_id
      || payload?.id
      || orderId
  ).trim()
  return `glin_${externalId}`
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

  const paymentId = buildPaymentId(payload, orderData, orderId)
  const payCurrency = String(
    orderData?.currency
      || payload?.currency
      || orderData?.amount_currency
      || 'USD'
  ).trim().toUpperCase() || 'USD'
  const amount = parseMoneyAmount(
    orderData?.amount
      ?? payload?.amount
      ?? orderData?.amount_total
      ?? payload?.amount_total
      ?? orderData?.amount_cents
      ?? payload?.amount_cents,
    { assumeCents: true }
  )

  const { data: topupReq } = await supabase
    .from('wallet_topup_requests')
    .select('id, user_id, amount_jpy, status')
    .eq('id', orderId)
    .maybeSingle()

  if (topupReq) {
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('stripe_payment_id', paymentId)
      .limit(1)
    if (!existingPayment?.length) {
      await supabase.from('payments').insert({
        order_id: null,
        stripe_payment_id: paymentId,
        status: 'completed',
        amount: amount ?? null,
        currency: payCurrency,
      })
    }
    const { data: updatedTopup } = await supabase
      .from('wallet_topup_requests')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('id', topupReq.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    // Credita somente quando a transição pending->completed aconteceu neste webhook.
    if (updatedTopup?.id) {
      await supabase.rpc('wallet_credit', {
        p_user_id: topupReq.user_id,
        p_amount: Number(topupReq.amount_jpy),
        p_type: 'topup',
        p_description: `Recarga Glin - solicitação ${String(orderId).slice(0, 8)}`,
        p_reference_type: 'wallet_topup',
        p_reference_id: topupReq.id,
      })
    }
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

  if (!existingCompleted?.length) {
    await supabase.from('payments').insert({
      order_id: resolvedOrderId,
      stripe_payment_id: paymentId,
      status: 'completed',
      amount: amount ?? null,
      currency: payCurrency,
    })
  }

  if (finalizedFromIntent) {
    if (order.status === 'paid' || order.status === 'products_paid') {
      await ensureInvoiceForPaidOrder(supabase, resolvedOrderId).catch((e) =>
        console.error('ensureInvoice (glin webhook intent):', e?.message || e)
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
    console.error('Glin webhook: failed to update order status:', updateOrderError)
  }

  if (order.order_source === 'store' && !order.ship_immediately && !updateOrderError) {
    const { error: invErr } = await supabase.rpc('store_order_add_to_inventory', {
      p_order_id: resolvedOrderId,
    })
    if (invErr) console.error('Glin webhook: inventory update failed:', invErr)
  }

  if (!updateOrderError && (newStatus === 'paid' || newStatus === 'products_paid')) {
    await ensureInvoiceForPaidOrder(supabase, resolvedOrderId).catch((e) =>
      console.error('ensureInvoice (glin webhook):', e?.message || e)
    )
  }

  return res.status(200).json({ received: true })
}

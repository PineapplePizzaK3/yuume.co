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
    ?? payload?.order_id
    ?? payload?.id
    ?? payload?.data?.order_id
  if (value == null) return null
  return String(value).trim()
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

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_source, ship_immediately, status')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return res.status(200).json({ received: true })

  const { data: existingCompleted } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'completed')
    .eq('stripe_payment_id', paymentId)
    .limit(1)

  if (!existingCompleted || existingCompleted.length === 0) {
    const { data: pendingRows } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', orderId)
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
        order_id: orderId,
        stripe_payment_id: paymentId,
        status: 'completed',
        amount: amount ?? null,
        currency: payCurrency,
      })
    }
  }

  const newStatus = order.order_source === 'store' && order.ship_immediately
    ? 'products_paid'
    : 'paid'
  const { error: updateOrderError } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)
    .eq('status', 'awaiting_payment')
  if (updateOrderError) {
    console.error('Parcelow webhook: failed to update order status:', updateOrderError)
  }

  if (order.order_source === 'store' && !order.ship_immediately && !updateOrderError) {
    const { error: invErr } = await supabase.rpc('store_order_add_to_inventory', {
      p_order_id: orderId,
    })
    if (invErr) console.error('Parcelow webhook: inventory update failed:', invErr)
  }

  if (!updateOrderError && (newStatus === 'paid' || newStatus === 'products_paid')) {
    await ensureInvoiceForPaidOrder(supabase, orderId).catch((e) =>
      console.error('ensureInvoice (parcelow webhook):', e?.message || e)
    )
  }

  return res.status(200).json({ received: true })
}

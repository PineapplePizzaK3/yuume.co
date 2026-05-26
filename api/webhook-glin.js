import { createClient } from '@supabase/supabase-js'
import { createPublicKey, createVerify } from 'node:crypto'
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

const jwksCache = globalThis.__glinJwksCache ?? { keys: null, expiresAt: 0 }
globalThis.__glinJwksCache = jwksCache

function decodeBase64UrlToBuffer(input) {
  const s = String(input || '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s + pad, 'base64')
}

function decodeBase64UrlToJson(input) {
  try {
    return JSON.parse(decodeBase64UrlToBuffer(input).toString('utf8'))
  } catch {
    return null
  }
}

async function getGlinJwks() {
  const now = Date.now()
  if (jwksCache.keys && jwksCache.expiresAt > now) return jwksCache.keys
  const url = String(process.env.GLIN_JWKS_URL || 'https://pay.glin.com.br/merchant-api/jwks.json').trim()
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`Falha ao baixar JWKS da Glin (HTTP ${res.status})`)
  }
  const json = await res.json().catch(() => null)
  const keys = Array.isArray(json?.keys) ? json.keys : []
  if (!keys.length) {
    throw new Error('JWKS da Glin retornou sem chaves')
  }
  jwksCache.keys = keys
  jwksCache.expiresAt = now + 10 * 60 * 1000
  return keys
}

async function verifyWebhookJws(req, rawBody) {
  const compact = String(req.headers['x-jws-signature'] || '').trim()
  if (!compact) return false

  const parts = compact.split('.')
  if (parts.length !== 3) return false
  const [protectedB64, payloadB64, signatureB64] = parts
  if (!protectedB64 || !signatureB64) return false

  const header = decodeBase64UrlToJson(protectedB64)
  if (!header || String(header.alg || '').toUpperCase() !== 'RS256') return false

  const keys = await getGlinJwks()
  const kid = String(header.kid || '').trim()
  const jwk = kid ? keys.find((k) => String(k?.kid || '').trim() === kid) : keys[0]
  if (!jwk) return false

  const key = createPublicKey({ key: jwk, format: 'jwk' })
  const verifier = createVerify('RSA-SHA256')
  if (payloadB64) {
    // Compact padrão (payload em base64url dentro do token).
    verifier.update(`${protectedB64}.${payloadB64}`, 'utf8')
  } else {
    // Detached payload (RFC 7797): assinatura sobre "<protected>.<rawBody>".
    verifier.update(`${protectedB64}.`, 'utf8')
    verifier.update(rawBody, 'utf8')
  }
  verifier.end()
  return verifier.verify(key, decodeBase64UrlToBuffer(signatureB64))
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
  const value = orderData?.clientReferenceId
    ?? orderData?.client_reference_id
    ?? orderData?.externalReference
    ?? orderData?.clientReference
    ?? orderData?.external_reference
    ?? orderData?.client_reference
    ?? orderData?.partner_reference
    ?? orderData?.reference
    ?? orderData?.order_id
    ?? payload?.clientReferenceId
    ?? payload?.client_reference_id
    ?? payload?.externalReference
    ?? payload?.clientReference
    ?? payload?.external_reference
    ?? payload?.client_reference
    ?? payload?.partner_reference
    ?? payload?.reference
    ?? payload?.order_id
    ?? payload?.data?.clientReferenceId
    ?? payload?.data?.client_reference_id
    ?? payload?.data?.externalReference
    ?? payload?.data?.clientReference
    ?? payload?.data?.external_reference
    ?? payload?.data?.client_reference
    ?? payload?.data?.order_id
  if (value == null) return null
  const normalized = String(value).trim()
  const uuidMatch = normalized.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  return uuidMatch ? uuidMatch[0] : normalized
}

function isPaidEvent(eventName, payload, orderData) {
  if (eventName === 'remittance_paid') return true
  const statusText = String(
    orderData?.status
      || orderData?.status_text
      || orderData?.payment_status
      || payload?.status
      || payload?.status_text
      || ''
  ).trim().toLowerCase()
  return statusText === 'paid'
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

  let rawBody
  try {
    rawBody = await getRawBody(req)
  } catch {
    rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
  }
  let authorized = false
  try {
    authorized = await verifyWebhookJws(req, rawBody)
  } catch (e) {
    console.error('Glin webhook signature verify failed:', e?.message || e)
    authorized = false
  }
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized webhook signature' })
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

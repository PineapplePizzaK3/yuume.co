/**
 * Vercel Serverless Function - Create KOMOJU Hosted Page Session.
 * Uses KOMOJU_SECRET_KEY (server-only) and Supabase service role to fetch order.
 */
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function basicAuth(secretKey) {
  // KOMOJU expects HTTP Basic with secretKey as username and blank password
  const token = Buffer.from(`${secretKey}:`, 'utf8').toString('base64')
  return `Basic ${token}`
}

function getFxBrlPerJpy() {
  const v = Number(process.env.FX_BRL_PER_JPY || process.env.VITE_FX_BRL_PER_JPY)
  return v && v > 0 ? v : 0.033
}

function toChargeAmountJpy(amount, currency) {
  const c = (currency || 'jpy').toUpperCase()
  const n = Number(amount) || 0
  if (n <= 0) return 0
  if (c === 'JPY') return n
  if (c === 'BRL') {
    const fx = getFxBrlPerJpy()
    return n / fx
  }
  return n
}

function getBaseUrl(req) {
  const envUrl = process.env.VITE_SITE_URL || process.env.SITE_URL
  const fromEnv = typeof envUrl === 'string' && envUrl.trim()
    ? envUrl.trim().replace(/\/$/, '')
    : null
  const isHttp = (u) => /^https?:\/\//i.test(u)
  if (fromEnv && isHttp(fromEnv)) return fromEnv

  const origin = req?.headers?.origin
  if (typeof origin === 'string' && isHttp(origin)) return origin.replace(/\/$/, '')

  const protoHeader = req?.headers?.['x-forwarded-proto']
  const proto = typeof protoHeader === 'string' && protoHeader ? protoHeader.split(',')[0].trim() : 'https'
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host
  if (typeof host === 'string' && host) return `${proto}://${host}`.replace(/\/$/, '')

  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secretKey = process.env.KOMOJU_SECRET_KEY
  if (!secretKey) return res.status(500).json({ error: 'KOMOJU not configured' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Faça login para pagar' })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })

  const accessToken = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
  if (authError || !user) {
    return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' })
  }

  try {
    const { orderId, paymentType } = req.body || {}
    if (!orderId) return res.status(400).json({ error: 'orderId é obrigatório' })

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, status, shipping_cost, shipping_currency, quote_amount, quote_currency, total_amount, order_source, ship_immediately')
      .eq('id', orderId)
      .single()

    if (orderError || !order) return res.status(404).json({ error: 'Pedido não encontrado' })
    if (order.user_id !== user.id) return res.status(403).json({ error: 'Este pedido não pertence a você' })
    if (order.status !== 'awaiting_payment') return res.status(400).json({ error: 'Este pedido não está aguardando pagamento' })

    let amount, currency, desc
    if (order.order_source === 'store') {
      amount = Number(order.total_amount)
      currency = 'BRL'
      desc = order.ship_immediately ? 'Loja: produtos + envio imediato' : 'Loja: produtos (armazenamento)'
    } else if (order.quote_amount != null && Number(order.quote_amount) > 0) {
      amount = Number(order.quote_amount)
      currency = (order.quote_currency || 'BRL').toUpperCase()
      desc = 'Pagamento de orçamento'
    } else {
      amount = Number(order.shipping_cost)
      currency = (order.shipping_currency || 'JPY').toUpperCase()
      desc = 'Pagamento de frete'
    }

    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor não definido para este pedido' })
    const amountJpy = Math.round(toChargeAmountJpy(amount, currency))
    if (!amountJpy || amountJpy <= 0) return res.status(400).json({ error: 'Valor inválido para cobrança' })

    const baseUrl = getBaseUrl(req)
    if (!baseUrl) return res.status(500).json({ error: 'Configuração de URL inválida (VITE_SITE_URL/origin ausente)' })
    const returnUrl = `${baseUrl}/api/komoju-return?orderId=${encodeURIComponent(orderId)}`

    const paymentTypes =
      paymentType === 'credit_card' ? ['credit_card']
        : paymentType === 'pix' ? ['pix']
          : paymentType === 'bank_transfer' ? ['bank_transfer']
            : null

    const body = {
      amount: amountJpy, // JPY sem casas decimais
      currency: 'JPY',
      return_url: returnUrl,
      external_order_num: orderId,
      description: `Pedido ${orderId.slice(0, 8)} - ${desc}`,
    }
    if (paymentTypes) body.payment_types = paymentTypes

    const session = await fetch('https://komoju.com/api/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuth(secretKey),
      },
      body: JSON.stringify(body),
    }).then(async (r) => {
      const json = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(json?.error || json?.message || 'Erro ao criar sessão na KOMOJU')
      return json
    })

    return res.status(200).json({ url: session.session_url, sessionId: session.id })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Internal server error' })
  }
}


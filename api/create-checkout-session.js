/**
 * Vercel Serverless Function - Create Stripe Checkout Session.
 * Busca o pedido no Supabase e usa o shipping_cost real para o pagamento do frete.
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getExchangeRates } from '../server-lib/exchangeRateService.js'
import {
  jpyToFinalUsd,
  brlToJpyViaUsdPipeline,
  jpyEquivalentFromFinalUsd,
} from '../server-lib/pricingEngine.js'
import { ensureInvoiceForPaidOrder } from '../server-lib/invoiceGenerator.js'
import { handleExchangeRatesGet } from '../server-lib/exchangeRatesHttp.js'
import { handleCronRefreshExchangeRates } from '../server-lib/cronRefreshHttp.js'
import { resolveWiseWithdrawalMarkupPercent } from '../server-lib/wiseWithdrawalMarkup.js'

const REQUEST_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 20
const rateLimitMemory = globalThis.__checkoutRateLimitMap ?? new Map()
globalThis.__checkoutRateLimitMap = rateLimitMemory
const parcelowTokenCache = globalThis.__parcelowAccessTokenCache ?? { token: null, expiresAt: 0 }
globalThis.__parcelowAccessTokenCache = parcelowTokenCache

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  try {
    return new Stripe(key)
  } catch (e) {
    console.error('Invalid STRIPE_SECRET_KEY:', e?.message || e)
    return null
  }
}

function isRateLimited(key) {
  if (!key) return false
  const now = Date.now()
  const windowStart = now - REQUEST_WINDOW_MS
  const entries = rateLimitMemory.get(key) || []
  const validEntries = entries.filter((ts) => ts >= windowStart)
  validEntries.push(now)
  rateLimitMemory.set(key, validEntries)
  return validEntries.length > MAX_REQUESTS_PER_WINDOW
}

function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req?.socket?.remoteAddress || 'unknown'
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function getSupabaseUser(accessToken) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon || !accessToken) return null
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

function normalizeProvider(raw) {
  const p = String(raw || '').trim().toLowerCase()
  if (p === 'stripe' || p === 'parcelow') return p
  return null
}

function shouldPreferParcelow(order, currency) {
  const c = String(currency || '').trim().toLowerCase()
  if (c === 'brl') return true
  const source = String(order?.order_source || '').trim().toLowerCase()
  return source === 'store'
}

function normalizeParcelowBaseUrl() {
  const raw = process.env.PARCELOW_API_BASE_URL || 'https://staging.parcelow.com'
  return String(raw).trim().replace(/\/$/, '')
}

function parsePhone(raw) {
  const digits = String(raw || '').replace(/\D+/g, '')
  return digits || undefined
}

/** Apenas dígitos; undefined se vazio. */
function digitsOnly(raw) {
  const s = String(raw || '').replace(/\D+/g, '')
  return s || undefined
}

function isValidCpf(d) {
  if (!d || d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10) r = 0
  if (r !== Number(d[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10) r = 0
  return r === Number(d[10])
}

function isValidCnpj(d) {
  if (!d || d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * w1[i]
  let r = sum % 11
  const d1 = r < 2 ? 0 : 11 - r
  if (d1 !== Number(d[12])) return false
  sum = 0
  for (let i = 0; i < 13; i++) sum += Number(d[i]) * w2[i]
  r = sum % 11
  const d2 = r < 2 ? 0 : 11 - r
  return d2 === Number(d[13])
}

/**
 * CPF/CNPJ só com dígitos para APIs brasileiras (ex.: Parcelow rejeita máscara com 422).
 */
function normalizeBrazilTaxIdForApi(raw) {
  const d = digitsOnly(raw)
  if (!d) return undefined
  if (d.length === 11) {
    if (!isValidCpf(d)) {
      throw new Error(
        'CPF no perfil é inválido. Atualize em seus dados com 11 dígitos corretos (a Parcelow exige CPF válido para cobrança em BRL).'
      )
    }
    return d
  }
  if (d.length === 14) {
    if (!isValidCnpj(d)) {
      throw new Error(
        'CNPJ no perfil é inválido. Atualize em seus dados com 14 dígitos corretos.'
      )
    }
    return d
  }
  throw new Error(
    'CPF/CNPJ no perfil está incompleto. Use 11 dígitos (CPF) ou 14 (CNPJ), sem letras.'
  )
}

function getParcelowClientConfig() {
  const clientIdRaw = process.env.PARCELOW_CLIENT_ID
  const clientSecret = process.env.PARCELOW_CLIENT_SECRET
  const clientId = Number(String(clientIdRaw ?? '').trim())
  if (!Number.isFinite(clientId) || clientId <= 0 || !clientSecret) return null
  return {
    clientId,
    clientSecret: String(clientSecret),
    baseUrl: normalizeParcelowBaseUrl(),
  }
}

async function parseJsonSafe(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

const PARCELOW_FETCH_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.PARCELOW_FETCH_TIMEOUT_MS) || 28000, 5000),
  55000
)

async function fetchParcelow(url, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PARCELOW_FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    const name = e?.name || ''
    const msg = e?.message || String(e)
    if (name === 'AbortError' || /aborted/i.test(msg)) {
      throw new Error(
        `Timeout ao contatar Parcelow (${Math.round(PARCELOW_FETCH_TIMEOUT_MS / 1000)}s). Verifique PARCELOW_API_BASE_URL.`
      )
    }
    throw new Error(`Erro de rede com Parcelow: ${msg}`)
  } finally {
    clearTimeout(timer)
  }
}

async function getParcelowAccessToken() {
  const cfg = getParcelowClientConfig()
  if (!cfg) return null
  const now = Date.now()
  if (parcelowTokenCache.token && parcelowTokenCache.expiresAt - 60_000 > now) {
    return parcelowTokenCache.token
  }
  const tokenRes = await fetchParcelow(`${cfg.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'client_credentials',
    }),
  })
  const payload = await parseJsonSafe(tokenRes)
  if (!tokenRes.ok) {
    const hint = payload?.message || payload?.error || payload?.error_description || JSON.stringify(payload || {})
    throw new Error(
      `Falha ao autenticar na Parcelow (HTTP ${tokenRes.status}): ${hint}. Confira se client_id/client_secret são do mesmo ambiente que PARCELOW_API_BASE_URL (staging vs produção).`
    )
  }
  const accessToken = payload?.access_token
  const expiresIn = Number(payload?.expires_in) || 3600
  if (!accessToken) {
    throw new Error('Parcelow retornou token inválido')
  }
  parcelowTokenCache.token = accessToken
  parcelowTokenCache.expiresAt = now + expiresIn * 1000
  return accessToken
}

function extractParcelowOrderResponse(json) {
  if (!json || typeof json !== 'object') {
    return { checkoutUrl: null, parcelowOrderId: null }
  }
  if (json.success === false) {
    const msg = json.message || json.error || json.error_description || 'Parcelow recusou criar o pedido'
    throw new Error(msg)
  }
  let block = json.data
  if (Array.isArray(block) && block.length > 0) {
    block = block[0]
  }
  if (!block || typeof block !== 'object') {
    block = json
  }
  const checkoutUrl =
    block.url_checkout
    || block.urlCheckout
    || block.checkout_url
    || block.checkoutUrl
    || block.payment_url
    || block.paymentUrl
    || block.link
    || (typeof block.url === 'string' && /^https?:\/\//i.test(block.url) ? block.url : null)
  const parcelowOrderId = block.order_id ?? block.orderId ?? block.id ?? null
  return { checkoutUrl, parcelowOrderId }
}

function normalizeAmountToCents(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  // Inteiro normalmente já vem em centavos; decimal normalmente vem em unidade (USD).
  if (Number.isInteger(n)) return Math.round(n)
  return Math.round(n * 100)
}

function extractParcelowEchoAmount(json) {
  if (!json || typeof json !== 'object') return { currency: null, amountCents: null }
  let block = json.data
  if (Array.isArray(block) && block.length > 0) block = block[0]
  if (!block || typeof block !== 'object') block = json

  const currency = String(
    block.currency
      ?? block.amount_currency
      ?? block.total_currency
      ?? block?.items?.[0]?.currency
      ?? json.currency
      ?? ''
  ).trim().toUpperCase() || null

  const amountCandidates = [
    block?.items?.[0]?.amount,
    block.amount,
    block.total_amount,
    block.total,
    block.amount_usd,
    block.total_usd,
    json.amount,
    json.total_amount,
    json.amount_usd,
    json.total_usd,
  ]
  for (const raw of amountCandidates) {
    const cents = normalizeAmountToCents(raw)
    if (cents != null) return { currency, amountCents: cents }
  }
  return { currency, amountCents: null }
}

async function fetchParcelowOrderByReference({ baseUrl, token, reference }) {
  const ref = String(reference || '').trim()
  if (!ref) return null
  const url = `${String(baseUrl || '').replace(/\/$/, '')}/api/orders/reference/${encodeURIComponent(ref)}`
  const res = await fetchParcelow(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok || !json || json.success === false) {
    return { ok: false, status: res.status, body: json || text?.slice(0, 400) || null }
  }
  const arr = Array.isArray(json?.data) ? json.data : []
  const first = arr[0] || null
  return {
    ok: true,
    status: res.status,
    order: first
      ? {
          id: first.id ?? null,
          reference: first.reference ?? null,
          total_usd: first.total_usd ?? null,
          total_brl: first.total_brl ?? null,
          order_amount: first.order_amount ?? null,
          status_text: first.status_text ?? null,
        }
      : null,
  }
}

/**
 * Pedido loja em BRL: mesmo JPY que o Cart.jsx (soma ¥ das linhas × cupom × BRL a pagar após indicação).
 * Evita usar total_amount_usd do Postgres na conversão → Parcelow/Stripe alinhados ao site (spot jpy_usd).
 */
function chargeJpyStoreBrlFromLineItems(order, orderItems, payableBrlAfterReferral) {
  const postCouponBrl = Number(order.total_amount) || 0
  const discBrl = Math.max(0, Number(order.discount_amount) || 0)
  const fullBrl = postCouponBrl + discBrl
  let sumJpy = 0
  for (const it of orderItems || []) {
    sumJpy += Number(it.price_at_purchase) * Number(it.quantity)
  }
  if (sumJpy <= 0 || fullBrl <= 0) return null
  const pay = Math.max(0, Number(payableBrlAfterReferral) || 0)
  return Math.round(sumJpy * (pay / fullBrl))
}

async function createParcelowOrderCheckout({
  orderId,
  user,
  profile,
  remainingJpy,
  amountUsdOverride,
  productName,
  baseUrl,
  supabase,
  rates,
  wiseMarkup,
  debugContext,
}) {
  const cfg = getParcelowClientConfig()
  if (!cfg) {
    throw new Error('Parcelow não configurado no servidor')
  }
  const token = await getParcelowAccessToken()
  if (!token) {
    throw new Error('Token Parcelow indisponível')
  }

  if (!rates?.jpy_usd || !rates?.usd_brl) {
    throw new Error('Câmbio indisponível para cobrança Parcelow em USD')
  }
  const rj = Math.max(0, Number(remainingJpy) || 0)
  const overrideUsd = Number(amountUsdOverride)
  const amountUsd =
    Number.isFinite(overrideUsd) && overrideUsd > 0
      ? overrideUsd
      : jpyToFinalUsd(rj, rates.jpy_usd, wiseMarkup)
  const amountUsdCents = Math.round(amountUsd * 100)
  if (!Number.isFinite(amountUsdCents) || amountUsdCents <= 0) {
    throw new Error('Valor inválido para criar cobrança Parcelow (USD)')
  }

  const customerName = String(profile?.name || user?.user_metadata?.name || user?.email || 'Cliente').trim()
  const customerEmail = String(user?.email || profile?.email || '').trim()
  if (!customerEmail) {
    throw new Error('E-mail do cliente obrigatório para checkout Parcelow. Complete seu perfil ou conta.')
  }

  // Parcelow: rota única POST /api/orders; moeda em JSON (currency/items), não mais /api/orders/usd.
  const ordersPath = String(process.env.PARCELOW_ORDERS_PATH || '/api/orders').trim() || '/api/orders'

  const checkoutReference = `order_${String(orderId).slice(0, 12)}_${Date.now()}`
  const payload = {
    // Reference único por tentativa evita reuso de checkout antigo no parceiro.
    reference: checkoutReference,
    partner_reference: String(orderId),
    client: {
      cpf: normalizeBrazilTaxIdForApi(profile?.cpf_cnpj),
      name: customerName,
      email: customerEmail,
      phone: parsePhone(profile?.phone),
    },
    items: [
      {
        reference: `item_${String(orderId).slice(0, 12)}`,
        description: (productName || `Pedido ${String(orderId).slice(0, 8)}`).slice(0, 500),
        quantity: '1',
        amount: amountUsdCents,
      },
    ],
    redirect: {
      success: `${baseUrl}/app/cart?success=true`,
      failed: `${baseUrl}/app/cart?canceled=true`,
    },
  }

  const parcelowUrlBase = cfg.baseUrl.replace(/\/$/, '')
  let parcelowPath = ordersPath.startsWith('/') ? ordersPath : `/${ordersPath}`
  if (/\/api$/i.test(parcelowUrlBase) && /^\/api\//i.test(parcelowPath)) {
    parcelowPath = parcelowPath.replace(/^\/api/i, '')
  }
  const createRes = await fetchParcelow(`${parcelowUrlBase}${parcelowPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const rawText = await createRes.text()
  let createData = null
  try {
    createData = rawText ? JSON.parse(rawText) : null
  } catch {
    createData = null
  }

  if (!createRes.ok) {
    const hint = createData?.message || createData?.error || rawText?.slice(0, 280) || '(corpo vazio)'
    throw new Error(`Falha ao criar pedido na Parcelow (HTTP ${createRes.status}): ${hint}`)
  }
  if (!createData) {
    throw new Error(
      `Parcelow retornou resposta não-JSON (HTTP ${createRes.status}). Início: ${String(rawText).slice(0, 200)}`
    )
  }

  const { checkoutUrl, parcelowOrderId } = extractParcelowOrderResponse(createData)
  const echoed = extractParcelowEchoAmount(createData)
  if (!checkoutUrl) {
    const preview = JSON.stringify(createData).slice(0, 500)
    throw new Error(
      `Parcelow não retornou URL de checkout. Corpo (trecho): ${preview}. Confirme path ${ordersPath} e formato USD com a Parcelow.`
    )
  }
  if (echoed.amountCents != null && Math.abs(echoed.amountCents - amountUsdCents) > 1) {
    throw new Error(
      `Parcelow respondeu valor divergente (enviado ${amountUsdCents} cents, retornado ${echoed.amountCents} cents).`
    )
  }

  const brlDisplay = amountUsd * (rates.usd_brl || 0)
  const endpoint = `${parcelowUrlBase}${parcelowPath}`
  let byReference = null
  try {
    byReference = await fetchParcelowOrderByReference({
      baseUrl: parcelowUrlBase,
      token,
      reference: payload.reference,
    })
  } catch {
    byReference = null
  }
  const debugPayload = {
    orderId,
    endpoint,
    request: {
      reference: payload.reference,
      partnerReference: payload.partner_reference,
      itemAmountCentsSent: payload.items?.[0]?.amount,
      amountUsd: Number(amountUsd.toFixed(4)),
      remainingJpy: Number(rj.toFixed(2)),
      jpyUsdSpot: Number((Number(rates?.jpy_usd) || 0).toFixed(8)),
      wiseMarkupPercent: Number((Number(wiseMarkup) || 0).toFixed(4)),
      usdBrl: Number((Number(rates?.usd_brl) || 0).toFixed(6)),
    },
    responseEcho: echoed,
    orderByReference: byReference,
    pricingContext: debugContext || null,
  }
  console.info('Parcelow checkout debug', JSON.stringify(debugPayload))

  // Não gravar linha em `payments` ao só abrir o checkout: isso polui histórico e parece
  // "cobrança" antes do cliente pagar. O webhook Parcelow insere/atualiza ao confirmar.

  return {
    url: checkoutUrl,
    provider: 'parcelow',
    chargeUsd: Number(amountUsd.toFixed(2)),
    approxBrl: Number(brlDisplay.toFixed(2)),
    debug: debugPayload,
  }
}

function toChargeAmountJpyFromRates(amount, currency, rates, wiseMarkup) {
  const c = (currency || 'jpy').toLowerCase()
  const n = Number(amount) || 0
  if (n <= 0) return 0
  if (c === 'jpy') return n
  if (c === 'brl') {
    if (!rates?.jpy_usd || !rates?.usd_brl) return 0
    return brlToJpyViaUsdPipeline(n, rates.jpy_usd, rates.usd_brl, wiseMarkup)
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

function readDispatchQuery(req) {
  const raw = req.query?.x_dispatch
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && raw.length) return String(raw[0])
  return ''
}

/** Pedido “virtual” a partir de store_checkout_intents (checkout sem pedido prévio). */
function orderLikeFromIntentRow(ir) {
  if (!ir?.id) return null
  return {
    id: ir.id,
    user_id: ir.user_id,
    status: 'awaiting_payment',
    shipping_cost: ir.shipping_cost_jpy,
    shipping_currency: ir.shipping_currency,
    quote_amount: null,
    quote_currency: null,
    total_amount: Number(ir.total_amount),
    total_amount_usd: Number(ir.total_amount_usd),
    discount_amount: ir.discount_amount != null ? Number(ir.discount_amount) : null,
    wallet_applied_amount: 0,
    order_source: 'store',
    ship_immediately: !!ir.ship_immediately,
    acquisition_mode: 'none',
    referral_discount_amount: null,
    affiliate_id: null,
    referral_id: null,
  }
}

function intentLineItemsAsOiRows(lineItemsJson) {
  const arr = Array.isArray(lineItemsJson) ? lineItemsJson : []
  return arr.map((row) => ({
    quantity: Number(row?.quantity) || 1,
    price_at_purchase: Number(row?.price_jpy) || 0,
  }))
}

export default async function handler(req, res) {
  const dispatch = readDispatchQuery(req)
  if (dispatch === 'exchange-rates') {
    return handleExchangeRatesGet(req, res)
  }
  if (dispatch === 'cron-refresh-exchange-rates') {
    return handleCronRefreshExchangeRates(req, res)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripe = getStripeClient()

  try {
    const body = req.body || {}
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Faça login para pagar' })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' })
    }
    const ip = getClientIp(req)
    const rateKey = `${user.id}:${ip}`
    if (isRateLimited(rateKey)) {
      return res.status(429).json({ error: 'Muitas tentativas de pagamento. Aguarde 1 minuto e tente novamente.' })
    }

    const baseUrl = getBaseUrl(req)
    if (!baseUrl) {
      return res.status(500).json({ error: 'Configuração de URL inválida (VITE_SITE_URL/origin ausente)' })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, cpf_cnpj, phone')
      .eq('id', user.id)
      .maybeSingle()

    // Carrinho (produtos da loja)
    if (body.type === 'cart') {
      if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' })
      }
      const cartItems = body.items
      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({ error: 'Carrinho vazio' })
      }
      const line_items = cartItems.map((item) => {
        const price = Number(item.price) || 0
        const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)))
        const unitAmount = Math.round(price * 100) // BRL em centavos
        if (unitAmount < 50) return null // Stripe mínimo 0.50 BRL
        return {
          price_data: {
            currency: 'brl',
            product_data: {
              name: item.name || 'Produto',
            },
            unit_amount: unitAmount,
          },
          quantity,
        }
      }).filter(Boolean)
      if (line_items.length === 0) {
        return res.status(400).json({ error: 'Nenhum item válido no carrinho' })
      }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items,
        mode: 'payment',
        success_url: `${baseUrl}/app/cart?success=true`,
        cancel_url: `${baseUrl}/app/cart?canceled=true`,
        metadata: { type: 'cart', userId: user.id },
      })
      return res.status(200).json({ url: session.url })
    }

    // Recarga de carteira (adicionar saldo)
    if (body.type === 'topup') {
      const amountJpy = Math.round(Number(body.amountJpy) || 0)
      const requestedProvider = normalizeProvider(body.provider)
      const selectedProvider = requestedProvider || 'stripe'
      const minJpy = 500 // ¥500
      const maxJpy = 500000 // ¥500.000
      if (amountJpy < minJpy || amountJpy > maxJpy) {
        return res.status(400).json({ error: 'Valor deve ser entre ¥500 e ¥500.000' })
      }
      if (selectedProvider === 'parcelow') {
        const ratesTopup = await getExchangeRates(supabase)
        const wiseTopup = await resolveWiseWithdrawalMarkupPercent(supabase)
        if (!ratesTopup?.jpy_usd || !ratesTopup?.usd_brl) {
          return res.status(503).json({
            error: 'Câmbio indisponível para cobrança Parcelow em USD na recarga.',
          })
        }
        const amountUsdTopup = jpyToFinalUsd(amountJpy, ratesTopup.jpy_usd, wiseTopup)
        const amountBrlTopup = Number((amountUsdTopup * ratesTopup.usd_brl).toFixed(2))
        const { data: topupRequest, error: topupErr } = await supabase
          .from('wallet_topup_requests')
          .insert({
            user_id: user.id,
            amount_jpy: amountJpy,
            amount_brl: amountBrlTopup,
            status: 'pending',
            // Marca origem automática para rastreio (sem depender de comprovante manual).
            comprovante_url: 'parcelow:auto',
          })
          .select('id, amount_jpy, amount_brl')
          .single()
        if (topupErr || !topupRequest?.id) {
          return res.status(500).json({ error: topupErr?.message || 'Falha ao iniciar recarga Parcelow' })
        }
        try {
          const parcelowCheckout = await createParcelowOrderCheckout({
            orderId: topupRequest.id,
            user,
            profile,
            remainingJpy: amountJpy,
            amountUsdOverride: amountUsdTopup,
            productName: `Recarga de carteira ${amountJpy} JPY`,
            baseUrl,
            supabase,
            rates: ratesTopup,
            wiseMarkup: wiseTopup,
            debugContext: {
              flow: 'wallet_topup',
              topupRequestId: topupRequest.id,
              amountJpy,
              amountUsd: Number(amountUsdTopup.toFixed(4)),
              amountBrl: amountBrlTopup,
            },
          })
          return res.status(200).json({
            ...parcelowCheckout,
            provider: 'parcelow',
            topup_request_id: topupRequest.id,
          })
        } catch (parcelowErr) {
          await supabase.from('wallet_topup_requests').delete().eq('id', topupRequest.id)
          throw parcelowErr
        }
      }
      if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' })
      }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'jpy',
              product_data: {
                name: 'Adicionar saldo - Carteira',
                description: 'Crédito na sua carteira virtual (JPY) para pagar serviços, frete e loja.',
              },
              unit_amount: amountJpy,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${baseUrl}/app/wallet?success=true`,
        cancel_url: `${baseUrl}/app/wallet?canceled=true`,
        metadata: { type: 'topup', userId: user.id },
      })
      return res.status(200).json({ url: session.url })
    }

    // Pagamento de frete (pedido) ou loja via intenção (sem pedido até pagar)
    let orderId = body.orderId
    const accessToken = authHeader.replace('Bearer ', '')
    const supabaseUser = getSupabaseUser(accessToken)
    let intentCheckoutId = null

    if (body.cartCheckout === true && !orderId) {
      if (!supabaseUser) {
        return res.status(500).json({ error: 'Configuração incompleta para checkout da loja' })
      }
      const cp = body.cartParams && typeof body.cartParams === 'object' ? body.cartParams : {}
      const couponRaw = cp.couponCode != null ? String(cp.couponCode).trim() : ''
      const { data: intentSummary, error: intentRpcErr } = await supabaseUser.rpc('create_store_checkout_intent', {
        p_user_id: user.id,
        p_ship_immediately: !!cp.shipImmediately,
        p_shipping_cost: cp.shippingCostJpy != null ? Number(cp.shippingCostJpy) : null,
        p_shipping_currency: 'JPY',
        p_shipping_address_id: cp.shippingAddressId || null,
        p_coupon_code: couponRaw || null,
      })
      if (intentRpcErr) {
        return res.status(400).json({ error: intentRpcErr.message || 'Não foi possível iniciar o checkout' })
      }
      const newIntentId = intentSummary?.intent_id
      if (!newIntentId) {
        return res.status(500).json({ error: 'Resposta inválida ao criar intenção de checkout' })
      }
      const { data: ir, error: irErr } = await supabase
        .from('store_checkout_intents')
        .select('*')
        .eq('id', newIntentId)
        .maybeSingle()
      if (irErr || !ir) {
        return res.status(500).json({ error: 'Intenção de checkout não encontrada após criação' })
      }

      intentCheckoutId = newIntentId
      const syntheticOiRows = intentLineItemsAsOiRows(ir.line_items)

      const ratesEarly = await getExchangeRates(supabase)
      const wiseEarly = await resolveWiseWithdrawalMarkupPercent(supabase)
      const orderEarly = orderLikeFromIntentRow(ir)
      const amountEarly = Number(orderEarly.total_amount)
      const currencyEarly = 'brl'
      const storeUsdEarly = Number(orderEarly.total_amount_usd)
      let chargeJpyEarly = 0
      if (ratesEarly?.jpy_usd && ratesEarly?.usd_brl) {
        const lineChargeJpy = chargeJpyStoreBrlFromLineItems(
          orderEarly,
          syntheticOiRows,
          amountEarly
        )
        let usdBasedJpy = null
        if (Number.isFinite(storeUsdEarly) && storeUsdEarly > 0) {
          usdBasedJpy = Math.round(
            jpyEquivalentFromFinalUsd(storeUsdEarly, ratesEarly.jpy_usd, wiseEarly)
          )
        }
        const brlBasedJpy = Math.round(
          toChargeAmountJpyFromRates(amountEarly, currencyEarly, ratesEarly, wiseEarly)
        )
        const candidates = [lineChargeJpy, usdBasedJpy, brlBasedJpy]
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n > 0)
        if (candidates.length > 0) chargeJpyEarly = Math.max(...candidates)
      }
      if (!chargeJpyEarly || chargeJpyEarly <= 0) {
        await supabase.from('store_checkout_intents').delete().eq('id', newIntentId)
        return res.status(503).json({
          error:
            'Câmbio indisponível para calcular o pedido da loja. Aguarde ou configure FALLBACK_FX_JPY_USD / FALLBACK_FX_USD_BRL.',
        })
      }

      const alreadyAppliedJpyEarly = 0
      let walletAppliedEarly = 0
      let remainingJpyEarly = Math.max(0, (Number(chargeJpyEarly) || 0) - alreadyAppliedJpyEarly)

      if (body.useWallet) {
        const chargeJpyIntEarly = Math.max(0, Math.round(Number(chargeJpyEarly) || 0))
        const rawWalletEarly = body.walletAmountJpy
        const requestedWalletEarly =
          rawWalletEarly != null && rawWalletEarly !== ''
            ? Math.floor(Number(rawWalletEarly) || 0)
            : null
        const pAmountJpyEarly =
          requestedWalletEarly != null && requestedWalletEarly > 0
            ? Math.min(Math.max(0, Math.round(remainingJpyEarly)), requestedWalletEarly)
            : null

        const { data: wbal } = await supabase
          .from('wallets')
          .select('balance, currency')
          .eq('user_id', user.id)
          .maybeSingle()
        const bal = Number(wbal?.balance) || 0
        const cur = String(wbal?.currency || 'JPY').toUpperCase()
        const canWallet = bal > 0 && cur === 'JPY'
        let simApply = 0
        const remEarly = Math.max(0, chargeJpyIntEarly - alreadyAppliedJpyEarly)
        if (canWallet) {
          simApply =
            pAmountJpyEarly != null && pAmountJpyEarly > 0
              ? Math.min(remEarly, bal, pAmountJpyEarly)
              : Math.min(remEarly, bal)
        }
        remainingJpyEarly = Math.max(0, remEarly - simApply)
        walletAppliedEarly = simApply
      }

      const EPS_J = 0.0001
      if (body.useWallet && remainingJpyEarly <= EPS_J) {
        const { data: wp, error: wpe } = await supabaseUser.rpc('wallet_pay_store_checkout_intent', {
          p_intent_id: newIntentId,
        })
        if (wpe) {
          return res.status(400).json({ error: wpe.message || 'Erro ao pagar com a carteira' })
        }
        const paidOid = wp?.order_id
        if (paidOid) {
          await ensureInvoiceForPaidOrder(supabase, paidOid).catch((e) =>
            console.error('ensureInvoice (cart wallet intent):', e?.message || e)
          )
        }
        return res.status(200).json({
          paid: true,
          walletApplied: Number(wp?.wallet_applied) || 0,
        })
      }

      if (body.useWallet && remainingJpyEarly > EPS_J) {
        await supabase.from('store_checkout_intents').delete().eq('id', newIntentId)
        const { data: createdOrder, error: coErr } = await supabaseUser.rpc('create_store_order', {
          p_user_id: user.id,
          p_ship_immediately: !!cp.shipImmediately,
          p_shipping_cost: cp.shippingCostJpy != null ? Number(cp.shippingCostJpy) : null,
          p_shipping_currency: 'JPY',
          p_shipping_address_id: cp.shippingAddressId || null,
          p_coupon_code: couponRaw || null,
        })
        if (coErr) {
          return res.status(400).json({ error: coErr.message || 'Erro ao criar pedido para checkout misto' })
        }
        const oid = createdOrder && typeof createdOrder === 'object' ? createdOrder.id : null
        if (!oid) {
          return res.status(500).json({ error: 'Pedido não retornado após criação' })
        }
        orderId = oid
        intentCheckoutId = null
      } else {
        orderId = newIntentId
      }
    }

    if (!orderId) {
      return res.status(400).json({ error: 'orderId ou type topup com amountCents é obrigatório' })
    }

    let orderBase = null
    let orderError = null
    if (!intentCheckoutId) {
      const ob = await supabase
        .from('orders')
        .select('id, user_id, status, shipping_cost, shipping_currency, quote_amount, quote_currency, total_amount, total_amount_usd, discount_amount, wallet_applied_amount, order_source, ship_immediately, acquisition_mode, referral_discount_amount, affiliate_id, referral_id')
        .eq('id', orderId)
        .single()
      orderBase = ob.data
      orderError = ob.error
    }

    let order
    let oiRowsOverride = null

    if (intentCheckoutId) {
      const { data: ir2 } = await supabase
        .from('store_checkout_intents')
        .select('*')
        .eq('id', intentCheckoutId)
        .maybeSingle()
      if (!ir2) {
        return res.status(400).json({ error: 'Intenção de checkout inválida ou expirada' })
      }
      const ol = orderLikeFromIntentRow(ir2)
      if (!ol || ol.user_id !== user.id) {
        return res.status(403).json({ error: 'Esta intenção não pertence a você' })
      }
      order = ol
      oiRowsOverride = intentLineItemsAsOiRows(ir2.line_items)
    } else {
      if (orderError || !orderBase) {
        return res.status(404).json({ error: 'Pedido não encontrado' })
      }
      if (orderBase.user_id !== user.id) {
        return res.status(403).json({ error: 'Este pedido não pertence a você' })
      }
      if (orderBase.status !== 'awaiting_payment') {
        return res.status(400).json({ error: 'Este pedido não está aguardando pagamento' })
      }
      order = orderBase
    }

    const rates = await getExchangeRates(supabase)
    const wiseMarkup = await resolveWiseWithdrawalMarkupPercent(supabase)

    let amount
    let currency
    let productName
    let productDesc
    if (order.order_source === 'store') {
      amount = Number(order.total_amount)
      currency = 'brl'
      productName = `Loja - Pedido ${orderId.slice(0, 8)}`
      productDesc = order.ship_immediately ? 'Produtos + envio imediato' : 'Produtos (armazenamento)'
    } else if (order.quote_amount != null && Number(order.quote_amount) > 0) {
      amount = Number(order.quote_amount)
      currency = (order.quote_currency || 'BRL').toLowerCase()
      productName = `Personal Shopping - Orçamento ${orderId.slice(0, 8)}`
      productDesc = 'Pagamento do orçamento'
    } else {
      amount = Number(order.shipping_cost)
      currency = (order.shipping_currency || 'JPY').toLowerCase()
      productName = `Frete - Pedido ${orderId.slice(0, 8)}`
      productDesc = 'Pagamento do frete internacional'
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valor não definido para este pedido' })
    }

    const origBrlStore =
      order.order_source === 'store' ? Number(order.total_amount) : null

    let chargeJpy = 0
    const storeUsd = Number(order.total_amount_usd)
    if (order.order_source === 'store' && currency === 'brl' && rates?.jpy_usd && rates?.usd_brl) {
      let oiForCharge = oiRowsOverride
      if (!oiForCharge) {
        const { data: oiRows } = await supabase
          .from('order_items')
          .select('quantity, price_at_purchase')
          .eq('order_id', orderId)
        oiForCharge = oiRows || []
      }

      const lineChargeJpy = chargeJpyStoreBrlFromLineItems(order, oiForCharge, amount)
      let usdBasedJpy = null
      if (Number.isFinite(storeUsd) && storeUsd > 0) {
        let amountUsd = storeUsd
        if (
          origBrlStore != null
          && origBrlStore > 0
          && Number(amount) !== origBrlStore
        ) {
          amountUsd = storeUsd * (Number(amount) / origBrlStore)
        }
        usdBasedJpy = Math.round(jpyEquivalentFromFinalUsd(amountUsd, rates.jpy_usd, wiseMarkup))
      }
      const brlBasedJpy = Math.round(toChargeAmountJpyFromRates(amount, currency, rates, wiseMarkup))
      // Ordem de segurança: nunca subcobrar quando order_items vier sem taxas/itens completos.
      // Ex.: grupo de compras/taxas em BRL podem não virar linha no order_items.
      const candidates = [lineChargeJpy, usdBasedJpy, brlBasedJpy]
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0)
      if (candidates.length > 0) {
        chargeJpy = Math.max(...candidates)
      }
    }

    if (order.order_source === 'store' && (!chargeJpy || chargeJpy <= 0)) {
      if (!rates?.jpy_usd || !rates?.usd_brl) {
        return res.status(503).json({
          error: 'Câmbio indisponível para calcular o pedido da loja. Aguarde ou configure FALLBACK_FX_JPY_USD / FALLBACK_FX_USD_BRL.',
        })
      }
      chargeJpy = toChargeAmountJpyFromRates(amount, currency, rates, wiseMarkup)
    } else if (order.order_source !== 'store') {
      if (currency === 'brl' && (!rates?.jpy_usd || !rates?.usd_brl)) {
        return res.status(503).json({
          error: 'Câmbio indisponível para valores em BRL. Aguarde ou configure FALLBACK_FX_*.',
        })
      }
      chargeJpy = toChargeAmountJpyFromRates(amount, currency, rates, wiseMarkup)
    }
    const alreadyAppliedJpy = Math.max(0, Number(order.wallet_applied_amount) || 0)
    let walletApplied = 0
    let remainingJpy = Math.max(0, (Number(chargeJpy) || 0) - alreadyAppliedJpy)

    // Se o pedido já foi integralmente coberto por carteira anteriormente, não deve haver nova cobrança.
    if (remainingJpy <= 0) {
      if (intentCheckoutId) {
        return res.status(400).json({ error: 'Valor a cobrar inválido para este checkout' })
      }
      const { data: stExisting } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .maybeSingle()
      if (stExisting?.status === 'paid') {
        await ensureInvoiceForPaidOrder(supabase, orderId).catch((e) =>
          console.error('ensureInvoice (checkout already covered):', e?.message || e)
        )
      }
      return res.status(200).json({ paid: true, walletApplied: 0, alreadyPaidByWallet: alreadyAppliedJpy })
    }

    // Aplicar carteira (JPY) como parte do pagamento, quando solicitado.
    // A RPC wallet_apply_to_order_jpy espera p_total_amount_jpy = cobrança total do pedido em JPY (autoritativa no servidor),
    // e opcionalmente p_amount_jpy = teto desta aplicação. Antes passávamos só o restante como p_total, o que
    // duplicava a subtração de wallet_applied e podia marcar "pago" ou deixar resto errado → redirecionava a Stripe/Parcelow.
    if (body.useWallet) {
      const accessToken = authHeader.replace('Bearer ', '')
      const supabaseUser = getSupabaseUser(accessToken)
      if (!supabaseUser) {
        return res.status(500).json({
          error: 'Carteira indisponível no momento (configuração da API incompleta). Nenhuma cobrança foi criada.',
        })
      }

      const chargeJpyInt = Math.max(0, Math.round(Number(chargeJpy) || 0))
      const rawWallet = body.walletAmountJpy
      const requestedWalletAmount =
        rawWallet != null && rawWallet !== '' ? Math.floor(Number(rawWallet) || 0) : null
      const pAmountJpy =
        requestedWalletAmount != null && requestedWalletAmount > 0
          ? Math.min(Math.max(0, Math.round(remainingJpy)), requestedWalletAmount)
          : null

      const { data: applyData, error: applyErr } = await supabaseUser.rpc('wallet_apply_to_order_jpy', {
        p_order_id: orderId,
        p_user_id: user.id,
        p_total_amount_jpy: chargeJpyInt,
        p_amount_jpy: pAmountJpy,
      })
      if (applyErr) throw new Error(applyErr.message || 'Erro ao aplicar carteira')
      walletApplied = Number(applyData?.applied_amount) || 0
      remainingJpy = Number(applyData?.remaining_amount) || 0
      if (applyData?.paid === true || remainingJpy <= 0) {
        const { data: stAfterWallet } = await supabase
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .maybeSingle()
        if (stAfterWallet?.status === 'paid' || stAfterWallet?.status === 'products_paid') {
          await ensureInvoiceForPaidOrder(supabase, orderId).catch((e) =>
            console.error('ensureInvoice (checkout wallet):', e?.message || e)
          )
        }
        return res.status(200).json({ paid: true, walletApplied })
      }
    }

    const unitAmount = Math.round(remainingJpy) // JPY sem casas decimais
    if (!unitAmount || unitAmount <= 0) {
      if (intentCheckoutId) {
        return res.status(400).json({ error: 'Nada a cobrar no gateway para este checkout' })
      }
      const newStatus = order?.order_source === 'store' && order?.ship_immediately
        ? 'products_paid'
        : 'paid'
      await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .eq('status', 'awaiting_payment')
      await supabase.from('payments').insert({
        order_id: orderId,
        stripe_payment_id: 'referral_discount',
        status: 'completed',
        amount: 0,
        currency: 'JPY',
      })
      if (newStatus === 'paid' || newStatus === 'products_paid') {
        await ensureInvoiceForPaidOrder(supabase, orderId).catch((e) =>
          console.error('ensureInvoice (checkout zero remainder):', e?.message || e)
        )
      }
      return res.status(200).json({ paid: true, walletApplied, discounted: true })
    }

    // Centralizamos todos os pagamentos no carrinho/central de pagamentos.
    const successPath = '/app/cart'
    const cancelPath = '/app/cart'

    const requestedProvider = normalizeProvider(body.provider)
    const selectedProvider = requestedProvider || (shouldPreferParcelow(order, currency) ? 'parcelow' : 'stripe')

    if (selectedProvider === 'parcelow') {
      if (!rates?.jpy_usd || !rates?.usd_brl) {
        return res.status(503).json({
          error: 'Parcelow (USD) indisponível: cotações não carregadas. Use outro método ou aguarde.',
        })
      }
      const storeUsd = Number(order?.total_amount_usd)
      const amountUsdOverride =
        order?.order_source === 'store' &&
        Number.isFinite(storeUsd) &&
        storeUsd > 0 &&
        Number.isFinite(chargeJpy) &&
        chargeJpy > 0
          ? storeUsd * (Math.max(0, Number(remainingJpy) || 0) / chargeJpy)
          : null
      const parcelowCheckout = await createParcelowOrderCheckout({
        orderId,
        user,
        profile,
        remainingJpy,
        amountUsdOverride,
        productName,
        baseUrl,
        supabase,
        rates,
        wiseMarkup,
        debugContext: {
          orderSource: order?.order_source || null,
          totalAmountBrl: Number(order?.total_amount) || 0,
          totalAmountUsd: Number(order?.total_amount_usd) || 0,
          chargeJpy: Number(chargeJpy) || 0,
          walletAppliedExistingJpy: Number(alreadyAppliedJpy) || 0,
          remainingJpy: Number(remainingJpy) || 0,
          amountUsdOverride: Number(amountUsdOverride) || 0,
        },
      })
      return res.status(200).json(parcelowCheckout)
    }
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: productName,
              description: productDesc,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}${successPath}?success=true`,
      cancel_url: `${baseUrl}${cancelPath}?canceled=true`,
      metadata: {
        orderId,
        ...(intentCheckoutId ? { storeCheckoutIntentId: String(intentCheckoutId) } : {}),
        orderSource: order.order_source || 'service',
        walletApplied: String(walletApplied || 0),
        acquisitionMode: order.acquisition_mode || 'none',
        affiliateId: order.affiliate_id ? String(order.affiliate_id) : '',
        referralId: order.referral_id ? String(order.referral_id) : '',
      },
    })
    return res.status(200).json({ url: session.url, provider: 'stripe' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

/**
 * Vercel Serverless Function - Create Stripe Checkout Session.
 * Busca o pedido no Supabase e usa o shipping_cost real para o pagamento do frete.
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const REQUEST_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 20
const rateLimitMemory = globalThis.__checkoutRateLimitMap ?? new Map()
globalThis.__checkoutRateLimitMap = rateLimitMemory
const FX_REFRESH_MS = 1000 * 60 * 60 // 1h
const fxRateCache = globalThis.__fxBrlPerJpyCache ?? { rate: null, updatedAt: 0 }
globalThis.__fxBrlPerJpyCache = fxRateCache

function normalizeBrlPerJpy(rawRate) {
  const n = Number(rawRate)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n >= 0.002 && n <= 0.5) return n
  if (n > 1) {
    const inv = 1 / n
    if (inv >= 0.002 && inv <= 0.5) return inv
  }
  return null
}

function getDayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10)
}

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

function getFxBrlPerJpy() {
  const v = Number(process.env.FX_BRL_PER_JPY || process.env.VITE_FX_BRL_PER_JPY)
  return normalizeBrlPerJpy(v) ?? 0.033
}

async function fetchBrlPerJpyFromProviders() {
  const providers = [
    {
      url: 'https://api.frankfurter.app/latest?from=JPY&to=BRL',
      read: (json) => Number(json?.rates?.BRL),
    },
    {
      url: 'https://economia.awesomeapi.com.br/json/last/JPY-BRL',
      read: (json) => Number(json?.JPYBRL?.bid),
    },
  ]
  for (const provider of providers) {
    try {
      const res = await fetch(provider.url, { cache: 'no-store' })
      if (!res.ok) continue
      const data = await res.json()
      const rate = normalizeBrlPerJpy(provider.read(data))
      if (rate) return rate
    } catch {
      // try next provider
    }
  }
  return null
}

async function getLiveFxBrlPerJpy() {
  const now = Date.now()
  const cached = normalizeBrlPerJpy(fxRateCache.rate)
  const dayChanged = fxRateCache.updatedAt > 0 && getDayKey(now) !== getDayKey(fxRateCache.updatedAt)
  if (cached && !dayChanged && now - fxRateCache.updatedAt < FX_REFRESH_MS) {
    return cached
  }
  const fetched = normalizeBrlPerJpy(await fetchBrlPerJpyFromProviders())
  if (fetched) {
    fxRateCache.rate = fetched
    fxRateCache.updatedAt = now
    return fetched
  }
  const fallback = getFxBrlPerJpy()
  fxRateCache.rate = fallback
  fxRateCache.updatedAt = now
  return fallback
}

async function toChargeAmountJpy(amount, currency) {
  const c = (currency || 'jpy').toLowerCase()
  const n = Number(amount) || 0
  if (n <= 0) return 0
  if (c === 'jpy') return n
  if (c === 'brl') {
    const fx = await getLiveFxBrlPerJpy()
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripe = getStripeClient()
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' })
  }

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

    // Carrinho (produtos da loja)
    if (body.type === 'cart') {
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
      const minJpy = 500 // ¥500
      const maxJpy = 500000 // ¥500.000
      if (amountJpy < minJpy || amountJpy > maxJpy) {
        return res.status(400).json({ error: 'Valor deve ser entre ¥500 e ¥500.000' })
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

    // Pagamento de frete (pedido)
    const orderId = body.orderId
    if (!orderId) {
      return res.status(400).json({ error: 'orderId ou type topup com amountCents é obrigatório' })
    }

    const { data: orderBase, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, status, shipping_cost, shipping_currency, quote_amount, quote_currency, total_amount, wallet_applied_amount, order_source, ship_immediately, acquisition_mode, referral_discount_amount, affiliate_id, referral_id')
      .eq('id', orderId)
      .single()

    if (orderError || !orderBase) {
      return res.status(404).json({ error: 'Pedido não encontrado' })
    }
    if (orderBase.user_id !== user.id) {
      return res.status(403).json({ error: 'Este pedido não pertence a você' })
    }
    if (orderBase.status !== 'awaiting_payment') {
      return res.status(400).json({ error: 'Este pedido não está aguardando pagamento' })
    }

    // Escolha manual entre referral e affiliate (ou none).
    const requestedAcquisitionMode = typeof body.acquisitionMode === 'string'
      ? body.acquisitionMode.trim().toLowerCase()
      : null
    if (requestedAcquisitionMode && ['none', 'referral', 'affiliate'].includes(requestedAcquisitionMode)) {
      const { data: applyData, error: applyErr } = await supabase.rpc('apply_order_acquisition', {
        p_order_id: orderId,
        p_user_id: user.id,
        p_mode: requestedAcquisitionMode,
        p_affiliate_code: body.affiliateCode || null,
      })
      if (applyErr) {
        return res.status(400).json({ error: applyErr.message || 'Erro ao aplicar origem da aquisição' })
      }
      if (applyData?.ok === false) {
        return res.status(400).json({ error: applyData?.error || 'Aquisição não elegível' })
      }
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, user_id, status, shipping_cost, shipping_currency, quote_amount, quote_currency, total_amount, wallet_applied_amount, order_source, ship_immediately, acquisition_mode, referral_discount_amount, affiliate_id, referral_id')
      .eq('id', orderId)
      .single()

    let amount, currency, productName, productDesc
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

    // Referral discount: configurado em BRL no painel e convertido quando necessário.
    if (order.acquisition_mode === 'referral') {
      const referralDiscountBrl = Math.max(0, Number(order.referral_discount_amount) || 0)
      if (referralDiscountBrl > 0) {
        if (currency === 'brl') {
          amount = Math.max(0, Number(amount) - referralDiscountBrl)
        } else {
          const fx = await getLiveFxBrlPerJpy()
          const discountJpy = referralDiscountBrl / fx
          amount = Math.max(0, Number(amount) - discountJpy)
        }
      }
    }

    const chargeJpy = await toChargeAmountJpy(amount, currency)
    const alreadyAppliedJpy = Math.max(0, Number(order.wallet_applied_amount) || 0)
    let walletApplied = 0
    let remainingJpy = Math.max(0, (Number(chargeJpy) || 0) - alreadyAppliedJpy)

    // Se o pedido já foi integralmente coberto por carteira anteriormente, não deve haver nova cobrança.
    if (remainingJpy <= 0) {
      return res.status(200).json({ paid: true, walletApplied: 0, alreadyPaidByWallet: alreadyAppliedJpy })
    }

    // Aplicar carteira (JPY) como parte do pagamento, quando solicitado.
    if (body.useWallet) {
      const accessToken = authHeader.replace('Bearer ', '')
      const supabaseUser = getSupabaseUser(accessToken)
      if (!supabaseUser) {
        return res.status(500).json({
          error: 'Carteira indisponível no momento (configuração da API incompleta). Nenhuma cobrança foi criada.',
        })
      }

      const requestedWalletAmount = Math.floor(Number(body.walletAmountJpy) || 0)
      const totalForWalletApply = requestedWalletAmount > 0
        ? Math.min(remainingJpy, requestedWalletAmount)
        : remainingJpy

      const { data: applyData, error: applyErr } = await supabaseUser.rpc('wallet_apply_to_order_jpy', {
        p_order_id: orderId,
        p_user_id: user.id,
        p_total_amount_jpy: totalForWalletApply,
      })
      if (applyErr) throw new Error(applyErr.message || 'Erro ao aplicar carteira')
      walletApplied = Number(applyData?.applied_amount) || 0
      remainingJpy = Number(applyData?.remaining_amount) || 0
      if (applyData?.paid === true || remainingJpy <= 0) {
        return res.status(200).json({ paid: true, walletApplied })
      }
    }

    const unitAmount = Math.round(remainingJpy) // JPY sem casas decimais
    if (!unitAmount || unitAmount <= 0) {
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
      return res.status(200).json({ paid: true, walletApplied, discounted: true })
    }

    // Centralizamos todos os pagamentos no carrinho/central de pagamentos.
    const successPath = '/app/cart'
    const cancelPath = '/app/cart'

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

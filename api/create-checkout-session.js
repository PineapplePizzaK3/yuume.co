/**
 * Vercel Serverless Function - Create Stripe Checkout Session.
 * Busca o pedido no Supabase e usa o shipping_cost real para o pagamento do frete.
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

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
  return v && v > 0 ? v : 0.033
}

function toChargeAmountJpy(amount, currency) {
  const c = (currency || 'jpy').toLowerCase()
  const n = Number(amount) || 0
  if (n <= 0) return 0
  if (c === 'jpy') return n
  if (c === 'brl') {
    const fx = getFxBrlPerJpy()
    return n / fx
  }
  return n
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
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

    const baseUrl = process.env.VITE_SITE_URL || req.headers.origin

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
      const amountCents = Math.round(Number(body.amountCents) || 0)
      const minCents = 500 // R$ 5,00
      const maxCents = 500000 // R$ 5.000
      if (amountCents < minCents || amountCents > maxCents) {
        return res.status(400).json({ error: 'Valor deve ser entre R$ 5,00 e R$ 5.000,00' })
      }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: 'Adicionar saldo - Carteira',
                description: 'Crédito na sua carteira virtual para pagar serviços, frete e loja.',
              },
              unit_amount: amountCents,
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

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, status, shipping_cost, shipping_currency, quote_amount, quote_currency, total_amount, order_source, ship_immediately')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return res.status(404).json({ error: 'Pedido não encontrado' })
    }
    if (order.user_id !== user.id) {
      return res.status(403).json({ error: 'Este pedido não pertence a você' })
    }
    if (order.status !== 'awaiting_payment') {
      return res.status(400).json({ error: 'Este pedido não está aguardando pagamento' })
    }

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

    // Cobrança sempre em JPY
    // (carteira BRL não é aplicada quando a cobrança é em JPY)
    const chargeJpy = toChargeAmountJpy(amount, currency)
    const unitAmount = Math.round(chargeJpy) // JPY sem casas decimais
    if (!unitAmount || unitAmount <= 0) return res.status(400).json({ error: 'Valor inválido para cobrança' })

    try {
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
        success_url: `${baseUrl}/app/orders?success=true`,
        cancel_url: `${baseUrl}/app/orders?canceled=true`,
        metadata: { orderId, orderSource: order.order_source || 'service' },
      })
      return res.status(200).json({ url: session.url, provider: 'stripe' })
    } catch (e) {
      // Fallback para KOMOJU (cartão) quando Stripe falhar
      const komojuKey = process.env.KOMOJU_SECRET_KEY
      if (!komojuKey) throw e
      const token = Buffer.from(`${komojuKey}:`, 'utf8').toString('base64')
      const returnUrl = `${baseUrl}/api/komoju-return?orderId=${encodeURIComponent(orderId)}`
      const komoju = await fetch('https://komoju.com/api/v1/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${token}`,
        },
        body: JSON.stringify({
          amount: unitAmount,
          currency: 'JPY',
          return_url: returnUrl,
          external_order_num: orderId,
          payment_types: ['credit_card'],
          description: `Pedido ${orderId.slice(0, 8)} - pagamento`,
        }),
      }).then(async (r) => {
        const json = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(json?.error || json?.message || 'Erro ao criar sessão na KOMOJU')
        return json
      })
      return res.status(200).json({ url: komoju.session_url, provider: 'komoju', fallback: true })
    }
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

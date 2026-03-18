/**
 * Stripe Webhook - Confirmação de pagamento.
 * Configurar no Stripe Dashboard: Webhooks > Add endpoint > checkout.session.completed
 * Usar STRIPE_WEBHOOK_SECRET do signing secret do webhook.
 *
 * Nota: Para Vercel, pode ser necessário configurar bodyParser: false no vercel.json
 * para esta rota, para que o body chegue como stream e a verificação do Stripe funcione.
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

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET not configured')
    return res.status(200).json({ received: true })
  }

  let rawBody
  try {
    rawBody = await getRawBody(req)
  } catch (e) {
    rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const supabase = getSupabaseAdmin()

    if (session.metadata?.type === 'topup' && session.metadata?.userId && supabase) {
      const userId = session.metadata.userId
      const amountTotal = session.amount_total != null ? session.amount_total / 100 : 0
      if (amountTotal > 0) {
        const { error } = await supabase.rpc('wallet_credit', {
          p_user_id: userId,
          p_amount: amountTotal,
          p_type: 'topup',
          p_description: 'Adição de saldo via cartão',
          p_reference_type: 'payment',
          p_reference_id: null,
        })
        if (error) console.error('Failed to credit wallet:', error)
      }
      return res.status(200).json({ received: true })
    }

    const orderId = session.metadata?.orderId
    if (orderId && supabase) {
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_source, ship_immediately')
        .eq('id', orderId)
        .single()

      const newStatus = order?.order_source === 'store' && order?.ship_immediately
        ? 'products_paid'  // Loja envio imediato: produtos pagos, aguardando frete
        : 'paid'
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .eq('status', 'awaiting_payment')

      if (error) {
        console.error('Failed to update order status:', error)
      }

      const currency = (session.currency || 'jpy').toLowerCase()
      const amount = session.amount_total
        ? currency === 'brl'
          ? session.amount_total / 100
          : session.amount_total
        : null

      await supabase.from('payments').insert({
        order_id: orderId,
        stripe_payment_id: session.payment_intent || session.id,
        status: 'completed',
        amount,
      })

      // Loja: se ship_immediately=false, adiciona produtos ao inventário
      if (order?.order_source === 'store' && !order?.ship_immediately && !error) {
        const { error: invErr } = await supabase.rpc('store_order_add_to_inventory', {
          p_order_id: orderId,
        })
        if (invErr) console.error('Failed to add store order to inventory:', invErr)
      }
    }
  }

  return res.status(200).json({ received: true })
}

/**
 * KOMOJU return URL handler.
 * KOMOJU appends ?session_id=... to this URL. We fetch the session and finalize the order.
 */
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function basicAuth(secretKey) {
  const token = Buffer.from(`${secretKey}:`, 'utf8').toString('base64')
  return `Basic ${token}`
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin()
  const secretKey = process.env.KOMOJU_SECRET_KEY
  if (!supabase || !secretKey) return res.status(500).send('Not configured')

  try {
    const orderId = req.query.orderId
    const sessionId = req.query.session_id
    if (!orderId || !sessionId) return res.status(400).send('Missing orderId or session_id')

    const session = await fetch(`https://komoju.com/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: { 'Authorization': basicAuth(secretKey) },
    }).then(async (r) => {
      const json = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(json?.error || json?.message || 'Erro ao consultar sessão na KOMOJU')
      return json
    })

    const isCompleted = session?.status === 'completed' || session?.status === 'complete'
    const paymentCaptured = session?.payment?.status === 'captured'

    if (isCompleted && paymentCaptured) {
      const { data: order } = await supabase
        .from('orders')
        .select('id, status, order_source, ship_immediately')
        .eq('id', orderId)
        .single()

      if (order?.status === 'awaiting_payment') {
        const newStatus = order?.order_source === 'store' && order?.ship_immediately ? 'products_paid' : 'paid'
        await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', orderId)
          .eq('status', 'awaiting_payment')
      }

      const amount = session?.amount
      await supabase.from('payments').insert({
        order_id: orderId,
        stripe_payment_id: session?.payment?.id ? `komoju:${session.payment.id}` : `komoju_session:${sessionId}`,
        status: 'completed',
        amount: amount != null ? Number(amount) : null,
      })

      if (order?.order_source === 'store' && !order?.ship_immediately) {
        await supabase.rpc('store_order_add_to_inventory', { p_order_id: orderId })
      }
    }

    const baseUrl = process.env.VITE_SITE_URL || req.headers.origin
    return res.writeHead(302, { Location: `${baseUrl}/app/orders?success=true` }).end()
  } catch (e) {
    const baseUrl = process.env.VITE_SITE_URL || req.headers.origin
    return res.writeHead(302, { Location: `${baseUrl}/app/orders?canceled=true` }).end()
  }
}


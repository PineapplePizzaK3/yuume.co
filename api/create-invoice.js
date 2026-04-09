/**
 * POST /api/create-invoice
 * Body: {
 *   "orderId"?: "uuid",
 *   "invoiceKind"?: "invoice" | "consolidation_invoice",
 *   "randomData"?: boolean
 * }
 */
import { createClient } from '@supabase/supabase-js'
import { ensureInvoiceForPaidOrder } from '../server-lib/invoiceGenerator.js'

function pickRandom(arr = []) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)] || null
}

async function pickRandomEligibleOrderForInvoiceKind(supabaseAdmin, invoiceKind) {
  const statuses = ['paid', 'products_paid', 'shipped', 'completed']
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, status, shipping_cost')
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .limit(300)
  if (!orders?.length) return null

  const ids = orders.map((o) => o.id).filter(Boolean)
  const { data: docs } = await supabaseAdmin
    .from('invoices')
    .select('order_id, invoice_kind')
    .in('order_id', ids)
    .in('invoice_kind', ['invoice', 'consolidation_invoice'])

  const byOrder = new Map()
  for (const row of docs || []) {
    if (!row?.order_id) continue
    const set = byOrder.get(row.order_id) || new Set()
    set.add(row.invoice_kind)
    byOrder.set(row.order_id, set)
  }

  const kind = String(invoiceKind || 'invoice')
  let candidates = []
  if (kind === 'consolidation_invoice') {
    candidates = orders.filter((o) => {
      const set = byOrder.get(o.id) || new Set()
      return Number(o.shipping_cost) > 0 && set.has('invoice') && !set.has('consolidation_invoice')
    })
    if (candidates.length === 0) {
      candidates = orders.filter((o) => {
        const set = byOrder.get(o.id) || new Set()
        return Number(o.shipping_cost) > 0 && !set.has('consolidation_invoice')
      })
    }
  } else {
    candidates = orders.filter((o) => {
      const set = byOrder.get(o.id) || new Set()
      return !set.has('invoice')
    })
  }

  return pickRandom(candidates)?.id || null
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function getSupabaseAnon() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getBearerUser(req) {
  const raw = String(req.headers.authorization || '')
  if (!raw.toLowerCase().startsWith('bearer ')) return null
  const token = raw.slice(7).trim()
  if (!token) return null
  const supabase = getSupabaseAnon()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const user = await getBearerUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' })
  }

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  const invoiceKind = typeof body.invoiceKind === 'string' ? body.invoiceKind.trim() : ''
  const useRandomData = body?.randomData === true

  let resolvedOrderId = orderId
  if (!resolvedOrderId && useRandomData) {
    resolvedOrderId = await pickRandomEligibleOrderForInvoiceKind(
      supabaseAdmin,
      invoiceKind || 'invoice'
    )
  }

  if (!resolvedOrderId) {
    return res.status(400).json({ error: 'orderId required' })
  }

  const result = await ensureInvoiceForPaidOrder(supabaseAdmin, resolvedOrderId, {
    invoiceKind: invoiceKind || undefined,
  })
  return res.status(200).json({
    ...result,
    order_id: resolvedOrderId,
    random_data_used: useRandomData,
  })
}

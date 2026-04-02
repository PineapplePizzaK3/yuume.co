/**
 * GET /api/invoices — lista faturas do usuário (admin: todas, ?userId= opcional).
 * GET /api/invoices?id=<uuid> — JSON da fatura (autorizado).
 * GET /api/invoices?id=<uuid>&format=pdf — download PDF.
 */
import { createClient } from '@supabase/supabase-js'
import { buildInvoicePdfBuffer } from './lib/invoicePdf.js'

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
  return { user: data.user, token }
}

async function isAdmin(supabaseAdmin, userId) {
  if (!supabaseAdmin || !userId) return false
  const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const auth = await getBearerUser(req)
  if (!auth?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const admin = await isAdmin(supabaseAdmin, auth.user.id)
  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : ''
  const format = typeof req.query?.format === 'string' ? req.query.format.trim().toLowerCase() : ''

  if (id) {
    const { data: row, error } = await supabaseAdmin
      .from('invoices')
      .select('id, order_id, user_id, invoice_number, data_json, invoice_kind, created_at')
      .eq('id', id)
      .maybeSingle()

    if (error || !row) {
      return res.status(404).json({ error: 'Invoice not found' })
    }
    if (!admin && row.user_id !== auth.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (format === 'pdf') {
      try {
        const buf = await buildInvoicePdfBuffer(row.data_json)
        const safeName = String(row.invoice_number || 'invoice').replace(/[^\w.-]+/g, '_')
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`)
        return res.status(200).send(buf)
      } catch (e) {
        console.error('invoice pdf:', e)
        return res.status(500).json({ error: 'PDF generation failed' })
      }
    }

    return res.status(200).json(row)
  }

  let q = supabaseAdmin
    .from('invoices')
    .select('id, order_id, user_id, invoice_number, invoice_kind, created_at, data_json')
    .eq('invoice_kind', 'invoice')
    .order('created_at', { ascending: false })
    .limit(200)

  if (!admin) {
    q = q.eq('user_id', auth.user.id)
  } else {
    const filterUser = typeof req.query?.userId === 'string' ? req.query.userId.trim() : ''
    if (filterUser) q = q.eq('user_id', filterUser)
  }

  const { data: list, error: listErr } = await q
  if (listErr) {
    return res.status(500).json({ error: listErr.message })
  }

  const slim = (list || []).map((r) => {
    const ps = r.data_json?.pricing_summary || {}
    return {
      id: r.id,
      order_id: r.order_id,
      user_id: r.user_id,
      invoice_number: r.invoice_number,
      created_at: r.created_at,
      total_paid_usd: ps.total_paid_usd,
      total_display_brl: ps.total_display_brl,
    }
  })

  return res.status(200).json({ invoices: slim })
}

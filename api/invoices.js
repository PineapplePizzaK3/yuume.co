/**
 * GET /api/invoices — lista documentos financeiros do usuário.
 * GET /api/invoices?id=<uuid> — JSON do documento (autorizado).
 * GET /api/invoices?orderId=<uuid> — documento mais recente do pedido (autorizado).
 * GET /api/invoices?id=<uuid>&format=pdf — download PDF.
 * GET /api/invoices?orderId=<uuid>&format=pdf — download PDF por pedido.
 *
 * POST /api/invoices
 * Body:
 * {
 *   "action": "create_invoice" | "ensure_invoice" | "create_credit_note" | "create_payout",
 *   ...payload
 * }
 */
import { createClient } from '@supabase/supabase-js'
import { buildInvoicePdfBuffer } from '../server-lib/invoicePdf.js'
import { ensureInvoiceForPaidOrder } from '../server-lib/invoiceGenerator.js'
import {
  buildRandomCreditNotePayload,
  buildRandomPayoutPayload,
  createCreditNoteDocument,
  createPayoutStatementDocument,
} from '../server-lib/financialDocumentGenerator.js'

const ALL_DOC_KINDS = ['invoice', 'consolidation_invoice', 'credit_note', 'payout_statement']

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

async function parseBody(req) {
  if (!req?.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return null
    }
  }
  if (typeof req.body === 'object') return req.body
  return {}
}

function pickRandom(arr = []) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)] || null
}

async function pickRandomEligibleOrderForInvoiceKind(supabaseAdmin, invoiceKind) {
  const statuses = ['paid', 'products_paid', 'shipped', 'completed']
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, shipping_cost')
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
    const oid = row?.order_id
    if (!oid) continue
    const set = byOrder.get(oid) || new Set()
    set.add(row.invoice_kind)
    byOrder.set(oid, set)
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

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
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

  if (req.method === 'POST') {
    if (!admin) return res.status(403).json({ error: 'Admin only' })
    const body = await parseBody(req)
    if (body == null) return res.status(400).json({ error: 'Invalid JSON' })

    const action = String(body.action || '').trim().toLowerCase()

    if (action === 'create_invoice' || action === 'ensure_invoice') {
      const invoiceKind = typeof body.invoiceKind === 'string' ? body.invoiceKind.trim() : ''
      const useRandomData = body?.randomData === true
      let orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
      if (!orderId && useRandomData) {
        orderId = await pickRandomEligibleOrderForInvoiceKind(
          supabaseAdmin,
          invoiceKind || 'invoice'
        )
      }
      if (!orderId) return res.status(400).json({ error: 'orderId required' })

      const result = await ensureInvoiceForPaidOrder(supabaseAdmin, orderId, {
        invoiceKind: invoiceKind || undefined,
      })
      return res.status(200).json({
        ...result,
        order_id: orderId,
        random_data_used: useRandomData,
      })
    }

    if (action === 'create_credit_note') {
      const useRandomData = body?.randomData === true
      let payload = { ...body }
      if (useRandomData) {
        const rnd = await buildRandomCreditNotePayload(supabaseAdmin)
        if (!rnd.ok) return res.status(400).json(rnd)
        payload = { ...rnd.payload, ...payload }
      }
      delete payload.action
      delete payload.randomData
      const result = await createCreditNoteDocument(supabaseAdmin, payload)
      if (!result.ok) return res.status(400).json(result)
      return res.status(200).json(result)
    }

    if (action === 'create_payout') {
      const useRandomData = body?.randomData === true
      let payload = { ...body }
      if (useRandomData) {
        const rnd = await buildRandomPayoutPayload(supabaseAdmin)
        if (!rnd.ok) return res.status(400).json(rnd)
        payload = { ...rnd.payload, ...payload }
      }
      delete payload.action
      delete payload.randomData
      const result = await createPayoutStatementDocument(supabaseAdmin, payload)
      if (!result.ok) return res.status(400).json(result)
      return res.status(200).json(result)
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : ''
  const orderId = typeof req.query?.orderId === 'string' ? req.query.orderId.trim() : ''
  const format = typeof req.query?.format === 'string' ? req.query.format.trim().toLowerCase() : ''
  const kindFilter = typeof req.query?.kind === 'string' ? req.query.kind.trim().toLowerCase() : ''
  const allowedKinds = ALL_DOC_KINDS
  const filteredKinds = allowedKinds.includes(kindFilter) ? [kindFilter] : allowedKinds
  const kindsForQuery = filteredKinds

  if (id || orderId) {
    let query = supabaseAdmin
      .from('invoices')
      .select('id, order_id, user_id, invoice_number, data_json, invoice_kind, created_at')
      .in('invoice_kind', kindsForQuery)

    if (id) {
      query = query.eq('id', id)
    } else {
      query = query
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
    }

    const { data: row, error } = await query.maybeSingle()

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
    .in('invoice_kind', kindsForQuery)
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

  const uniqueUserIds = Array.from(new Set((list || []).map((r) => r?.user_id).filter(Boolean)))
  let userNameById = new Map()
  if (uniqueUserIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .in('id', uniqueUserIds)
    userNameById = new Map(
      (users || []).map((u) => [u.id, String(u?.name || u?.email || '').trim() || null])
    )
  }

  const slim = (list || []).map((r) => {
    const ps = r.data_json?.pricing_summary || {}
    const fallbackName = String(r.data_json?.customer?.name || '').trim() || null
    const userName = userNameById.get(r.user_id) || fallbackName
    return {
      id: r.id,
      order_id: r.order_id,
      user_id: r.user_id,
      user_name: userName,
      invoice_number: r.invoice_number,
      invoice_kind: r.invoice_kind,
      document_subtype: r.data_json?.document_subtype || null,
      created_at: r.created_at,
      total_paid_usd: ps.total_paid_usd,
      total_display_brl: ps.total_display_brl,
    }
  })

  return res.status(200).json({ invoices: slim })
}

/**
 * POST /api/create-credit-note
 * Body:
 * {
 *   "originalInvoiceId"?: "uuid",
 *   "orderId"?: "uuid",
 *   "userId"?: "uuid",
 *   "amountCreditedUsd": number,
 *   "amountCreditedBrl": number,
 *   "paymentMethod"?: string,
 *   "currency"?: string,
 *   "transactionId"?: string,
 *   "reason"?: string,
 *   "randomData"?: boolean
 * }
 */
import { createClient } from '@supabase/supabase-js'
import {
  buildRandomCreditNotePayload,
  createCreditNoteDocument,
} from '../server-lib/financialDocumentGenerator.js'

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

  const useRandomData = body?.randomData === true
  let payload = body
  if (useRandomData) {
    const rnd = await buildRandomCreditNotePayload(supabaseAdmin)
    if (!rnd.ok) return res.status(400).json(rnd)
    payload = { ...rnd.payload, ...body }
  }
  delete payload.randomData

  const result = await createCreditNoteDocument(supabaseAdmin, payload)
  if (!result.ok) return res.status(400).json(result)
  return res.status(200).json(result)
}

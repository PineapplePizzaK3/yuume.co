import { randomUUID } from 'crypto'

function num(n, fallback = 0) {
  const x = Number(n)
  return Number.isFinite(x) ? x : fallback
}

function roundUsd(x) {
  return Math.round(num(x) * 10000) / 10000
}

function roundBrl(x) {
  return Math.round(num(x) * 100) / 100
}

function nowIso() {
  return new Date().toISOString()
}

function randomSuffix() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
}

function makeCreditNoteNumber() {
  const y = new Date().getFullYear()
  return `CN-${y}-${randomSuffix()}`
}

function makePayoutStatementNumber() {
  const y = new Date().getFullYear()
  return `PST-${y}-${randomSuffix()}`
}

function pickRandom(arr = []) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  const idx = Math.floor(Math.random() * arr.length)
  return arr[idx] || null
}

function randomTxn(prefix) {
  return `${prefix}_${Date.now()}_${randomSuffix()}`
}

export async function buildRandomCreditNotePayload(supabaseAdmin) {
  const { data: candidates, error } = await supabaseAdmin
    .from('invoices')
    .select('id, order_id, user_id, invoice_number, invoice_kind, data_json')
    .in('invoice_kind', ['invoice', 'consolidation_invoice'])
    .not('order_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error || !candidates?.length) {
    return { ok: false, error: 'No source invoices found for random credit note generation' }
  }
  const source = pickRandom(candidates)
  const totalUsd = num(
    source?.data_json?.pricing_summary?.total_usd ??
      source?.data_json?.pricing_summary?.total_paid_usd ??
      source?.data_json?.pricing_summary?.subtotal_usd,
    25
  )
  const totalBrl = num(
    source?.data_json?.pricing_summary?.total_brl ??
      source?.data_json?.pricing_summary?.total_display_brl,
    120
  )
  const pct = 0.1 + Math.random() * 0.35
  const amountUsd = roundUsd(Math.max(1, totalUsd * pct))
  const fx = totalUsd > 0 ? totalBrl / totalUsd : 5.3
  const amountBrl = roundBrl(Math.max(1, amountUsd * (fx > 0 ? fx : 5.3)))
  const reasons = ['Customer return', 'Order adjustment', 'Partial refund', 'Damaged item refund']
  const methods = ['Parcelow', 'Stripe', 'Wallet Adjustment']

  return {
    ok: true,
    payload: {
      originalInvoiceId: source.id,
      orderId: source.order_id,
      userId: source.user_id,
      amountCreditedUsd: amountUsd,
      amountCreditedBrl: amountBrl,
      paymentMethod: pickRandom(methods),
      currency: 'USD',
      transactionId: randomTxn('cn'),
      reason: pickRandom(reasons),
    },
  }
}

export async function buildRandomPayoutPayload(supabaseAdmin) {
  const { data: orderUsers, error } = await supabaseAdmin
    .from('orders')
    .select('id, user_id')
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error || !orderUsers?.length) {
    return { ok: false, error: 'No users found for random payout generation' }
  }
  const seed = pickRandom(orderUsers)
  const commissionUsd = roundUsd(5 + Math.random() * 45)
  const commissionBrl = roundBrl(commissionUsd * (5 + Math.random() * 1.2))
  const methods = ['Wise', 'PIX', 'Internal Transfer']

  return {
    ok: true,
    payload: {
      orderId: Math.random() > 0.35 ? seed.id : undefined,
      userId: seed.user_id,
      affiliateId: randomUUID(),
      commissionUsd,
      commissionBrl,
      paymentMethod: pickRandom(methods),
      transactionId: randomTxn('pst'),
    },
  }
}

export async function createCreditNoteDocument(supabaseAdmin, payload = {}) {
  const originalInvoiceId = String(payload.originalInvoiceId || '').trim()
  const explicitOrderId = String(payload.orderId || '').trim()
  const explicitUserId = String(payload.userId || '').trim()

  let original = null
  if (originalInvoiceId) {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, order_id, user_id, invoice_number, invoice_kind')
      .eq('id', originalInvoiceId)
      .maybeSingle()
    if (error || !data) {
      return { ok: false, error: 'Original invoice not found' }
    }
    original = data
  }

  const orderId = explicitOrderId || original?.order_id || null
  const userId = explicitUserId || original?.user_id || null

  if (!orderId || !userId) {
    return { ok: false, error: 'orderId and userId are required' }
  }

  const issueDate = String(payload.issueDate || '').trim() || nowIso()
  const amountCreditedUsd = roundUsd(payload.amountCreditedUsd)
  const amountCreditedBrl = roundBrl(payload.amountCreditedBrl)
  const paymentMethod = String(payload.paymentMethod || 'Adjustment').trim()
  const currency = String(payload.currency || 'USD').trim().toUpperCase()
  const transactionId = String(payload.transactionId || '').trim() || '—'
  const reason = String(payload.reason || '').trim() || null
  const creditNoteNumber = makeCreditNoteNumber()
  const rowId = randomUUID()

  const dataJson = {
    document_type: 'credit_note',
    document_subtype: 'refund_or_adjustment',
    original_invoice_id: original?.id || null,
    original_invoice_number: original?.invoice_number || null,
    credit_note_id: creditNoteNumber,
    order_id: orderId,
    user_id: userId,
    issue_date: issueDate,
    amount_credited_usd: amountCreditedUsd,
    amount_credited_brl: amountCreditedBrl,
    payment_method: paymentMethod,
    currency,
    transaction_id: transactionId,
    reason,
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('invoices')
    .insert({
      id: rowId,
      order_id: orderId,
      user_id: userId,
      invoice_number: creditNoteNumber,
      invoice_kind: 'credit_note',
      data_json: dataJson,
    })
    .select('id')
    .single()

  if (insErr) return { ok: false, error: insErr.message }
  return { ok: true, document_id: inserted.id, document_number: creditNoteNumber, invoice_kind: 'credit_note' }
}

export async function createPayoutStatementDocument(supabaseAdmin, payload = {}) {
  const explicitOrderId = String(payload.orderId || '').trim()
  let userId = String(payload.userId || '').trim()
  let orderId = explicitOrderId || null

  if (orderId && !userId) {
    const { data } = await supabaseAdmin.from('orders').select('user_id').eq('id', orderId).maybeSingle()
    userId = String(data?.user_id || '').trim()
  }

  if (!userId) {
    return { ok: false, error: 'userId required (or provide orderId linked to a user)' }
  }

  const issueDate = String(payload.issueDate || '').trim() || nowIso()
  const affiliateId = String(payload.affiliateId || '').trim() || null
  const commissionUsd = roundUsd(payload.commissionUsd)
  const commissionBrl = roundBrl(payload.commissionBrl)
  const paymentMethod = String(payload.paymentMethod || 'Wise').trim()
  const transactionId = String(payload.transactionId || '').trim() || '—'
  const payoutNumber = makePayoutStatementNumber()
  const rowId = randomUUID()

  const dataJson = {
    document_type: 'payout_statement',
    statement_id: payoutNumber,
    issue_date: issueDate,
    user_id: userId,
    order_id: orderId,
    affiliate_id: affiliateId,
    commission_usd: commissionUsd,
    commission_brl: commissionBrl,
    payment_method: paymentMethod,
    transaction_id: transactionId,
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('invoices')
    .insert({
      id: rowId,
      order_id: orderId,
      user_id: userId,
      invoice_number: payoutNumber,
      invoice_kind: 'payout_statement',
      data_json: dataJson,
    })
    .select('id')
    .single()

  if (insErr) return { ok: false, error: insErr.message }
  return {
    ok: true,
    document_id: inserted.id,
    document_number: payoutNumber,
    invoice_kind: 'payout_statement',
  }
}

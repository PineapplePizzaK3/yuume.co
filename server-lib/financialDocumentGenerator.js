import { randomUUID } from 'crypto'
import { getExchangeRates } from './exchangeRateService.js'
import { normalizeDocumentLocale, resolveUserDocumentLocale } from './documentLocale.js'

const BRL_NOTE =
  'BRL values are approximate and based on exchange rates at the time of purchase.'

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
  const documentLocale = payload?.documentLocale
    ? normalizeDocumentLocale(payload.documentLocale)
    : await resolveUserDocumentLocale(supabaseAdmin, userId, 'pt-BR')

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
    document_locale: documentLocale,
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

function normalizeManualItems(rawItems = []) {
  if (!Array.isArray(rawItems)) return []
  return rawItems
    .map((row) => {
      const itemName = String(row?.itemName ?? row?.item_name ?? row?.name ?? '').trim()
      const quantity = Math.max(1, Math.floor(num(row?.quantity, 1)))
      const unitPriceUsd = roundUsd(row?.unitPriceUsd ?? row?.unit_price_usd ?? row?.unitPrice ?? 0)
      if (!itemName || unitPriceUsd <= 0) return null
      return { itemName, quantity, unitPriceUsd }
    })
    .filter(Boolean)
}

const MANUAL_INVOICE_KINDS = new Set(['invoice', 'consolidation_invoice'])

function normalizeManualInvoiceKind(raw) {
  const k = String(raw || 'invoice').trim().toLowerCase()
  return MANUAL_INVOICE_KINDS.has(k) ? k : 'invoice'
}

function buildManualBillingBreakdown({
  subtotalUsd,
  serviceFeeUsd,
  shippingUsd,
  discountBrl,
  usdBrl,
  locale,
  invoiceKind,
}) {
  const components = []
  const add = (code, labelPt, labelEn, amountUsd, amountBrl = null) => {
    const usd = roundUsd(Math.max(0, amountUsd))
    if (usd <= 0) return
    components.push({
      code,
      label_pt: labelPt,
      label_en: labelEn,
      amount_usd: usd,
      amount_brl: roundBrl(amountBrl != null ? amountBrl : usd * usdBrl),
    })
  }
  if (invoiceKind === 'consolidation_invoice') {
    add('shipping_fee', 'Frete internacional', 'International shipping', shippingUsd)
    add('service_fee_redirect', 'Taxa de serviço', 'Service fee', serviceFeeUsd)
    add('products_subtotal', 'Subtotal de produtos', 'Products subtotal', subtotalUsd)
  } else {
    add('products_subtotal', 'Subtotal de produtos', 'Products subtotal', subtotalUsd)
    add('service_fee_redirect', 'Taxa de serviço', 'Service fee', serviceFeeUsd)
    add('shipping_fee', 'Frete internacional', 'International shipping', shippingUsd)
  }
  if (discountBrl > 0) {
    components.push({
      code: 'discount',
      label_pt: 'Desconto',
      label_en: 'Discount',
      amount_usd: 0,
      amount_brl: roundBrl(-discountBrl),
    })
  }
  return {
    flow_type: 'manual',
    formula_summary_pt:
      invoiceKind === 'consolidation_invoice'
        ? 'Fatura manual de consolidação (pedido externo à plataforma)'
        : 'Fatura manual (pedido externo à plataforma)',
    formula_summary_en:
      invoiceKind === 'consolidation_invoice'
        ? 'Manual consolidation invoice (off-platform order)'
        : 'Manual invoice (off-platform order)',
    components,
    document_locale: locale,
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  )
}

async function resolveManualInvoiceUserId(supabaseAdmin, payload = {}, opts = {}) {
  const fallbackUserId = String(opts.fallbackUserId || '').trim()
  const explicitUserId = String(payload.userId || '').trim()
  let userId = explicitUserId || fallbackUserId

  if (!userId || !isUuid(userId)) {
    return { ok: false, error: 'userId inválido. Deixe em branco para usar o admin ou informe um UUID válido.' }
  }

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (authErr || !authData?.user?.id) {
    if (explicitUserId && fallbackUserId && isUuid(fallbackUserId) && explicitUserId !== fallbackUserId) {
      const { data: fallbackData, error: fallbackErr } = await supabaseAdmin.auth.admin.getUserById(
        fallbackUserId
      )
      if (!fallbackErr && fallbackData?.user?.id) {
        return { ok: true, userId: fallbackData.user.id, usedFallback: true }
      }
    }
    return { ok: false, error: 'Usuário não encontrado para vincular a fatura.' }
  }

  return { ok: true, userId: authData.user.id, usedFallback: false }
}

/**
 * Cria fatura manual sem pedido na plataforma (order_id = null).
 * Útil para vendas/atendimentos fora do fluxo automático.
 */
export async function createManualInvoiceDocument(supabaseAdmin, payload = {}, opts = {}) {
  const userResolved = await resolveManualInvoiceUserId(supabaseAdmin, payload, opts)
  if (!userResolved.ok) return userResolved
  const userId = userResolved.userId
  const invoiceKind = normalizeManualInvoiceKind(payload.invoiceKind)

  const customerName = String(payload.customer?.name || payload.customerName || '').trim()
  const customerEmail = String(payload.customer?.email || payload.customerEmail || '').trim()
  const customerCountry = String(payload.customer?.country || payload.customerCountry || 'Brazil').trim()

  if (!customerName) {
    return { ok: false, error: 'customer.name is required' }
  }

  const normalizedItems = normalizeManualItems(payload.items)
  if (normalizedItems.length === 0) {
    return { ok: false, error: 'At least one line item with name and unitPriceUsd > 0 is required' }
  }

  const rates = await getExchangeRates(supabaseAdmin)
  const usdBrl = num(payload.exchangeRateUsdBrl ?? payload.usdBrl, num(rates?.usd_brl, 5.5))
  const jpyUsd = num(rates?.jpy_usd, 0.0066)

  const documentLocale = payload?.documentLocale
    ? normalizeDocumentLocale(payload.documentLocale)
    : await resolveUserDocumentLocale(supabaseAdmin, userId, 'pt-BR')

  const issueDate = String(payload.issueDate || '').trim() || nowIso()
  const paymentDate = String(payload.paymentDate || '').trim() || issueDate
  const externalReference = String(payload.externalReference || payload.external_reference || '').trim() || null
  const paymentMethod = String(payload.paymentMethod || 'Manual').trim()
  const transactionId = String(payload.transactionId || '').trim() || '—'
  const notes = String(payload.notes || '').trim() || null

  const serviceFeeUsd = roundUsd(payload.serviceFeeUsd ?? payload.service_fee_usd ?? 0)
  const shippingUsd = roundUsd(payload.shippingUsd ?? payload.shipping_usd ?? 0)
  const discountBrl = roundBrl(payload.discountBrl ?? payload.discount_brl ?? 0)

  const items = normalizedItems.map((row) => {
    const unitPriceBrl = roundBrl(row.unitPriceUsd * usdBrl)
    return {
      item_name: row.itemName,
      quantity: row.quantity,
      unit_price_usd: row.unitPriceUsd,
      unit_price_brl: unitPriceBrl,
      unit_price_jpy: roundUsd(row.unitPriceUsd / jpyUsd),
    }
  })

  const subtotalUsd = roundUsd(
    items.reduce((sum, it) => sum + num(it.unit_price_usd) * num(it.quantity), 0)
  )
  const totalPaidUsd = roundUsd(subtotalUsd + serviceFeeUsd + shippingUsd)
  const totalDisplayBrl = roundBrl(
    payload.totalDisplayBrl != null
      ? payload.totalDisplayBrl
      : totalPaidUsd * usdBrl - discountBrl
  )

  const subtotalBrl = roundBrl(subtotalUsd * usdBrl)
  const serviceFeeBrl = roundBrl(serviceFeeUsd * usdBrl)
  const shippingBrl = roundBrl(shippingUsd * usdBrl)

  const { data: invNo, error: rpcErr } = await supabaseAdmin.rpc('next_invoice_number')
  if (rpcErr) console.error('next_invoice_number failed:', rpcErr)
  let invoiceNumber =
    typeof invNo === 'string' && invNo.startsWith('INV-')
      ? invNo
      : `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  if (invoiceKind === 'consolidation_invoice' && !/-CON$/.test(invoiceNumber)) {
    invoiceNumber = `${invoiceNumber}-CON`
  }

  const companyName = String(process.env.INVOICE_COMPANY_NAME || 'YuumeCo').trim()
  const supportContact =
    String(process.env.INVOICE_SUPPORT_EMAIL || process.env.VITE_CONTACT_EMAIL || 'support@yuume.co').trim()

  const rowId = randomUUID()
  const dataJson = {
    schema_version: 1,
    document_type: 'invoice',
    document_subtype: invoiceKind === 'consolidation_invoice' ? 'consolidation' : 'manual',
    invoice_id: rowId,
    invoice_number: invoiceNumber,
    order_id: null,
    external_reference: externalReference,
    user_id: userId,
    issue_date: issueDate,
    payment_date: paymentDate,
    document_locale: documentLocale,
    customer: {
      name: customerName,
      email: customerEmail || '—',
      country: customerCountry || 'Brazil',
    },
    items,
    pricing_summary: {
      subtotal_usd: subtotalUsd,
      subtotal_brl: subtotalBrl,
      service_fee_usd: serviceFeeUsd,
      service_fee_brl: serviceFeeBrl,
      shipping_usd: shippingUsd,
      shipping_brl: shippingBrl,
      discount_brl: discountBrl,
      total_paid_usd: totalPaidUsd,
      total_display_brl: totalDisplayBrl,
      total_usd: totalPaidUsd,
      total_brl: totalDisplayBrl,
      payment_method: paymentMethod,
      transaction_id: transactionId,
    },
    service_fees: {
      service_type:
        invoiceKind === 'consolidation_invoice' ? 'consolidation_fee' : 'manual_off_platform',
      service_fee_usd: serviceFeeUsd,
      service_fee_brl: serviceFeeBrl,
    },
    billing_breakdown: buildManualBillingBreakdown({
      subtotalUsd,
      serviceFeeUsd,
      shippingUsd,
      discountBrl,
      usdBrl,
      locale: documentLocale,
      invoiceKind,
    }),
    currency_info: {
      exchange_rate_usd_brl: usdBrl,
      exchange_rate_jpy_usd: jpyUsd,
      rates_source: rates?.source || 'manual',
      rates_captured_at: rates?.updated_at || issueDate,
      note: BRL_NOTE,
    },
    payment: {
      payment_method: paymentMethod,
      currency: 'USD',
      transaction_id: transactionId,
    },
    footer: {
      company_name: companyName,
      support_contact: supportContact,
      disclaimer:
        'International purchase. Import duties, taxes, and customs clearance may apply in your country and are the responsibility of the buyer unless otherwise stated.',
    },
    order_flow_type: invoiceKind === 'consolidation_invoice' ? 'manual_consolidation' : 'manual',
    notes,
    shipping_fee: {
      shipping_method: 'standard',
      shipping_fee_usd: shippingUsd,
      shipping_fee_brl: shippingBrl,
    },
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('invoices')
    .insert({
      id: rowId,
      order_id: null,
      user_id: userId,
      invoice_number: invoiceNumber,
      invoice_kind: invoiceKind,
      data_json: dataJson,
    })
    .select('id')
    .single()

  if (insErr) {
    const msg = String(insErr.message || 'Insert failed')
    if (/order_id.*not-null|null value in column "order_id"/i.test(msg)) {
      return {
        ok: false,
        error:
          'Banco ainda exige order_id em invoices. Aplique a migration 130_manual_invoices_null_order.sql no Supabase.',
      }
    }
    return { ok: false, error: msg }
  }
  return {
    ok: true,
    invoice_id: inserted.id,
    invoice_number: invoiceNumber,
    invoice_kind: invoiceKind,
    manual: true,
  }
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
  const documentLocale = payload?.documentLocale
    ? normalizeDocumentLocale(payload.documentLocale)
    : await resolveUserDocumentLocale(supabaseAdmin, userId, 'pt-BR')

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
    document_locale: documentLocale,
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

/**
 * Gera snapshot de fatura (JSON) e persiste em public.invoices.
 * Idempotente: não duplica fatura para o mesmo pedido (invoice_kind = invoice).
 * Emite quando orders.status estiver em estado de pagamento confirmado.
 */
import { randomUUID } from 'crypto'
import { getExchangeRates } from './exchangeRateService.js'
import {
  chargeJpyUsdRate,
  jpyEquivalentFromFinalUsd,
  jpyToFinalUsd,
  usdToBrlDisplay,
} from './pricingEngine.js'
import { resolveWiseWithdrawalMarkupPercent } from './wiseWithdrawalMarkup.js'

const SCHEMA_VERSION = 1
const BRL_NOTE =
  'BRL values are approximate and based on exchange rates at the time of purchase.'
const INVOICE_KIND_STANDARD = 'invoice'
const INVOICE_KIND_CONSOLIDATION = 'consolidation_invoice'
const INVOICE_KIND_SET = new Set([INVOICE_KIND_STANDARD, INVOICE_KIND_CONSOLIDATION])
const REDIR_ASSISTIDO_FEE_PERCENT = 15
const PERSONAL_SHOPPING_FEE_PERCENT = 25
const GRUPO_COMPRAS_FEE_PERCENT = 20
const GRUPO_COMPRAS_FEE_PER_UNIT_USD = 1.9
const SERVICE_FEE_JPY_PER_ITEM = 250

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

function roundJpy(x) {
  return Math.round(num(x) * 100) / 100
}

function normalizeInvoiceKind(raw) {
  const k = String(raw || '').trim().toLowerCase()
  if (!k) return null
  return INVOICE_KIND_SET.has(k) ? k : null
}

function resolveOrderFlowType(order) {
  const source = String(order?.order_source || '').toLowerCase()
  const mod = String(order?.order_module || '').toLowerCase()
  if (source === 'store') return 'virtual_store'
  if (['assisted_buy', 'redir-assistido', 'assisted_redirect'].includes(mod)) return 'assisted_redirect'
  if (['personal_shopping', 'personal-shopping'].includes(mod)) return 'personal_shopping'
  if (['group_purchase', 'group_buy', 'purchase_group'].includes(mod)) return 'group_purchase'
  return 'classic_redirect'
}

function resolveServiceTypeLabel(order, invoiceKind) {
  if (invoiceKind === INVOICE_KIND_CONSOLIDATION) return 'consolidation_fee'
  const flow = resolveOrderFlowType(order)
  if (flow === 'assisted_redirect') return 'assisted_redirect_service_fee'
  if (flow === 'personal_shopping') return 'personal_shopping_service_fee'
  if (flow === 'group_purchase') return 'group_purchase_service_fee'
  if (flow === 'virtual_store') return 'product_only'
  return 'classic_redirect_service_fee'
}

function computeRedirectionPerItemFeeJpy(totalItems) {
  const qty = Math.max(0, Math.floor(num(totalItems) || 0))
  if (qty <= 0) return 0
  if (qty === 1) return 1000
  if (qty <= 4) return 750 * qty
  return 500 * qty
}

function clampNonNegativeUsd(value) {
  return roundUsd(Math.max(0, num(value)))
}

function buildBillingBreakdown({
  order,
  invoiceKind,
  flowType,
  itemsCount,
  subtotalUsd,
  shippingUsd,
  serviceFeeUsd,
  totalPaidUsd,
  totalDisplayBrl,
  discountBrl,
  walletAppliedBrl,
  usdBrl,
  jpyUsd,
  wiseMarkup,
}) {
  const components = []
  const add = (code, labelPt, labelEn, amountUsd, amountBrl, notePt = null, noteEn = null) => {
    components.push({
      code,
      label_pt: labelPt,
      label_en: labelEn,
      amount_usd: clampNonNegativeUsd(amountUsd),
      amount_brl: roundBrl(Math.max(0, num(amountBrl))),
      note_pt: notePt,
      note_en: noteEn,
    })
  }

  add('products_subtotal', 'Subtotal de produtos', 'Products subtotal', subtotalUsd, subtotalUsd * usdBrl)

  const qty = Math.max(0, Math.floor(num(itemsCount)))
  if (invoiceKind === INVOICE_KIND_CONSOLIDATION) {
    add(
      'shipping_fee',
      'Frete internacional',
      'International shipping',
      shippingUsd,
      shippingUsd * usdBrl,
      'Documento de consolidacao/frete',
      'Consolidation/shipping document'
    )
  } else if (flowType === 'assisted_redirect') {
    const estimatedPercentUsd = clampNonNegativeUsd(subtotalUsd * (REDIR_ASSISTIDO_FEE_PERCENT / 100))
    const estimatedPerItemJpy = computeRedirectionPerItemFeeJpy(qty)
    const estimatedPerItemUsd = clampNonNegativeUsd(jpyToFinalUsd(estimatedPerItemJpy, jpyUsd, wiseMarkup))
    const estimatedTotal = clampNonNegativeUsd(estimatedPercentUsd + estimatedPerItemUsd)
    add(
      'service_fee_assisted',
      'Taxa de servico assistido',
      'Assisted service fee',
      serviceFeeUsd,
      serviceFeeUsd * usdBrl,
      `${REDIR_ASSISTIDO_FEE_PERCENT}% sobre produtos + taxa por item (escada)`,
      `${REDIR_ASSISTIDO_FEE_PERCENT}% over products + tiered per-item fee`
    )
    add(
      'service_fee_assisted_formula_estimate',
      'Estimativa da formula',
      'Formula estimate',
      estimatedTotal,
      estimatedTotal * usdBrl,
      `Itens: ${qty}; escada JPY aplicada`,
      `Items: ${qty}; tiered JPY fee applied`
    )
  } else if (flowType === 'personal_shopping') {
    const percentUsd = clampNonNegativeUsd(subtotalUsd * (PERSONAL_SHOPPING_FEE_PERCENT / 100))
    const perItemUsd = clampNonNegativeUsd(jpyToFinalUsd(SERVICE_FEE_JPY_PER_ITEM * qty, jpyUsd, wiseMarkup))
    const estimatedTotal = clampNonNegativeUsd(percentUsd + perItemUsd)
    add(
      'service_fee_personal',
      'Taxa de personal shopping',
      'Personal shopping fee',
      serviceFeeUsd,
      serviceFeeUsd * usdBrl,
      `${PERSONAL_SHOPPING_FEE_PERCENT}% sobre produtos + ¥${SERVICE_FEE_JPY_PER_ITEM} por item`,
      `${PERSONAL_SHOPPING_FEE_PERCENT}% over products + ¥${SERVICE_FEE_JPY_PER_ITEM} per item`
    )
    add(
      'service_fee_personal_formula_estimate',
      'Estimativa da formula',
      'Formula estimate',
      estimatedTotal,
      estimatedTotal * usdBrl,
      `Itens: ${qty}`,
      `Items: ${qty}`
    )
  } else if (flowType === 'group_purchase') {
    const percentUsd = clampNonNegativeUsd(subtotalUsd * (GRUPO_COMPRAS_FEE_PERCENT / 100))
    const perUnitUsd = clampNonNegativeUsd(GRUPO_COMPRAS_FEE_PER_UNIT_USD * qty)
    const estimatedTotal = clampNonNegativeUsd(percentUsd + perUnitUsd)
    add(
      'service_fee_group',
      'Taxa de grupo de compras',
      'Group purchase fee',
      serviceFeeUsd,
      serviceFeeUsd * usdBrl,
      `${GRUPO_COMPRAS_FEE_PERCENT}% sobre produtos + $${GRUPO_COMPRAS_FEE_PER_UNIT_USD} por unidade`,
      `${GRUPO_COMPRAS_FEE_PERCENT}% over products + $${GRUPO_COMPRAS_FEE_PER_UNIT_USD} per unit`
    )
    add(
      'service_fee_group_formula_estimate',
      'Estimativa da formula',
      'Formula estimate',
      estimatedTotal,
      estimatedTotal * usdBrl,
      `Unidades: ${qty}`,
      `Units: ${qty}`
    )
  } else if (flowType === 'classic_redirect') {
    const perItemJpy = computeRedirectionPerItemFeeJpy(qty)
    const perItemUsd = clampNonNegativeUsd(jpyToFinalUsd(perItemJpy, jpyUsd, wiseMarkup))
    add(
      'service_fee_redirect',
      'Taxa de redirecionamento',
      'Redirect fee',
      serviceFeeUsd,
      serviceFeeUsd * usdBrl,
      'Taxa por item (escada)',
      'Tiered per-item fee'
    )
    add(
      'service_fee_redirect_formula_estimate',
      'Estimativa da formula',
      'Formula estimate',
      perItemUsd,
      perItemUsd * usdBrl,
      `Itens: ${qty}; total tabela JPY: ${Math.round(perItemJpy)}`,
      `Items: ${qty}; JPY table total: ${Math.round(perItemJpy)}`
    )
  } else if (flowType === 'virtual_store') {
    if (serviceFeeUsd > 0) {
      add(
        'store_service_or_markup',
        'Taxa/plataforma da loja',
        'Store platform/markup fee',
        serviceFeeUsd,
        serviceFeeUsd * usdBrl
      )
    }
  } else if (serviceFeeUsd > 0) {
    add('service_fee', 'Taxa de servico', 'Service fee', serviceFeeUsd, serviceFeeUsd * usdBrl)
  }

  if (shippingUsd > 0) {
    add('shipping_fee', 'Frete internacional', 'International shipping', shippingUsd, shippingUsd * usdBrl)
  }

  if (discountBrl > 0) {
    add(
      'discount',
      'Desconto aplicado',
      'Applied discount',
      clampNonNegativeUsd(discountBrl / usdBrl),
      roundBrl(discountBrl)
    )
  }

  if (walletAppliedBrl > 0) {
    add(
      'wallet_credit',
      'Credito de carteira usado',
      'Wallet credit used',
      clampNonNegativeUsd(walletAppliedBrl / usdBrl),
      roundBrl(walletAppliedBrl)
    )
  }

  return {
    flow_type: flowType,
    formula_summary_pt:
      flowType === 'assisted_redirect'
        ? 'Produtos + taxa assistida (percentual) + taxa por item + frete'
        : flowType === 'personal_shopping'
          ? 'Produtos + taxa personal (percentual) + ¥250 por item + frete'
          : flowType === 'group_purchase'
            ? 'Produtos + taxa grupo (percentual) + taxa por unidade + frete'
            : flowType === 'virtual_store'
              ? 'Preco de produtos da loja + frete (quando aplicavel)'
              : flowType === 'classic_redirect'
                ? 'Produtos + taxa de redirecionamento por item + frete'
                : 'Composicao de cobranca por servico',
    formula_summary_en:
      flowType === 'assisted_redirect'
        ? 'Products + assisted fee (percentage) + per-item fee + shipping'
        : flowType === 'personal_shopping'
          ? 'Products + personal fee (percentage) + ¥250 per item + shipping'
          : flowType === 'group_purchase'
            ? 'Products + group fee (percentage) + per-unit fee + shipping'
            : flowType === 'virtual_store'
              ? 'Store product prices + shipping (when applicable)'
              : flowType === 'classic_redirect'
                ? 'Products + per-item redirect fee + shipping'
                : 'Charge composition by service',
    components,
    totals: {
      total_paid_usd: roundUsd(totalPaidUsd),
      total_display_brl: roundBrl(totalDisplayBrl),
    },
  }
}

function paymentsTotalUsd(payments, jpyUsd, usdBrl, wiseMarkup) {
  let s = 0
  for (const p of payments) {
    const cur = String(p.currency || 'JPY').toUpperCase()
    const amt = num(p.amount)
    if (cur === 'USD') s += amt
    else if (cur === 'BRL') s += amt / usdBrl
    else s += jpyToFinalUsd(amt, jpyUsd, wiseMarkup)
  }
  return roundUsd(s)
}

/** Classifica meio de pagamento a partir das linhas em payments (completed). */
export function classifyPayments(payments = []) {
  const ids = payments.map((p) => String(p.stripe_payment_id || ''))
  const labels = []
  if (ids.some((i) => i.startsWith('parcelow_'))) labels.push('Parcelow')
  if (ids.some((i) => /wallet/i.test(i))) labels.push('Carteira (JPY)')
  if (ids.some((i) => i === 'referral_discount' || i === 'coupon_discount')) labels.push('Desconto')
  if (ids.some((i) => /pix/i.test(i))) labels.push('PIX')
  const cardLike = payments.some((p) => {
    const id = String(p.stripe_payment_id || '')
    if (!id || /wallet|parcelow|referral_discount|coupon_discount|pix/i.test(id)) return false
    return ['JPY', 'BRL', 'USD'].includes(String(p.currency || '').toUpperCase())
  })
  if (cardLike && !labels.includes('Parcelow')) labels.push('Stripe')
  const method = labels.length ? labels.join(' + ') : 'Pagamento'
  const transactionId = ids.filter(Boolean).join(' | ') || '—'
  return { payment_method: method, transaction_id: transactionId }
}

/**
 * Monta data_json e insere fatura (service role).
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string, invoice_id?: string, error?: string }>}
 */
export async function ensureInvoiceForPaidOrder(supabaseAdmin, orderId, options = {}) {
  if (!supabaseAdmin || !orderId) {
    return { ok: false, skipped: true, reason: 'missing_params' }
  }

  const requestedKind = normalizeInvoiceKind(options?.invoiceKind)

  const { data: existingRows } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, invoice_kind, created_at')
    .eq('order_id', orderId)
    .in('invoice_kind', [INVOICE_KIND_STANDARD, INVOICE_KIND_CONSOLIDATION])
    .order('created_at', { ascending: true })

  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select(
      `
      id,
      user_id,
      status,
      order_source,
      order_module,
      ship_immediately,
      total_amount,
      total_amount_usd,
      shipping_cost,
      shipping_currency,
      quote_amount,
      quote_currency,
      discount_amount,
      wallet_applied_amount,
      created_at,
      order_items (
        id,
        quantity,
        price_at_purchase,
        product:products ( id, name, price_jpy, price_usd, price_brl, price )
      )
    `
    )
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    return { ok: false, skipped: true, reason: 'order_not_found', error: orderErr?.message }
  }

  const status = String(order.status || '').toLowerCase()
  if (!['paid', 'products_paid'].includes(status)) {
    return { ok: false, skipped: true, reason: 'not_eligible_status' }
  }

  const standardRow = (existingRows || []).find((r) => r.invoice_kind === INVOICE_KIND_STANDARD) || null
  const consolidationRow =
    (existingRows || []).find((r) => r.invoice_kind === INVOICE_KIND_CONSOLIDATION) || null

  let invoiceKind = requestedKind
  if (!invoiceKind) {
    if (!standardRow?.id) {
      invoiceKind = INVOICE_KIND_STANDARD
    } else {
      return {
        ok: true,
        skipped: true,
        reason: 'duplicate',
        invoice_id: consolidationRow?.id || standardRow.id,
        invoice_number: consolidationRow?.invoice_number || standardRow?.invoice_number || null,
      }
    }
  }

  if (invoiceKind === INVOICE_KIND_STANDARD && standardRow?.id) {
    return {
      ok: true,
      skipped: true,
      reason: 'duplicate',
      invoice_id: standardRow.id,
      invoice_number: standardRow.invoice_number || null,
    }
  }
  if (invoiceKind === INVOICE_KIND_CONSOLIDATION && consolidationRow?.id) {
    return {
      ok: true,
      skipped: true,
      reason: 'duplicate',
      invoice_id: consolidationRow.id,
      invoice_number: consolidationRow.invoice_number || null,
    }
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('name, email')
    .eq('id', order.user_id)
    .maybeSingle()

  const { data: paymentsRaw } = await supabaseAdmin
    .from('payments')
    .select('id, stripe_payment_id, status, amount, currency, created_at')
    .eq('order_id', orderId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  const payments = paymentsRaw || []
  const rates = await getExchangeRates(supabaseAdmin)
  const jpyUsd = num(rates?.jpy_usd, 0.0066)
  const usdBrl = num(rates?.usd_brl, 5.5)
  const wiseMarkup = await resolveWiseWithdrawalMarkupPercent(supabaseAdmin)

  const payClass = classifyPayments(payments)
  const paymentDates = payments.map((p) => p.created_at).filter(Boolean)
  const paymentDate =
    paymentDates.length > 0 ? paymentDates[paymentDates.length - 1] : new Date().toISOString()
  const issueDate = new Date().toISOString()

  const items = []
  let subtotalUsdFromLines = 0
  let itemsCount = 0

  const oiList = order.order_items || []
  if (oiList.length > 0) {
    for (const line of oiList) {
      const qty = Math.max(1, Math.floor(num(line.quantity, 1)))
      itemsCount += qty
      const p = line.product || {}
      const name = (p.name && String(p.name).trim()) || 'Item'
      const jpyUnit = roundJpy(line.price_at_purchase ?? p.price_jpy ?? p.price ?? 0)
      const usdCatalog = num(p.price_usd, 0)
      const usdUnit =
        usdCatalog > 0 ? roundUsd(usdCatalog) : roundUsd(jpyToFinalUsd(jpyUnit, jpyUsd, wiseMarkup))
      const brlUnit = roundBrl(usdToBrlDisplay(usdUnit, usdBrl))
      subtotalUsdFromLines += usdUnit * qty
      items.push({
        item_name: name,
        quantity: qty,
        unit_price_jpy: jpyUnit,
        unit_price_usd: usdUnit,
        unit_price_brl: brlUnit,
      })
    }
  } else {
    const src = order.order_source === 'store' ? 'Loja' : 'Serviço'
    let label = `${src} — Pedido ${String(orderId).slice(0, 8)}`
    let jpyU = 0
    let usdU = 0
    let brlU = 0

    if (order.quote_amount != null && num(order.quote_amount) > 0) {
      label = `Orçamento / Personal Shopping — ${String(orderId).slice(0, 8)}`
      const qc = String(order.quote_currency || 'JPY').toUpperCase()
      const q = num(order.quote_amount)
      if (qc === 'BRL') {
        brlU = roundBrl(q)
        usdU = roundUsd(brlU / usdBrl)
        jpyU = roundJpy(jpyEquivalentFromFinalUsd(usdU, jpyUsd, wiseMarkup))
      } else {
        jpyU = roundJpy(q)
        usdU = roundUsd(jpyToFinalUsd(jpyU, jpyUsd, wiseMarkup))
        brlU = roundBrl(usdToBrlDisplay(usdU, usdBrl))
      }
    } else if (order.shipping_cost != null && num(order.shipping_cost) > 0) {
      label = `Frete internacional — ${String(orderId).slice(0, 8)}`
      const sc = String(order.shipping_currency || 'JPY').toUpperCase()
      const s = num(order.shipping_cost)
      if (sc === 'BRL') {
        brlU = roundBrl(s)
        usdU = roundUsd(brlU / usdBrl)
        jpyU = roundJpy(jpyEquivalentFromFinalUsd(usdU, jpyUsd, wiseMarkup))
      } else {
        jpyU = roundJpy(s)
        usdU = roundUsd(jpyToFinalUsd(jpyU, jpyUsd, wiseMarkup))
        brlU = roundBrl(usdToBrlDisplay(usdU, usdBrl))
      }
    } else {
      usdU = roundUsd(num(order.total_amount_usd))
      if (usdU <= 0) {
        for (const pay of payments) {
          const cur = String(pay.currency || 'JPY').toUpperCase()
          const amt = num(pay.amount)
          if (cur === 'USD') usdU += amt
          else if (cur === 'BRL') usdU += amt / usdBrl
          else usdU += jpyToFinalUsd(amt, jpyUsd, wiseMarkup)
        }
        usdU = roundUsd(usdU)
      }
      brlU = roundBrl(usdToBrlDisplay(usdU, usdBrl))
    }

    items.push({
      item_name: label,
      quantity: 1,
      unit_price_jpy: jpyU,
      unit_price_usd: usdU,
      unit_price_brl: brlU,
    })
    itemsCount = 1
    subtotalUsdFromLines = usdU
  }

  subtotalUsdFromLines = roundUsd(subtotalUsdFromLines)

  const fromPaymentsUsd = paymentsTotalUsd(payments, jpyUsd, usdBrl, wiseMarkup)
  let totalPaidUsd = roundUsd(order.total_amount_usd)
  if (!totalPaidUsd || totalPaidUsd <= 0) {
    totalPaidUsd = fromPaymentsUsd > 0 ? fromPaymentsUsd : subtotalUsdFromLines
  } else if (fromPaymentsUsd > 0) {
    totalPaidUsd = roundUsd(Math.max(totalPaidUsd, fromPaymentsUsd))
  }

  const discountBrl = roundBrl(order.discount_amount || 0)
  const totalDisplayBrl =
    order.total_amount != null && num(order.total_amount) > 0
      ? roundBrl(order.total_amount)
      : roundBrl(usdToBrlDisplay(totalPaidUsd, usdBrl))

  let shippingUsd = 0
  const shipC = num(order.shipping_cost)
  if (shipC > 0) {
    const scur = String(order.shipping_currency || 'JPY').toUpperCase()
    if (scur === 'BRL') shippingUsd = roundUsd(shipC / usdBrl)
    else shippingUsd = roundUsd(jpyToFinalUsd(shipC, jpyUsd, wiseMarkup))
  }

  let serviceFeeUsd = roundUsd(totalPaidUsd - subtotalUsdFromLines - shippingUsd)
  if (serviceFeeUsd < 0) serviceFeeUsd = 0

  const subtotalBrl = roundBrl(usdToBrlDisplay(subtotalUsdFromLines, usdBrl))
  const serviceFeeBrl = roundBrl(usdToBrlDisplay(serviceFeeUsd, usdBrl))
  const shippingBrl = roundBrl(usdToBrlDisplay(shippingUsd, usdBrl))

  const { data: invNo, error: rpcErr } = await supabaseAdmin.rpc('next_invoice_number')
  if (rpcErr) {
    console.error('next_invoice_number failed:', rpcErr)
  }
  let invoiceNumber =
    typeof invNo === 'string' && invNo.startsWith('INV-')
      ? invNo
      : `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  if (invoiceKind === INVOICE_KIND_CONSOLIDATION && !/-CON$/.test(invoiceNumber)) {
    invoiceNumber = `${invoiceNumber}-CON`
  }

  const companyName = String(process.env.INVOICE_COMPANY_NAME || 'EIKO DLS').trim()
  const supportContact =
    String(process.env.INVOICE_SUPPORT_EMAIL || process.env.VITE_CONTACT_EMAIL || 'suporte@exemplo.com').trim()

  const invoiceRowId = randomUUID()

  const dataJson = {
    schema_version: SCHEMA_VERSION,
    document_type: 'invoice',
    document_subtype: invoiceKind === INVOICE_KIND_CONSOLIDATION ? 'consolidation' : 'phase_1',
    invoice_id: invoiceRowId,
    invoice_number: invoiceNumber,
    order_id: orderId,
    user_id: order.user_id,
    issue_date: issueDate,
    payment_date: paymentDate,
    customer: {
      name: profile?.name || '—',
      email: profile?.email || '—',
      country: 'Brazil',
    },
    items,
    pricing_summary: {
      subtotal_usd: subtotalUsdFromLines,
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
      payment_method: payClass.payment_method,
      transaction_id: payClass.transaction_id,
    },
    service_fees: {
      service_type: resolveServiceTypeLabel(order, invoiceKind),
      service_fee_usd: serviceFeeUsd,
      service_fee_brl: serviceFeeBrl,
    },
    billing_breakdown: buildBillingBreakdown({
      order,
      invoiceKind,
      flowType: resolveOrderFlowType(order),
      itemsCount,
      subtotalUsd: subtotalUsdFromLines,
      shippingUsd,
      serviceFeeUsd,
      totalPaidUsd,
      totalDisplayBrl,
      discountBrl,
      walletAppliedBrl: roundBrl(order.wallet_applied_amount || 0),
      usdBrl,
      jpyUsd,
      wiseMarkup,
    }),
    currency_info: {
      exchange_rate_usd_brl: usdBrl,
      exchange_rate_jpy_usd: jpyUsd,
      exchange_rate_jpy_usd_charge: chargeJpyUsdRate(jpyUsd, wiseMarkup),
      wise_usd_jpy_withdrawal_markup_percent: wiseMarkup,
      rates_source: rates?.source || 'unknown',
      rates_captured_at: rates?.updated_at || issueDate,
      note: BRL_NOTE,
    },
    payment: {
      payment_method: payClass.payment_method,
      currency: 'USD',
      transaction_id: payClass.transaction_id,
      gateway_rows: payments.map((p) => ({
        id: p.id,
        reference: p.stripe_payment_id,
        amount: p.amount,
        currency: p.currency,
        created_at: p.created_at,
      })),
    },
    footer: {
      company_name: companyName,
      support_contact: supportContact,
      disclaimer:
        'International purchase. Import duties, taxes, and customs clearance may apply in your country and are the responsibility of the buyer unless otherwise stated.',
    },
    order_flow_type: resolveOrderFlowType(order),
    shipping_fee: {
      shipping_method: order.ship_immediately ? 'express' : 'standard',
      shipping_fee_usd: shippingUsd,
      shipping_fee_brl: shippingBrl,
    },
    references:
      invoiceKind === INVOICE_KIND_CONSOLIDATION && standardRow?.id
        ? { original_invoice_id: standardRow.id }
        : undefined,
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('invoices')
    .insert({
      id: invoiceRowId,
      order_id: orderId,
      user_id: order.user_id,
      invoice_number: invoiceNumber,
      data_json: dataJson,
      invoice_kind: invoiceKind,
    })
    .select('id')
    .single()

  if (insErr) {
    if (
      String(insErr.code || insErr.message || '').includes('23505') ||
      String(insErr.message || '').includes('invoices_one_standard_per_order') ||
      String(insErr.message || '').includes('invoices_one_consolidation_per_order')
    ) {
      return { ok: true, skipped: true, reason: 'duplicate_race' }
    }
    console.error('invoice insert failed:', insErr)
    return { ok: false, error: insErr.message }
  }

  return { ok: true, invoice_id: inserted.id, invoice_number: invoiceNumber, invoice_kind: invoiceKind }
}

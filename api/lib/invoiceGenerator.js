/**
 * Gera snapshot de fatura (JSON) e persiste em public.invoices.
 * Idempotente: não duplica fatura para o mesmo pedido (invoice_kind = invoice).
 * Só emite quando orders.status = 'paid' (não products_paid).
 */
import { randomUUID } from 'crypto'
import { getExchangeRates } from './exchangeRateService.js'
import {
  getPricingPercentsFromEnv,
  pricingMultiplierFromPercents,
  jpyToFinalUsd,
  usdToBrlDisplay,
} from './pricingEngine.js'

const SCHEMA_VERSION = 1
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

function roundJpy(x) {
  return Math.round(num(x) * 100) / 100
}

async function getPricingMultiplier(supabase) {
  const { data: rows } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'pricing_margin_percent',
      'pricing_platform_fee_percent',
      'pricing_jpy_usd_buffer_percent',
    ])
  const map = Object.fromEntries((rows || []).map((r) => [r.key, r.value]))
  const env = getPricingPercentsFromEnv()
  return pricingMultiplierFromPercents({
    marginPercent: num(map.pricing_margin_percent?.amount, env.marginPercent),
    platformFeePercent: num(map.pricing_platform_fee_percent?.amount, env.platformFeePercent),
    bufferPercent: num(map.pricing_jpy_usd_buffer_percent?.amount, env.bufferPercent),
  })
}

function paymentsTotalUsd(payments, jpyUsd, usdBrl, multiplier) {
  let s = 0
  for (const p of payments) {
    const cur = String(p.currency || 'JPY').toUpperCase()
    const amt = num(p.amount)
    if (cur === 'USD') s += amt
    else if (cur === 'BRL') s += amt / usdBrl
    else s += jpyToFinalUsd(amt, jpyUsd, multiplier)
  }
  return roundUsd(s)
}

/** Classifica meio de pagamento a partir das linhas em payments (completed). */
export function classifyPayments(payments = []) {
  const ids = payments.map((p) => String(p.stripe_payment_id || ''))
  const labels = []
  if (ids.some((i) => i.startsWith('parcelow_'))) labels.push('Parcelow')
  if (ids.some((i) => /wallet/i.test(i))) labels.push('Carteira (JPY)')
  if (ids.some((i) => i === 'referral_discount')) labels.push('Desconto indicação')
  if (ids.some((i) => /pix/i.test(i))) labels.push('PIX')
  const cardLike = payments.some((p) => {
    const id = String(p.stripe_payment_id || '')
    if (!id || /wallet|parcelow|referral_discount|pix/i.test(id)) return false
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
export async function ensureInvoiceForPaidOrder(supabaseAdmin, orderId) {
  if (!supabaseAdmin || !orderId) {
    return { ok: false, skipped: true, reason: 'missing_params' }
  }

  const { data: dup } = await supabaseAdmin
    .from('invoices')
    .select('id')
    .eq('order_id', orderId)
    .eq('invoice_kind', 'invoice')
    .maybeSingle()

  if (dup?.id) {
    return { ok: true, skipped: true, reason: 'duplicate', invoice_id: dup.id }
  }

  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select(
      `
      id,
      user_id,
      status,
      order_source,
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

  if (order.status !== 'paid') {
    return { ok: false, skipped: true, reason: 'not_paid_status' }
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
  const multiplier = await getPricingMultiplier(supabaseAdmin)

  const payClass = classifyPayments(payments)
  const paymentDates = payments.map((p) => p.created_at).filter(Boolean)
  const paymentDate =
    paymentDates.length > 0 ? paymentDates[paymentDates.length - 1] : new Date().toISOString()
  const issueDate = new Date().toISOString()

  const items = []
  let subtotalUsdFromLines = 0

  const oiList = order.order_items || []
  if (oiList.length > 0) {
    for (const line of oiList) {
      const qty = Math.max(1, Math.floor(num(line.quantity, 1)))
      const p = line.product || {}
      const name = (p.name && String(p.name).trim()) || 'Item'
      const jpyUnit = roundJpy(line.price_at_purchase ?? p.price_jpy ?? p.price ?? 0)
      const usdCatalog = num(p.price_usd, 0)
      const usdUnit =
        usdCatalog > 0 ? roundUsd(usdCatalog) : roundUsd(jpyToFinalUsd(jpyUnit, jpyUsd, multiplier))
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
        jpyU = roundJpy(usdU / (jpyUsd * multiplier))
      } else {
        jpyU = roundJpy(q)
        usdU = roundUsd(jpyToFinalUsd(jpyU, jpyUsd, multiplier))
        brlU = roundBrl(usdToBrlDisplay(usdU, usdBrl))
      }
    } else if (order.shipping_cost != null && num(order.shipping_cost) > 0) {
      label = `Frete internacional — ${String(orderId).slice(0, 8)}`
      const sc = String(order.shipping_currency || 'JPY').toUpperCase()
      const s = num(order.shipping_cost)
      if (sc === 'BRL') {
        brlU = roundBrl(s)
        usdU = roundUsd(brlU / usdBrl)
        jpyU = roundJpy(usdU / (jpyUsd * multiplier))
      } else {
        jpyU = roundJpy(s)
        usdU = roundUsd(jpyToFinalUsd(jpyU, jpyUsd, multiplier))
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
          else usdU += jpyToFinalUsd(amt, jpyUsd, multiplier)
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
    subtotalUsdFromLines = usdU
  }

  subtotalUsdFromLines = roundUsd(subtotalUsdFromLines)

  const fromPaymentsUsd = paymentsTotalUsd(payments, jpyUsd, usdBrl, multiplier)
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
    else shippingUsd = roundUsd(jpyToFinalUsd(shipC, jpyUsd, multiplier))
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
  const invoiceNumber =
    typeof invNo === 'string' && invNo.startsWith('INV-')
      ? invNo
      : `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

  const companyName = String(process.env.INVOICE_COMPANY_NAME || 'EIKO DLS').trim()
  const supportContact =
    String(process.env.INVOICE_SUPPORT_EMAIL || process.env.VITE_CONTACT_EMAIL || 'suporte@exemplo.com').trim()

  const invoiceRowId = randomUUID()

  const dataJson = {
    schema_version: SCHEMA_VERSION,
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
    },
    currency_info: {
      exchange_rate_usd_brl: usdBrl,
      exchange_rate_jpy_usd: jpyUsd,
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
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('invoices')
    .insert({
      id: invoiceRowId,
      order_id: orderId,
      user_id: order.user_id,
      invoice_number: invoiceNumber,
      data_json: dataJson,
      invoice_kind: 'invoice',
    })
    .select('id')
    .single()

  if (insErr) {
    if (
      String(insErr.code || insErr.message || '').includes('23505') ||
      String(insErr.message || '').includes('invoices_one_standard_per_order')
    ) {
      return { ok: true, skipped: true, reason: 'duplicate_race' }
    }
    console.error('invoice insert failed:', insErr)
    return { ok: false, error: insErr.message }
  }

  return { ok: true, invoice_id: inserted.id, invoice_number: invoiceNumber }
}

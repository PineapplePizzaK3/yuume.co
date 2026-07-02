import { calcularFreteEMS } from '../data/tabelaFreteEMS'
import { calcularFreteEPacket } from '../data/fretesJPPost'

export const SHIPPING_MODE_LOTE = 'lote'
export const SHIPPING_MODE_DIRETO = 'direto'
export const DIRECT_METHOD_EMS = 'ems'
export const DIRECT_METHOD_EPACKET = 'epacket'

export const LOTE_EMS_RATE_TABLE = [
  { loteKg: 1, totalEmsYen: 5100, costPerGramYen: 5.1 },
  { loteKg: 2, totalEmsYen: 8100, costPerGramYen: 4.05 },
  { loteKg: 3, totalEmsYen: 11100, costPerGramYen: 3.7 },
  { loteKg: 5, totalEmsYen: 17100, costPerGramYen: 3.42 },
  { loteKg: 10, totalEmsYen: 29700, costPerGramYen: 2.97 },
  { loteKg: 15, totalEmsYen: 41700, costPerGramYen: 2.78 },
  { loteKg: 20, totalEmsYen: 53700, costPerGramYen: 2.69 },
  { loteKg: 25, totalEmsYen: 65700, costPerGramYen: 2.63 },
  { loteKg: 30, totalEmsYen: 77700, costPerGramYen: 2.59 },
]

/** IOF padrão (3,5%). */
export const DEFAULT_IOF_PERCENT = 3.5

export const PAYMENT_GATEWAYS = {
  stripe: { id: 'stripe', label: 'Stripe', defaultFeePercent: 4.99 },
  parcelow: { id: 'parcelow', label: 'Parcelow', defaultFeePercent: 5.49 },
  glin: { id: 'glin', label: 'Glin', defaultFeePercent: 4.99 },
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function roundYen(n) {
  return Math.round(Number(n) || 0)
}

export function toWeightGrams(value, unit = 'g') {
  const raw = Number(value) || 0
  if (raw <= 0) return 0
  if (String(unit).toLowerCase() === 'kg') return Math.round(raw * 1000)
  return Math.round(raw)
}

export function resolveBrlPerJpyFromSettings(settings = {}) {
  const jpyUsd = Number(settings?.fx_jpy_usd?.amount)
  const usdBrl = Number(settings?.fx_usd_brl?.amount)
  if (Number.isFinite(jpyUsd) && jpyUsd > 0 && Number.isFinite(usdBrl) && usdBrl > 0) {
    return jpyUsd * usdBrl
  }
  const direct = Number(settings?.fx_brl_per_jpy?.amount)
  if (Number.isFinite(direct) && direct > 0) return direct
  return 0
}

export function getLoteRateRow(loteKg) {
  const kg = Number(loteKg) || 0
  return LOTE_EMS_RATE_TABLE.find((row) => row.loteKg === kg) || null
}

export function computeInternationalShippingYen({
  shippingMode = SHIPPING_MODE_LOTE,
  directMethod = DIRECT_METHOD_EMS,
  productWeightGrams = 0,
  loteKg = 1,
}) {
  const grams = Math.max(0, Math.round(Number(productWeightGrams) || 0))
  if (grams <= 0) return { valueYen: 0, note: 'peso_invalido' }

  if (shippingMode === SHIPPING_MODE_LOTE) {
    const row = getLoteRateRow(loteKg)
    if (!row) return { valueYen: 0, note: 'faixa_lote_invalida' }
    return {
      valueYen: roundYen(grams * row.costPerGramYen),
      note: `lote_ems_${row.loteKg}kg`,
      loteRatePerGram: row.costPerGramYen,
    }
  }

  if (directMethod === DIRECT_METHOD_EPACKET) {
    if (grams > 2000) {
      return {
        valueYen: 0,
        note: 'epacket_limite_2kg',
      }
    }
    return {
      valueYen: roundYen(calcularFreteEPacket(grams)),
      note: 'direto_epacket',
    }
  }

  return {
    valueYen: roundYen(calcularFreteEMS(grams)),
    note: 'direto_ems',
  }
}

/**
 * Valor a cobrar do cliente para receber `netAmountBrl` líquido após taxa do gateway.
 * Ex.: net R$100 com taxa 5% → cobrar R$105,26 (gross-up).
 */
export function grossUpForPaymentFee(netAmountBrl, feePercent) {
  const net = Math.max(0, Number(netAmountBrl) || 0)
  const fee = Math.max(0, Number(feePercent) || 0)
  if (net <= 0) {
    return { netBrl: 0, feeBrl: 0, chargeBrl: 0, feePercent: round2(fee) }
  }
  if (fee <= 0) {
    return { netBrl: round2(net), feeBrl: 0, chargeBrl: round2(net), feePercent: 0 }
  }
  if (fee >= 100) {
    return { netBrl: round2(net), feeBrl: 0, chargeBrl: round2(net), feePercent: round2(fee) }
  }
  const charge = net / (1 - fee / 100)
  return {
    netBrl: round2(net),
    feeBrl: round2(charge - net),
    chargeBrl: round2(charge),
    feePercent: round2(fee),
  }
}

export function resolvePaymentFeePercent(gatewayId, feePercents = {}) {
  const gateway = PAYMENT_GATEWAYS[gatewayId]
  if (!gateway) return 0
  const raw = feePercents[gatewayId]
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed >= 0) return parsed
  return gateway.defaultFeePercent
}

export function computePaymentCharges(netAmountBrl, feePercents = {}) {
  return Object.values(PAYMENT_GATEWAYS).map((gateway) => {
    const feePercent = resolvePaymentFeePercent(gateway.id, feePercents)
    const quote = grossUpForPaymentFee(netAmountBrl, feePercent)
    return {
      id: gateway.id,
      label: gateway.label,
      feePercent: quote.feePercent,
      netBrl: quote.netBrl,
      feeBrl: quote.feeBrl,
      chargeBrl: quote.chargeBrl,
    }
  })
}

export function calculateBrazilFinalPrice(input = {}) {
  const baseCostYen = Math.max(0, Number(input.baseCostYen) || 0)
  const declaredValueYenRaw = Math.max(0, Number(input.declaredValueYen) || 0)
  // Valor aduaneiro: se declarado vazio, usa custo base.
  const declaredValueYen = declaredValueYenRaw > 0 ? declaredValueYenRaw : baseCostYen
  const weightGrams = Math.max(0, Math.round(Number(input.weightGrams) || 0))
  const marginPercent = Math.max(0, Number(input.marginPercent) || 0)
  const packagingBrl = Math.max(0, Number(input.packagingBrl) || 0)
  const localShippingBrl = Math.max(0, Number(input.localShippingBrl) || 0)
  const customsFactor = Math.max(0, Number(input.customsFactor) || 2)
  const brlPerJpy = Math.max(0, Number(input.brlPerJpy) || 0)
  const applyIof = Boolean(input.applyIof)
  const iofPercent = Math.max(0, Number(input.iofPercent ?? DEFAULT_IOF_PERCENT) || 0)

  const shipping = computeInternationalShippingYen({
    shippingMode: input.shippingMode,
    directMethod: input.directMethod,
    productWeightGrams: weightGrams,
    loteKg: input.loteKg,
  })

  // Regra de negócio:
  // - custo base é somado ao final
  // - fator aduaneiro incide somente sobre (declarado + frete internacional)
  const taxableYen = declaredValueYen + shipping.valueYen
  const taxedYen = taxableYen * customsFactor
  const beforeTaxYen = baseCostYen + taxableYen
  const landedCostYen = baseCostYen + taxedYen
  const landedCostBrl = landedCostYen * brlPerJpy
  const marginBrl = landedCostBrl * (marginPercent / 100)
  const subtotalWithMarginBrl = landedCostBrl + marginBrl
  const baseFinalBrl = subtotalWithMarginBrl + packagingBrl + localShippingBrl
  const iofBrl = applyIof ? baseFinalBrl * (iofPercent / 100) : 0
  const finalBrl = baseFinalBrl + iofBrl
  const paymentCharges = computePaymentCharges(finalBrl, input.paymentFeePercents || {})
  const netProfitBrl = baseFinalBrl - landedCostBrl

  return {
    inputs: {
      baseCostYen: roundYen(baseCostYen),
      declaredValueYen: roundYen(declaredValueYen),
      weightGrams,
      shippingMode: input.shippingMode,
      directMethod: input.directMethod,
      loteKg: Number(input.loteKg) || null,
      marginPercent: round2(marginPercent),
      customsFactor: round2(customsFactor),
      brlPerJpy: round2(brlPerJpy),
      packagingBrl: round2(packagingBrl),
      localShippingBrl: round2(localShippingBrl),
      applyIof,
      iofPercent: round2(iofPercent),
      paymentFeePercents: {
        stripe: round2(resolvePaymentFeePercent('stripe', input.paymentFeePercents)),
        parcelow: round2(resolvePaymentFeePercent('parcelow', input.paymentFeePercents)),
        glin: round2(resolvePaymentFeePercent('glin', input.paymentFeePercents)),
      },
    },
    shipping: {
      yen: roundYen(shipping.valueYen),
      note: shipping.note,
      loteRatePerGram: shipping.loteRatePerGram || null,
    },
    breakdown: {
      beforeTaxYen: roundYen(beforeTaxYen),
      taxableYen: roundYen(taxableYen),
      taxedYen: roundYen(taxedYen),
      landedCostYen: roundYen(landedCostYen),
      landedCostBrl: round2(landedCostBrl),
      marginBrl: round2(marginBrl),
      subtotalWithMarginBrl: round2(subtotalWithMarginBrl),
      extrasBrl: round2(packagingBrl + localShippingBrl),
      baseFinalBrl: round2(baseFinalBrl),
      iofBrl: round2(iofBrl),
      finalBrl: round2(finalBrl),
      netProfitBrl: round2(netProfitBrl),
    },
    paymentCharges,
    isValid:
      (baseCostYen > 0 || declaredValueYenRaw > 0)
      && weightGrams > 0
      && brlPerJpy > 0
      && shipping.valueYen > 0,
  }
}

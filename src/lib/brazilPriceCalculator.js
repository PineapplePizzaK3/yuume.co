import { calcularFreteEMS } from '../data/tabelaFreteEMS'
import { calcularFreteEPacket, calcularFreteParcel } from '../data/fretesJPPost'

export const SHIPPING_MODE_LOTE = 'lote'
export const SHIPPING_MODE_DIRETO = 'direto'
export const DIRECT_METHOD_EMS = 'ems'
export const DIRECT_METHOD_EPACKET = 'epacket'
export const DIRECT_METHOD_AIRMAIL = 'airmail'

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
  // Defaults calibrados a partir das simulacoes reais enviadas.
  parcelow: { id: 'parcelow', label: 'Parcelow', defaultFeePercent: 7.46 },
  glin: { id: 'glin', label: 'Glin', defaultFeePercent: 6.1 },
}

const GLIN_CARD_INSTALLMENT_FEE_DEFAULTS = [
  8.68, // 1x
  11.6, // 2x
  12.55, // 3x
  13.49, // 4x
  14.41, // 5x
  15.32, // 6x
  15.53, // 7x
  16.34, // 8x
  17.14, // 9x
  17.93, // 10x
  18.7, // 11x
  19.47, // 12x
]

const PARCELOW_CARD_INSTALLMENT_FEE_DEFAULTS = [
  10.45, // 1x
  14.16, // 2x
  14.99, // 3x
  15.82, // 4x
  16.65, // 5x
  17.42, // 6x
  18.29, // 7x
  18.98, // 8x
  19.87, // 9x
  20.73, // 10x
  21.62, // 11x
  22.49, // 12x
]

export const PAYMENT_METHODS = [
  {
    id: 'stripe_card',
    gatewayId: 'stripe',
    label: 'Stripe · Cartão',
    defaultFeePercent: PAYMENT_GATEWAYS.stripe.defaultFeePercent,
    defaultFixedFeeUsd: 0,
  },
  {
    id: 'parcelow_pix',
    gatewayId: 'parcelow',
    label: 'Parcelow · PIX',
    defaultFeePercent: 7.46,
    defaultFixedFeeUsd: 1.99,
  },
  {
    id: 'parcelow_ted',
    gatewayId: 'parcelow',
    label: 'Parcelow · TED',
    defaultFeePercent: 7.02,
    defaultFixedFeeUsd: 1.99,
  },
  ...PARCELOW_CARD_INSTALLMENT_FEE_DEFAULTS.map((feePercent, idx) => {
    const installment = idx + 1
    return {
      id: `parcelow_card_${installment}x`,
      gatewayId: 'parcelow',
      label: `Parcelow · Cartão ${installment}x`,
      installments: installment,
      defaultFeePercent: feePercent,
      defaultFixedFeeUsd: 1.99,
    }
  }),
  {
    id: 'glin_pix',
    gatewayId: 'glin',
    label: 'Glin · PIX',
    defaultFeePercent: 6.1,
    defaultFixedFeeUsd: 0,
  },
  ...GLIN_CARD_INSTALLMENT_FEE_DEFAULTS.map((feePercent, idx) => {
    const installment = idx + 1
    return {
      id: `glin_card_${installment}x`,
      gatewayId: 'glin',
      label: `Glin · Cartão ${installment}x`,
      installments: installment,
      defaultFeePercent: feePercent,
      defaultFixedFeeUsd: 0,
    }
  }),
]

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

  if (directMethod === DIRECT_METHOD_AIRMAIL) {
    if (grams > 30000) {
      return {
        valueYen: 0,
        note: 'airmail_limite_30kg',
      }
    }
    return {
      valueYen: roundYen(calcularFreteParcel(grams, 'aereo')),
      note: 'direto_airmail',
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
export function grossUpForPaymentFee(netAmountBrl, feePercent, fixedFeeBrl = 0) {
  const net = Math.max(0, Number(netAmountBrl) || 0)
  const fee = Math.max(0, Number(feePercent) || 0)
  const fixed = Math.max(0, Number(fixedFeeBrl) || 0)
  if (net <= 0) {
    return {
      netBrl: 0,
      feeBrl: 0,
      variableFeeBrl: 0,
      fixedFeeBrl: round2(fixed),
      chargeBrl: 0,
      feePercent: round2(fee),
    }
  }
  if (fee <= 0 && fixed <= 0) {
    return {
      netBrl: round2(net),
      feeBrl: 0,
      variableFeeBrl: 0,
      fixedFeeBrl: 0,
      chargeBrl: round2(net),
      feePercent: 0,
    }
  }
  if (fee >= 100) {
    return {
      netBrl: round2(net),
      feeBrl: 0,
      variableFeeBrl: 0,
      fixedFeeBrl: round2(fixed),
      chargeBrl: round2(net),
      feePercent: round2(fee),
    }
  }
  const charge = (net + fixed) / (1 - fee / 100)
  const variableFee = charge * (fee / 100)
  return {
    netBrl: round2(net),
    feeBrl: round2(charge - net),
    variableFeeBrl: round2(variableFee),
    fixedFeeBrl: round2(fixed),
    chargeBrl: round2(charge),
    feePercent: round2(fee),
  }
}

export function resolvePaymentFeePercent(methodId, feePercents = {}) {
  const method = PAYMENT_METHODS.find((m) => m.id === methodId)
  if (!method) return 0
  const direct = Number(feePercents[methodId])
  if (Number.isFinite(direct) && direct >= 0) return direct
  // Compatibilidade: se vier formato antigo por gateway, reutiliza.
  const byGateway = Number(feePercents[method.gatewayId])
  if (Number.isFinite(byGateway) && byGateway >= 0) return byGateway
  return method.defaultFeePercent
}

export function resolvePaymentFixedFeeUsd(methodId, fixedUsdByMethod = {}) {
  const method = PAYMENT_METHODS.find((m) => m.id === methodId)
  if (!method) return 0
  const direct = Number(fixedUsdByMethod[methodId])
  if (Number.isFinite(direct) && direct >= 0) return direct
  const byGateway = Number(fixedUsdByMethod[method.gatewayId])
  if (Number.isFinite(byGateway) && byGateway >= 0) return byGateway
  return Math.max(0, Number(method.defaultFixedFeeUsd) || 0)
}

export function computePaymentCharges(netAmountBrl, feePercents = {}, fixedUsdByMethod = {}, usdBrl = 0) {
  const usdRate = Math.max(0, Number(usdBrl) || 0)
  return PAYMENT_METHODS.map((method) => {
    const feePercent = resolvePaymentFeePercent(method.id, feePercents)
    const fixedFeeUsd = resolvePaymentFixedFeeUsd(method.id, fixedUsdByMethod)
    const fixedFeeBrl = usdRate > 0 ? fixedFeeUsd * usdRate : 0
    const quote = grossUpForPaymentFee(netAmountBrl, feePercent, fixedFeeBrl)
    const installments = Math.max(0, Math.round(Number(method.installments) || 0))
    const installmentBrl = installments > 0 ? round2(quote.chargeBrl / installments) : null
    return {
      id: method.id,
      gatewayId: method.gatewayId,
      label: method.label,
      installments: installments || null,
      installmentBrl,
      feePercent: quote.feePercent,
      fixedFeeUsd: round2(fixedFeeUsd),
      fixedFeeBrl: quote.fixedFeeBrl,
      variableFeeBrl: quote.variableFeeBrl,
      netBrl: quote.netBrl,
      feeBrl: quote.feeBrl,
      chargeBrl: quote.chargeBrl,
    }
  })
}

export function calculateBrazilFinalPrice(input = {}) {
  const paymentFeePercentsInput = input.paymentFeePercents || {}
  const paymentFixedUsdByMethodInput = input.paymentFixedUsdByMethod || {}
  const quantity = Math.max(1, Math.round(Number(input.quantity) || 1))
  const unitBaseCostYen = Math.max(0, Number(input.baseCostYen) || 0)
  // Valor digitado no formulário (0 = campo vazio). Não confundir com o valor efetivo usado no cálculo.
  const unitDeclaredValueInput = Math.max(0, Number(input.declaredValueYen) || 0)
  // Valor aduaneiro unitário efetivo: se declarado vazio, usa custo base.
  const unitDeclaredValueYen = unitDeclaredValueInput > 0 ? unitDeclaredValueInput : unitBaseCostYen
  const unitWeightGrams = Math.max(0, Math.round(Number(input.weightGrams) || 0))
  const baseCostYen = unitBaseCostYen * quantity
  const declaredValueYen = unitDeclaredValueYen * quantity
  const weightGrams = unitWeightGrams * quantity
  const marginPercent = Math.max(0, Number(input.marginPercent) || 0)
  const packagingBrl = Math.max(0, Number(input.packagingBrl) || 0)
  const localShippingBrl = Math.max(0, Number(input.localShippingBrl) || 0)
  const customsFactor = Math.max(0, Number(input.customsFactor) || 2)
  const brlPerJpy = Math.max(0, Number(input.brlPerJpy) || 0)
  const usdBrl = Math.max(0, Number(input.usdBrl) || 0)
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
  // - valor antes da alfândega = produto + frete + margem (margem só sobre custo base)
  const taxableYen = declaredValueYen + shipping.valueYen
  const taxedYen = taxableYen * customsFactor
  const landedCostYen = baseCostYen + taxedYen
  const landedCostBrl = landedCostYen * brlPerJpy
  // Margem incide somente sobre o custo base (não sobre frete/aduana).
  const baseCostBrl = baseCostYen * brlPerJpy
  const marginBrl = baseCostBrl * (marginPercent / 100)
  const marginYen = brlPerJpy > 0 ? marginBrl / brlPerJpy : 0
  const beforeTaxBaseYen = baseCostYen + shipping.valueYen + marginYen
  const beforeTaxBaseBrl = beforeTaxBaseYen * brlPerJpy
  const beforeTaxIofBrl = applyIof ? beforeTaxBaseBrl * (iofPercent / 100) : 0
  const beforeTaxBrl = beforeTaxBaseBrl + beforeTaxIofBrl
  const beforeTaxYen = brlPerJpy > 0 ? beforeTaxBrl / brlPerJpy : beforeTaxBaseYen
  const subtotalWithMarginBrl = landedCostBrl + marginBrl
  const baseFinalBrl = subtotalWithMarginBrl + packagingBrl + localShippingBrl
  const iofBrl = applyIof ? baseFinalBrl * (iofPercent / 100) : 0
  const finalBrl = baseFinalBrl + iofBrl
  const paymentCharges = computePaymentCharges(
    finalBrl,
    paymentFeePercentsInput,
    paymentFixedUsdByMethodInput,
    usdBrl
  )
  const netProfitBrl = baseFinalBrl - landedCostBrl

  return {
    inputs: {
      quantity,
      unitBaseCostYen: roundYen(unitBaseCostYen),
      unitDeclaredValueInput: roundYen(unitDeclaredValueInput),
      unitDeclaredValueYen: roundYen(unitDeclaredValueYen),
      unitWeightGrams,
      baseCostYen: roundYen(baseCostYen),
      declaredValueYen: roundYen(declaredValueYen),
      weightGrams,
      shippingMode: input.shippingMode,
      directMethod: input.directMethod,
      loteKg: Number(input.loteKg) || null,
      marginPercent: round2(marginPercent),
      customsFactor: round2(customsFactor),
      brlPerJpy: round2(brlPerJpy),
      usdBrl: round2(usdBrl),
      packagingBrl: round2(packagingBrl),
      localShippingBrl: round2(localShippingBrl),
      applyIof,
      iofPercent: round2(iofPercent),
      paymentFeePercents: PAYMENT_METHODS.reduce((acc, method) => {
        acc[method.id] = round2(resolvePaymentFeePercent(method.id, paymentFeePercentsInput))
        return acc
      }, {}),
      paymentFixedUsdByMethod: PAYMENT_METHODS.reduce((acc, method) => {
        acc[method.id] = round2(resolvePaymentFixedFeeUsd(method.id, paymentFixedUsdByMethodInput))
        return acc
      }, {}),
    },
    shipping: {
      yen: roundYen(shipping.valueYen),
      note: shipping.note,
      loteRatePerGram: shipping.loteRatePerGram || null,
    },
    breakdown: {
      beforeTaxYen: roundYen(beforeTaxYen),
      beforeTaxBrl: round2(beforeTaxBrl),
      beforeTaxBaseBrl: round2(beforeTaxBaseBrl),
      beforeTaxIofBrl: round2(beforeTaxIofBrl),
      taxableYen: roundYen(taxableYen),
      taxedYen: roundYen(taxedYen),
      landedCostYen: roundYen(landedCostYen),
      landedCostBrl: round2(landedCostBrl),
      baseCostBrl: round2(baseCostBrl),
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
      (unitBaseCostYen > 0 || unitDeclaredValueYenRaw > 0)
      && unitWeightGrams > 0
      && brlPerJpy > 0
      && shipping.valueYen > 0,
  }
}

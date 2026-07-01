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
  const finalBrl = subtotalWithMarginBrl + packagingBrl + localShippingBrl
  const netProfitBrl = finalBrl - landedCostBrl

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
      finalBrl: round2(finalBrl),
      netProfitBrl: round2(netProfitBrl),
    },
    isValid:
      (baseCostYen > 0 || declaredValueYenRaw > 0)
      && weightGrams > 0
      && brlPerJpy > 0
      && shipping.valueYen > 0,
  }
}

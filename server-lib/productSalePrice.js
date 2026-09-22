/**
 * Preço unitário de venda — espelho server-side de src/lib/productSalePrice.js
 */
import {
  chargeJpyUsdRate,
  effectiveBrlPerJpy,
  jpyToFinalUsd,
  usdToBrlDisplay,
} from './pricingEngine.js'
import { resolveWiseWithdrawalMarkupPercentSync } from './wiseWithdrawalMarkup.js'

export const SALE_CHANNEL_STORE = 'store'
export const SALE_CHANNEL_GRUPO = 'grupo'

export const GRUPO_COMPRAS_FEE_PERCENT = 20
export const GRUPO_COMPRAS_FEE_PER_UNIT_USD = 1.9

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000
}

export function normalizePricingRates(input = {}) {
  const jpyUsdSpot = Number(input.jpy_usd) || 0
  const wiseMarkupPercent =
    input.wise_usd_jpy_withdrawal_markup_percent ?? input.wiseMarkupPercent ?? resolveWiseWithdrawalMarkupPercentSync()
  const jpyUsdCharge =
    Number(input.jpy_usd_charge) > 0
      ? Number(input.jpy_usd_charge)
      : chargeJpyUsdRate(jpyUsdSpot, wiseMarkupPercent)
  const usdBrl = Number(input.usd_brl) || 0
  const brlPerJpy =
    Number(input.effective_brl_per_jpy) > 0
      ? Number(input.effective_brl_per_jpy)
      : effectiveBrlPerJpy(jpyUsdSpot, usdBrl, wiseMarkupPercent)
  const grupoFeePerUnitUsd =
    Number(input.grupo_fee_per_unit_usd ?? input.grupoFeePerUnitUsd) > 0
      ? Number(input.grupo_fee_per_unit_usd ?? input.grupoFeePerUnitUsd)
      : GRUPO_COMPRAS_FEE_PER_UNIT_USD

  return {
    jpyUsdSpot,
    jpyUsdCharge,
    usdBrl,
    effectiveBrlPerJpy: brlPerJpy,
    wiseMarkupPercent: Number(wiseMarkupPercent) || 0,
    grupoFeePerUnitUsd,
  }
}

export function computeGrupoFeeUsd(grupoSubtotalUsd, grupoUnitsQty, feePerUnitUsd = GRUPO_COMPRAS_FEE_PER_UNIT_USD) {
  const sub = Number(grupoSubtotalUsd) || 0
  const qty = Math.max(0, Math.floor(Number(grupoUnitsQty) || 0))
  const feeUnit = Number(feePerUnitUsd) || GRUPO_COMPRAS_FEE_PER_UNIT_USD
  if (sub <= 0 || qty <= 0) return 0
  return sub * (GRUPO_COMPRAS_FEE_PERCENT / 100) + feeUnit * qty
}

export function computeProductSalePrice(opts = {}) {
  const priceJpy = Number(opts.priceJpy) || 0
  const quantity = Math.max(1, Math.floor(Number(opts.quantity) || 1))
  const channel = opts.channel === SALE_CHANNEL_GRUPO ? SALE_CHANNEL_GRUPO : SALE_CHANNEL_STORE
  const rates = normalizePricingRates(opts.rates || {})

  if (priceJpy <= 0) {
    return {
      priceJpy: 0,
      unitSaleBrl: 0,
      unitSaleUsd: 0,
      channel,
      quantity,
    }
  }

  const unitUsd = jpyToFinalUsd(priceJpy, rates.jpyUsdSpot, rates.wiseMarkupPercent)
  const lineUsd = unitUsd * quantity
  const unitBrlBase =
    rates.effectiveBrlPerJpy > 0
      ? priceJpy * rates.effectiveBrlPerJpy
      : usdToBrlDisplay(unitUsd, rates.usdBrl)

  let unitSaleUsd = unitUsd

  if (channel === SALE_CHANNEL_GRUPO) {
    const grupoSubtotalUsd = Number(opts.grupoSubtotalUsd) || 0
    const grupoTotalQty = Math.max(0, Math.floor(Number(opts.grupoTotalQty) || 0))

    if (grupoSubtotalUsd > 0 && grupoTotalQty > 0) {
      const grupoTotalUsd = computeGrupoFeeUsd(grupoSubtotalUsd, grupoTotalQty, rates.grupoFeePerUnitUsd)
      const lineFeeUsd = grupoTotalUsd * (lineUsd / grupoSubtotalUsd)
      unitSaleUsd = unitUsd + lineFeeUsd / quantity
    } else {
      unitSaleUsd = unitUsd * (1 + GRUPO_COMPRAS_FEE_PERCENT / 100) + rates.grupoFeePerUnitUsd
    }
  }

  const unitSaleBrl = rates.usdBrl > 0 ? unitSaleUsd * rates.usdBrl : unitBrlBase

  return {
    priceJpy,
    priceUsd: round4(unitUsd),
    priceBrl: round2(unitBrlBase),
    unitSaleUsd: round4(unitSaleUsd),
    unitSaleBrl: round2(unitSaleBrl),
    lineSaleBrl: round2(unitSaleBrl * quantity),
    channel,
    quantity,
  }
}

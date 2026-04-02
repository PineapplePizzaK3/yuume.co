/**
 * Pipeline server-side: JPY → USD (câmbio + markup retirada Wise) → BRL (USD × USD/BRL).
 */
import { resolveWiseWithdrawalMarkupPercentSync } from './wiseWithdrawalMarkup.js'

/**
 * USD por 1 JPY efetivo para cobrança: spot × (1 + markup%).
 * @param {number} jpyUsd - spot USD por 1 JPY
 * @param {number | null | undefined} markupPercent - se omitido, usa env/default Wise
 */
export function chargeJpyUsdRate(jpyUsd, markupPercent) {
  const r = Number(jpyUsd) || 0
  if (r <= 0) return 0
  const m =
    markupPercent === undefined || markupPercent === null
      ? resolveWiseWithdrawalMarkupPercentSync()
      : Number(markupPercent)
  const p = Number.isFinite(m) && m >= 0 ? m : resolveWiseWithdrawalMarkupPercentSync()
  return r * (1 + p / 100)
}

/**
 * @param {number} jpyAmount
 * @param {number} jpyUsd - spot
 * @param {number | null | undefined} markupPercent
 */
export function jpyToFinalUsd(jpyAmount, jpyUsd, markupPercent) {
  const jpy = Number(jpyAmount) || 0
  const rate = chargeJpyUsdRate(jpyUsd, markupPercent)
  if (jpy <= 0 || rate <= 0) return 0
  return jpy * rate
}

export function usdToBrlDisplay(usdAmount, usdBrl) {
  const usd = Number(usdAmount) || 0
  const r = Number(usdBrl) || 0
  if (usd <= 0 || r <= 0) return 0
  return usd * r
}

/**
 * BRL por 1 JPY no pipeline (com markup no trecho JPY→USD).
 */
export function effectiveBrlPerJpy(jpyUsd, usdBrl, markupPercent) {
  const effUsd = chargeJpyUsdRate(jpyUsd, markupPercent)
  const b = Number(usdBrl) || 0
  if (effUsd <= 0 || b <= 0) return 0
  return effUsd * b
}

export function brlToJpyViaUsdPipeline(brlAmount, jpyUsd, usdBrl, markupPercent) {
  const brl = Number(brlAmount) || 0
  const eff = effectiveBrlPerJpy(jpyUsd, usdBrl, markupPercent)
  if (brl <= 0 || eff <= 0) return 0
  return brl / eff
}

/**
 * JPY equivalente ao USD cobrado (inverso da taxa com markup).
 */
export function jpyEquivalentFromFinalUsd(usdAmount, jpyUsd, markupPercent) {
  const usd = Number(usdAmount) || 0
  const rate = chargeJpyUsdRate(jpyUsd, markupPercent)
  if (usd <= 0 || rate <= 0) return 0
  return usd / rate
}

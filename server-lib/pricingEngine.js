/**
 * Pipeline server-side: JPY → USD (câmbio spot, sem margem/taxa/buffer) → BRL só exibição (USD × USD/BRL).
 * Percentuais em system_settings (pricing_*_percent) continuam afetando apenas triggers SQL em produtos, não este módulo.
 */

/**
 * @param {number} jpyAmount
 * @param {number} jpyUsd - USD por 1 JPY (ex.: 0.0067)
 */
export function jpyToFinalUsd(jpyAmount, jpyUsd) {
  const jpy = Number(jpyAmount) || 0
  const rate = Number(jpyUsd) || 0
  if (jpy <= 0 || rate <= 0) return 0
  return jpy * rate
}

/**
 * BRL só para UI / cupons em BRL (derivado do USD de referência).
 */
export function usdToBrlDisplay(usdAmount, usdBrl) {
  const usd = Number(usdAmount) || 0
  const r = Number(usdBrl) || 0
  if (usd <= 0 || r <= 0) return 0
  return usd * r
}

/**
 * BRL por 1 JPY no pipeline JPY→USD→BRL (spot): jpy_usd × usd_brl
 */
export function effectiveBrlPerJpy(jpyUsd, usdBrl) {
  const a = Number(jpyUsd) || 0
  const b = Number(usdBrl) || 0
  if (a <= 0 || b <= 0) return 0
  return a * b
}

export function brlToJpyViaUsdPipeline(brlAmount, jpyUsd, usdBrl) {
  const brl = Number(brlAmount) || 0
  const eff = effectiveBrlPerJpy(jpyUsd, usdBrl)
  if (brl <= 0 || eff <= 0) return 0
  return brl / eff
}

/**
 * JPY equivalente ao USD (inverso spot), p.ex. carteira.
 */
export function jpyEquivalentFromFinalUsd(usdAmount, jpyUsd) {
  const usd = Number(usdAmount) || 0
  const r = Number(jpyUsd) || 0
  if (usd <= 0 || r <= 0) return 0
  return usd / r
}

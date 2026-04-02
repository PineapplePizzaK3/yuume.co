/**
 * Pricing pipeline (server-side):
 * JPY (custo base) → USD (valor de cobrança, com margem/taxa/buffer) → BRL (somente exibição).
 * Nunca derivar BRL diretamente do JPY sem passar pelo USD.
 */

export function pricingMultiplierFromPercents({
  marginPercent = 0,
  platformFeePercent = 0,
  bufferPercent = 0,
} = {}) {
  const m = 1 + Math.max(0, Number(marginPercent) || 0) / 100
  const f = 1 + Math.max(0, Number(platformFeePercent) || 0) / 100
  const b = 1 + Math.max(0, Number(bufferPercent) || 0) / 100
  return m * f * b
}

export function getPricingPercentsFromEnv() {
  return {
    marginPercent: Number(process.env.PRICING_MARGIN_PERCENT) || 0,
    platformFeePercent: Number(process.env.PRICING_PLATFORM_FEE_PERCENT) || 0,
    bufferPercent:
      Number(process.env.PRICING_JPY_USD_BUFFER_PERCENT ?? process.env.PRICING_SAFETY_BUFFER_PERCENT) || 5,
  }
}

/**
 * @param {number} jpyAmount
 * @param {number} jpyUsd - USD por 1 JPY (ex.: 0.0067)
 * @param {number} multiplier - margem × taxa × buffer
 */
export function jpyToFinalUsd(jpyAmount, jpyUsd, multiplier) {
  const jpy = Number(jpyAmount) || 0
  const rate = Number(jpyUsd) || 0
  const mult = Number(multiplier) || 1
  if (jpy <= 0 || rate <= 0) return 0
  return jpy * rate * mult
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
 * Quanto BRL “equivale” a 1 JPY no pipeline (para cupom/referência legada em BRL → JPY carteira).
 * effective_brl_per_jpy = jpy_usd × mult × usd_brl
 */
export function effectiveBrlPerJpy(jpyUsd, usdBrl, multiplier) {
  const a = Number(jpyUsd) || 0
  const b = Number(usdBrl) || 0
  const m = Number(multiplier) || 1
  if (a <= 0 || b <= 0) return 0
  return a * m * b
}

export function brlToJpyViaUsdPipeline(brlAmount, jpyUsd, usdBrl, multiplier) {
  const brl = Number(brlAmount) || 0
  const eff = effectiveBrlPerJpy(jpyUsd, usdBrl, multiplier)
  if (brl <= 0 || eff <= 0) return 0
  return brl / eff
}

/**
 * JPY equivalente ao USD final (inverso da etapa JPY→USD), p.ex. carteira.
 */
export function jpyEquivalentFromFinalUsd(usdAmount, jpyUsd, multiplier) {
  const usd = Number(usdAmount) || 0
  const r = Number(jpyUsd) || 0
  const m = Number(multiplier) || 1
  if (usd <= 0 || r <= 0 || m <= 0) return 0
  return usd / (r * m)
}

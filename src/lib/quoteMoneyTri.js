import { getFxBrlPerJpy, jpyToApproxUsd, jpyToBrl } from './fx'

/**
 * @param {number} amount
 * @param {'JPY'|'BRL'|string} [currency]
 * @param {number} [fxBrlPerJpy]
 * @returns {{ jpy: number, brl: number, usd: number } | null}
 */
export function amountToTri(amount, currency = 'JPY', fxBrlPerJpy = getFxBrlPerJpy()) {
  const p = Number(amount)
  if (!Number.isFinite(p) || p <= 0) return null
  const fx = Number(fxBrlPerJpy)
  const cur = String(currency || 'JPY').toUpperCase()
  if (cur === 'BRL' && fx > 0) {
    const jpy = Math.floor(p / fx)
    if (jpy < 1) return null
    return { jpy, brl: p, usd: jpyToApproxUsd(jpy) }
  }
  const jpy = Math.floor(p)
  if (jpy < 1) return null
  return { jpy, brl: jpyToBrl(jpy), usd: jpyToApproxUsd(jpy) }
}

/**
 * @param {number} jpy
 * @returns {{ jpy: number, brl: number, usd: number } | null}
 */
export function jpyAmountToTri(jpy) {
  const j = Math.floor(Number(jpy) || 0)
  if (j < 1) return null
  return { jpy: j, brl: jpyToBrl(j), usd: jpyToApproxUsd(j) }
}

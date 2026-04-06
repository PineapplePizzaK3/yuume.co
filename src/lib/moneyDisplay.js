/**
 * Locale-aware price display: English site (/en) shows USD as the primary amount
 * where the underlying value is JPY- or BRL-based (approximate USD via client FX).
 */
import { LOCALE_EN } from './localeRoutes'
import {
  formatBRL,
  formatJPY,
  formatUSD,
  jpyToApproxUsd,
  brlToApproxUsd,
} from './fx'

/**
 * @param {import('./localeRoutes').SiteLocale | string} siteLocale
 * @param {number|null|undefined} jpy
 * @param {number|null|undefined} [explicitUsd] server/charge USD when known
 */
export function formatJpyForSite(siteLocale, jpy, explicitUsd = null) {
  if (siteLocale === LOCALE_EN) {
    const u = Number(explicitUsd)
    if (Number.isFinite(u) && u > 0) return formatUSD(u)
    return formatUSD(jpyToApproxUsd(jpy))
  }
  return formatJPY(jpy)
}

/** @param {import('./localeRoutes').SiteLocale | string} siteLocale */
export function formatBrlForSite(siteLocale, brl) {
  if (siteLocale === LOCALE_EN) return formatUSD(brlToApproxUsd(brl))
  return formatBRL(brl)
}

/**
 * @param {import('./localeRoutes').SiteLocale | string} siteLocale
 * @param {number} amount
 * @param {string} [currency] JPY | BRL | USD
 */
export function formatByCurrencyForSite(siteLocale, amount, currency = 'JPY') {
  const c = String(currency || 'JPY').toUpperCase()
  if (c === 'USD') return formatUSD(amount)
  if (c === 'BRL') return formatBrlForSite(siteLocale, amount)
  return formatJpyForSite(siteLocale, amount, null)
}

/**
 * Resolved USD for tri-currency layout on English site (explicit USD > JPY-derived > BRL-derived).
 */
export function resolvedUsdForTri(brl, jpy, usd) {
  const u = Number(usd)
  if (Number.isFinite(u) && u > 0) return u
  const j = Number(jpy)
  if (Number.isFinite(j) && j > 0) return jpyToApproxUsd(j)
  const b = Number(brl)
  if (Number.isFinite(b) && b > 0) return brlToApproxUsd(b)
  return NaN
}

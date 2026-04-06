import { useMemo } from 'react'
import { useSiteLocale } from './useSiteLocale'
import { LOCALE_EN } from '../lib/localeRoutes'
import {
  formatJpyForSite,
  formatBrlForSite,
  formatByCurrencyForSite,
} from '../lib/moneyDisplay'

/**
 * Site-locale-aware price strings: English URLs show USD as primary for JPY/BRL-backed amounts.
 */
export function useFormatPrice() {
  const siteLocale = useSiteLocale()
  return useMemo(
    () => ({
      locale: siteLocale,
      isEnSite: siteLocale === LOCALE_EN,
      jpy: (jpy, explicitUsd = null) => formatJpyForSite(siteLocale, jpy, explicitUsd),
      brl: (brl) => formatBrlForSite(siteLocale, brl),
      byCurrency: (amount, currency) => formatByCurrencyForSite(siteLocale, amount, currency),
    }),
    [siteLocale],
  )
}

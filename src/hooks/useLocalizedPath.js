import { useCallback, useMemo } from 'react'
import { localizedPath } from '../lib/localeRoutes'
import { useSiteLocale } from './useSiteLocale'

/** @returns {(routeKey: string, queryAndHash?: string) => string} */
export function useLocalizedPath() {
  const locale = useSiteLocale()
  return useCallback((routeKey, queryAndHash = '') => localizedPath(routeKey, locale, queryAndHash), [locale])
}

/** Current locale + path builder (stable object). */
export function useLocalePath() {
  const locale = useSiteLocale()
  const path = useCallback((routeKey, queryAndHash = '') => localizedPath(routeKey, locale, queryAndHash), [locale])
  return useMemo(() => ({ locale, path }), [locale, path])
}

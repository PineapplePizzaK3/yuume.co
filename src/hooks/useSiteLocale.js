import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { getLocaleFromPathname } from '../lib/localeRoutes'

export function useSiteLocale() {
  const { pathname } = useLocation()
  return useMemo(() => getLocaleFromPathname(pathname), [pathname])
}

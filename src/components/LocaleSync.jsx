import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import i18n from '../i18n/i18n'
import { getLocaleFromPathname, LOCALE_EN } from '../lib/localeRoutes'

/**
 * Keeps i18n language aligned with URL (/en/... → en).
 */
export function LocaleSync() {
  const { pathname } = useLocation()

  useEffect(() => {
    const loc = getLocaleFromPathname(pathname)
    void i18n.changeLanguage(loc === LOCALE_EN ? 'en' : 'pt-BR')
  }, [pathname])

  return null
}

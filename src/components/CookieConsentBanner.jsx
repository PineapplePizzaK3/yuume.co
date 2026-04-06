import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isAppPath } from '../lib/localeRoutes'
import { LocalizedLink } from './LocalizedLink'

const COOKIE_CONSENT_STORAGE_KEY = 'cookie_consent_v1'

function readConsent() {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (value === 'accepted' || value === 'rejected') return value
  } catch {
    // ignore
  }
  return null
}

function writeConsent(value) {
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value)
  } catch {
    // ignore
  }
}

function CookieConsentBanner() {
  const { t } = useTranslation()
  const location = useLocation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!readConsent())
  }, [])

  if (!visible) return null

  const isAppRoute = isAppPath(location.pathname)

  return (
    <div
      className={`fixed left-3 right-3 z-[70] rounded-xl border border-earth-200 bg-earth-50 p-3 shadow-xl lg:left-6 lg:right-6 lg:max-w-3xl ${
        isAppRoute ? 'bottom-20 lg:bottom-4' : 'bottom-4'
      }`}
      role="dialog"
      aria-label={t('cookie.aria')}
      aria-modal="false"
    >
      <p className="text-sm text-earth-700">
        {t('cookie.body')}{' '}
        <LocalizedLink toRoute="legalPrivacy" className="font-semibold text-earth-900 underline hover:text-earth-700">
          {t('cookie.privacyLink')}
        </LocalizedLink>
        .
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            writeConsent('rejected')
            setVisible(false)
          }}
          className="rounded-lg border border-earth-300 px-3 py-2 text-sm font-medium text-earth-700 transition hover:bg-earth-100"
        >
          {t('cookie.reject')}
        </button>
        <button
          type="button"
          onClick={() => {
            writeConsent('accepted')
            setVisible(false)
          }}
          className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
        >
          {t('cookie.accept')}
        </button>
      </div>
    </div>
  )
}

export default CookieConsentBanner

import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

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
  const location = useLocation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!readConsent())
  }, [])

  if (!visible) return null

  const isAppRoute = location.pathname.startsWith('/app')

  return (
    <div
      className={`fixed left-3 right-3 z-[70] rounded-xl border border-earth-200 bg-earth-50 p-3 shadow-xl lg:left-6 lg:right-6 lg:max-w-3xl ${
        isAppRoute ? 'bottom-20 lg:bottom-4' : 'bottom-4'
      }`}
      role="dialog"
      aria-label="Consentimento de cookies"
      aria-modal="false"
    >
      <p className="text-sm text-earth-700">
        Usamos cookies essenciais para funcionamento da plataforma e, com sua autorizacao, cookies adicionais para
        melhorar sua experiencia. Saiba mais na{' '}
        <Link to="/legal/privacy" className="font-semibold text-earth-900 underline hover:text-earth-700">
          Politica de Privacidade
        </Link>
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
          Recusar opcionais
        </button>
        <button
          type="button"
          onClick={() => {
            writeConsent('accepted')
            setVisible(false)
          }}
          className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
        >
          Aceitar cookies
        </button>
      </div>
    </div>
  )
}

export default CookieConsentBanner

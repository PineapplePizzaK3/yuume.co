import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function isOverlayPath(pathname) {
  return pathname === '/live-rips/overlay' || pathname.startsWith('/live-rips/overlay/')
    || pathname === '/en/live-rips/overlay' || pathname.startsWith('/en/live-rips/overlay/')
}

function shouldShowHistoryNav(pathname) {
  if (isOverlayPath(pathname)) return false
  if (pathname.startsWith('/app') || pathname.startsWith('/en/app')) return true
  if (pathname.startsWith('/colecao') || pathname.startsWith('/en/collection')) return true
  if (pathname.startsWith('/colecionador') || pathname.startsWith('/en/collector')) return true
  if (pathname.startsWith('/minha-yuume') || pathname.startsWith('/en/minha-yuume')) return true
  if (pathname.startsWith('/explorar') || pathname.startsWith('/en/explore')) return true
  if (pathname.startsWith('/wishlist') || pathname.startsWith('/en/wishlist')) return true
  if (pathname.startsWith('/item/') || pathname.startsWith('/en/item/')) return true
  return false
}

function historyIndex() {
  const idx = window.history.state?.idx
  return typeof idx === 'number' ? idx : 0
}

/**
 * Faint edge controls for browser-style back and forward across the site.
 */
export function HistoryEdgeNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const navType = useNavigationType()
  const maxIdxRef = useRef(null)
  const [canBack, setCanBack] = useState(false)
  const [canForward, setCanForward] = useState(false)

  useEffect(() => {
    const idx = historyIndex()
    if (maxIdxRef.current == null || navType === 'PUSH') {
      maxIdxRef.current = idx
    } else if (idx > maxIdxRef.current) {
      maxIdxRef.current = idx
    }
    setCanBack(idx > 0)
    setCanForward(idx < maxIdxRef.current)
  }, [location.key, navType])

  if (!shouldShowHistoryNav(location.pathname)) return null

  const buttonClass =
    'group fixed top-1/2 z-40 flex h-16 w-8 -translate-y-1/2 items-center justify-center text-earth-900/20 transition hover:text-earth-900/55 focus-visible:text-earth-900/70 focus:outline-none disabled:pointer-events-none disabled:text-earth-900/10'

  return (
    <>
      <button
        type="button"
        aria-label={t('nav.historyBack', { defaultValue: 'Voltar' })}
        disabled={!canBack}
        onClick={() => navigate(-1)}
        className={`${buttonClass} left-0`}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" d="M14.5 5.5 8 12l6.5 6.5" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={t('nav.historyForward', { defaultValue: 'Avançar' })}
        disabled={!canForward}
        onClick={() => navigate(1)}
        className={`${buttonClass} right-0`}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" d="M9.5 5.5 16 12l-6.5 6.5" />
        </svg>
      </button>
    </>
  )
}

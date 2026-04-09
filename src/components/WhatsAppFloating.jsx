import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CONTATOS_DIRETOS } from '../data/contatoDireto'
import { isAppPath } from '../lib/localeRoutes'

const FAB_SIZE = 56
const EDGE_PADDING = 12
const ABOVE_NAV_GAP = 12
const STORAGE_KEY = 'whatsapp_fab_position_v2'
/** Espaço reservado acima da bottom nav mobile (/app, viewport estreita) — evita medir DOM a cada resize. */
const MOBILE_APP_NAV_RESERVE_REM = 6

function clampPosition(x, y) {
  const maxX = Math.max(EDGE_PADDING, window.innerWidth - FAB_SIZE - EDGE_PADDING)
  const maxY = Math.max(EDGE_PADDING, window.innerHeight - FAB_SIZE - EDGE_PADDING)
  return {
    x: Math.min(Math.max(x, EDGE_PADDING), maxX),
    y: Math.min(Math.max(y, EDGE_PADDING), maxY),
  }
}

function readSavedFabPosition() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (typeof saved?.x !== 'number' || typeof saved?.y !== 'number') return null
    return clampPosition(saved.x, saved.y)
  } catch {
    return null
  }
}

/**
 * Botão flutuante do WhatsApp no canto inferior direito.
 * Modo padrão: fixed com right/bottom (não depende de JS no resize).
 * Após arrastar: left/top persistidos; só aí o resize reclampa à viewport.
 */
function WhatsAppFloating() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const whatsapp = CONTATOS_DIRETOS.find((c) => c.nome === 'WhatsApp')

  const [freePosition, setFreePosition] = useState(() => readSavedFabPosition())
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
  )

  const dragDataRef = useRef({
    pointerId: null,
    originX: 0,
    originY: 0,
    startFabX: 0,
    startFabY: 0,
    dragged: false,
  })
  const suppressClickRef = useRef(false)
  const freePositionRef = useRef(freePosition)
  freePositionRef.current = freePosition

  const appMobile = isAppPath(pathname) && isMobileViewport
  const useAnchor = freePosition === null

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = () => setIsMobileViewport(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (useAnchor) return
    let rafId = 0
    const onResize = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = 0
        const p = freePositionRef.current
        if (!p) return
        setFreePosition(clampPosition(p.x, p.y))
      })
    }
    window.addEventListener('resize', onResize)
    const vv = window.visualViewport
    if (vv) vv.addEventListener('resize', onResize)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      if (vv) vv.removeEventListener('resize', onResize)
    }
  }, [useAnchor])

  if (!whatsapp) return null

  const handlePointerDown = (event) => {
    event.preventDefault()
    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    const start = freePositionRef.current
    dragDataRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startFabX: start ? start.x : rect.left,
      startFabY: start ? start.y : rect.top,
      dragged: false,
    }
    el.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (dragDataRef.current.pointerId !== event.pointerId) return
    const deltaX = event.clientX - dragDataRef.current.originX
    const deltaY = event.clientY - dragDataRef.current.originY
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragDataRef.current.dragged = true
      suppressClickRef.current = true
    }
    const next = clampPosition(
      dragDataRef.current.startFabX + deltaX,
      dragDataRef.current.startFabY + deltaY
    )
    setFreePosition(next)
  }

  const handlePointerUp = (event) => {
    if (dragDataRef.current.pointerId !== event.pointerId) return
    const p = freePositionRef.current
    if (p) {
      const finalPosition = clampPosition(p.x, p.y)
      setFreePosition(finalPosition)
      if (dragDataRef.current.dragged) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPosition))
        } catch {
          // ignore
        }
      }
    }
    dragDataRef.current.pointerId = null
    setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const anchorStyle = appMobile
    ? {
        right: EDGE_PADDING,
        left: 'auto',
        top: 'auto',
        bottom: `calc(${MOBILE_APP_NAV_RESERVE_REM}rem + env(safe-area-inset-bottom, 0px) + ${ABOVE_NAV_GAP}px)`,
      }
    : {
        right: EDGE_PADDING,
        left: 'auto',
        top: 'auto',
        bottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
      }

  const positionStyle = useAnchor
    ? anchorStyle
    : {
        left: freePosition.x,
        top: freePosition.y,
        right: 'auto',
        bottom: 'auto',
      }

  const fab = (
    <a
      href={whatsapp.url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed z-[60] flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-[transform,box-shadow,background-color] hover:scale-105 hover:bg-[#20BD5A] hover:shadow-xl active:cursor-grabbing"
      style={{ ...positionStyle, touchAction: 'none' }}
      aria-label={t('whatsapp.aria')}
      title={whatsapp.texto}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(event) => {
        if (!suppressClickRef.current) return
        event.preventDefault()
      }}
    >
      <svg
        className="h-8 w-8"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  )

  return typeof document !== 'undefined' ? createPortal(fab, document.body) : null
}

export default WhatsAppFloating

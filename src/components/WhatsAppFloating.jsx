import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { CONTATOS_DIRETOS } from '../data/contatoDireto'
import { isAppPath } from '../lib/localeRoutes'

const FAB_SIZE = 56
const EDGE_PADDING = 12
const ABOVE_NAV_GAP = 12
const STORAGE_KEY = 'whatsapp_fab_position_v2'

function clampPosition(x, y) {
  const maxX = Math.max(EDGE_PADDING, window.innerWidth - FAB_SIZE - EDGE_PADDING)
  const maxY = Math.max(EDGE_PADDING, window.innerHeight - FAB_SIZE - EDGE_PADDING)
  return {
    x: Math.min(Math.max(x, EDGE_PADDING), maxX),
    y: Math.min(Math.max(y, EDGE_PADDING), maxY),
  }
}

function getBottomRightDefault() {
  const w = window.innerWidth
  const h = window.innerHeight
  const defaultX = w - FAB_SIZE - EDGE_PADDING

  const onAppMobile =
    isAppPath(window.location.pathname) &&
    window.matchMedia('(max-width: 1023px)').matches
  const nav = document.getElementById('platform-mobile-bottom-nav')
  let defaultY
  if (onAppMobile && nav) {
    const navTop = nav.getBoundingClientRect().top
    defaultY = navTop - FAB_SIZE - ABOVE_NAV_GAP
  } else {
    defaultY = h - FAB_SIZE - 24
  }
  return clampPosition(defaultX, defaultY)
}

/**
 * Botão flutuante do WhatsApp no canto inferior direito.
 * Usa o link do primeiro contato WhatsApp em contatoDireto.
 */
function WhatsAppFloating() {
  const { t } = useTranslation()
  const whatsapp = CONTATOS_DIRETOS.find((c) => c.nome === 'WhatsApp')
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 }
    return getBottomRightDefault()
  })
  const dragDataRef = useRef({
    pointerId: null,
    originX: 0,
    originY: 0,
    startX: 0,
    startY: 0,
    dragged: false,
  })
  const suppressClickRef = useRef(false)
  /** Se false, o usuário definiu posição (arraste); no resize só limitamos à viewport. Se true, seguimos o canto padrão. */
  const followDefaultCornerRef = useRef(true)
  const positionRef = useRef(position)
  positionRef.current = position

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        followDefaultCornerRef.current = true
        const place = () => setPosition(getBottomRightDefault())
        place()
        requestAnimationFrame(() => requestAnimationFrame(place))
        return
      }
      const saved = JSON.parse(raw)
      if (typeof saved?.x !== 'number' || typeof saved?.y !== 'number') {
        followDefaultCornerRef.current = true
        setPosition(getBottomRightDefault())
        return
      }
      followDefaultCornerRef.current = false
      setPosition(clampPosition(saved.x, saved.y))
    } catch {
      followDefaultCornerRef.current = true
      setPosition(getBottomRightDefault())
    }
  }, [])

  useEffect(() => {
    let rafId = 0
    const onResize = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = 0
        if (followDefaultCornerRef.current) {
          setPosition(getBottomRightDefault())
        } else {
          setPosition((prev) => clampPosition(prev.x, prev.y))
        }
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
  }, [])

  if (!whatsapp) return null

  const handlePointerDown = (event) => {
    event.preventDefault()
    dragDataRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startX: position.x,
      startY: position.y,
      dragged: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
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
      dragDataRef.current.startX + deltaX,
      dragDataRef.current.startY + deltaY
    )
    setPosition(next)
  }

  const handlePointerUp = (event) => {
    if (dragDataRef.current.pointerId !== event.pointerId) return
    const finalPosition = clampPosition(positionRef.current.x, positionRef.current.y)
    setPosition(finalPosition)
    if (dragDataRef.current.dragged) {
      followDefaultCornerRef.current = false
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPosition))
      } catch {
        // ignore
      }
    }
    dragDataRef.current.pointerId = null
    setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const fab = (
    <a
      href={whatsapp.url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed z-[60] flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-[transform,box-shadow,background-color] hover:scale-105 hover:bg-[#20BD5A] hover:shadow-xl active:cursor-grabbing"
      style={{ left: `${position.x}px`, top: `${position.y}px`, touchAction: 'none' }}
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

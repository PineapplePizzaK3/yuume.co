/**
 * Lightbox para maximizar imagem dentro da própria página.
 */
import { useEffect, useRef } from 'react'

export default function ImageLightbox({
  src,
  alt,
  open,
  onClose,
  hasNavigation = false,
  onPrev,
  onNext,
  prevLabel = 'Imagem anterior',
  nextLabel = 'Próxima imagem',
}) {
  const touchStartRef = useRef({ x: 0, y: 0 })
  const touchDeltaRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!open) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
      if (hasNavigation && e.key === 'ArrowLeft') onPrev?.()
      if (hasNavigation && e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose, hasNavigation, onPrev, onNext])

  if (!open || !src) return null

  const handleTouchStart = (event) => {
    if (!hasNavigation || event.touches.length !== 1) return
    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    touchDeltaRef.current = { x: 0, y: 0 }
  }

  const handleTouchMove = (event) => {
    if (!hasNavigation || event.touches.length !== 1) return
    const touch = event.touches[0]
    touchDeltaRef.current = {
      x: touch.clientX - touchStartRef.current.x,
      y: touch.clientY - touchStartRef.current.y,
    }
  }

  const handleTouchEnd = () => {
    if (!hasNavigation) return
    const { x, y } = touchDeltaRef.current
    const absX = Math.abs(x)
    const absY = Math.abs(y)
    const isHorizontalSwipe = absX >= 50 && absX > absY * 1.2
    if (!isHorizontalSwipe) return
    if (x < 0) onNext?.()
    else onPrev?.()
    touchDeltaRef.current = { x: 0, y: 0 }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="button"
      tabIndex={-1}
      aria-label="Clique ou pressione Escape para fechar"
    >
      <div
        className="relative flex h-full w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-y pinch-zoom' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
          aria-label="Fechar imagem ampliada"
        >
          <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={src}
          alt={alt ?? 'Imagem ampliada'}
          className="max-h-full max-w-full object-contain"
        />
        {hasNavigation && (
          <>
            <button
              type="button"
              onClick={onPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
              aria-label={prevLabel}
            >
              <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
              aria-label={nextLabel}
            >
              <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

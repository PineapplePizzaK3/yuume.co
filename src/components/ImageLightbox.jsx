/**
 * Lightbox para maximizar imagem dentro da própria página.
 */
import { useEffect } from 'react'

export default function ImageLightbox({ src, alt, open, onClose }) {
  useEffect(() => {
    if (!open) return
    const handleEscape = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open || !src) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="button"
      tabIndex={-1}
      aria-label="Clique ou pressione Escape para fechar"
    >
      <img
        src={src}
        alt={alt ?? 'Imagem ampliada'}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

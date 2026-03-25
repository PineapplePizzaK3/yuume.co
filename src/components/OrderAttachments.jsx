/**
 * Exibe imagens do pedido com lightbox para maximizar ao clicar.
 */
import { useState } from 'react'
import ImageLightbox from './ImageLightbox'

export default function OrderAttachments({ urls, maxThumbnails = 8 }) {
  const [lightboxSrc, setLightboxSrc] = useState(null)

  if (!Array.isArray(urls) || urls.length === 0) return null

  const list = urls.slice(0, maxThumbnails)

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {list.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightboxSrc(url)}
            className="block overflow-hidden rounded-lg border border-earth-200 bg-white transition hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <img src={url} alt={`Imagem ${i + 1} do pedido`} className="h-16 w-16 object-cover" />
          </button>
        ))}
      </div>
      <ImageLightbox
        src={lightboxSrc}
        alt="Imagem do pedido"
        open={!!lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />
    </>
  )
}

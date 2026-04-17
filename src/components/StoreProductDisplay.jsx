/**
 * Blocos compartilhados entre vitrine (Loja), página de produto e listagens.
 */
import { formatJPY } from '../lib/fx'

export function isOutOfStock(p) {
  return p?.stock_quantity != null && Number(p.stock_quantity) <= 0
}

export function getProductImages(p) {
  if (Array.isArray(p?.image_urls) && p.image_urls.length > 0) {
    return p.image_urls.filter(Boolean)
  }
  if (p?.image_url) return [p.image_url]
  return []
}

/** Preço unitário do produto sempre em ienes (¥). */
export function ProductPriceBlock({ product: p, variant = 'card' }) {
  const jpy = Number(p.price_jpy ?? p.price) || 0
  const sizeClass =
    variant === 'modal' || variant === 'page' ? 'text-xl font-bold' : 'text-base font-semibold'
  return (
    <div className="mt-1.5">
      <span className={`tabular-nums text-earth-900 ${sizeClass}`}>{formatJPY(jpy)}</span>
    </div>
  )
}

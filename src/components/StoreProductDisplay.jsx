/**
 * Blocos compartilhados entre vitrine (Loja), página de produto e listagens.
 */
import { useTranslation } from 'react-i18next'
import { jpyToBrl } from '../lib/fx'
import { TriCurrencyDisplay } from './TriCurrencyDisplay'

export function isOutOfStock(p) {
  const variants = Array.isArray(p?.variants) ? p.variants : []
  if (variants.length > 0) {
    const activeVariants = variants.filter((v) => v?.is_active !== false)
    if (activeVariants.length === 0) return true
    return activeVariants.every((v) => v?.stock_quantity != null && Number(v.stock_quantity) <= 0)
  }
  return p?.stock_quantity != null && Number(p.stock_quantity) <= 0
}

/** Rótulo curto para UI (vitrine / seletor de versão). */
export function variantDisplayLabel(variant) {
  if (!variant) return ''
  const attrs = variant?.attributes && typeof variant.attributes === 'object' ? variant.attributes : {}
  return attrs.versao || variant.title || 'Padrão'
}

/** Uma variante específica sem estoque (ou inativa). */
export function isVariantOutOfStock(variant) {
  if (!variant) return true
  if (variant.is_active === false) return true
  return variant.stock_quantity != null && Number(variant.stock_quantity) <= 0
}

export function getProductImages(p) {
  if (Array.isArray(p?.image_urls) && p.image_urls.length > 0) {
    return p.image_urls.filter(Boolean)
  }
  if (p?.image_url) return [p.image_url]
  return []
}

/** BRL em destaque; JPY e USD na mesma hierarquia visual, com bandeiras. */
export function ProductPriceBlock({ product: p, variant = 'card' }) {
  const { t } = useTranslation()
  const variants = Array.isArray(p?.variants) ? p.variants : []
  const minVariantPrice = variants
    .filter((v) => v?.is_active !== false)
    .reduce((min, v) => {
      const price = Number(v?.price_jpy)
      if (!Number.isFinite(price) || price < 0) return min
      return min == null ? price : Math.min(min, price)
    }, null)
  const jpy = Number(minVariantPrice ?? p.price_jpy ?? p.price) || 0
  const brl = Number(p.price_brl)
  const usd = Number(p.price_usd)
  const hasDeriv = Number.isFinite(brl) && brl > 0 && Number.isFinite(usd) && usd > 0
  const approxBrlFallback = jpyToBrl(jpy)
  const triVariant = variant === 'modal' || variant === 'page' ? 'modal' : 'card'
  if (hasDeriv) {
    return (
      <div className="mt-1.5">
        <TriCurrencyDisplay brl={brl} jpy={jpy} usd={usd} variant={triVariant} />
      </div>
    )
  }
  return (
    <div className="mt-1.5">
      <TriCurrencyDisplay
        brl={approxBrlFallback}
        jpy={jpy}
        usd={NaN}
        variant={triVariant}
        footnote={t('platform.store.triUpdatingFootnote')}
      />
    </div>
  )
}

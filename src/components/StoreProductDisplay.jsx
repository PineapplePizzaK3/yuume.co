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
  const attrs = p?.attributes && typeof p.attributes === 'object' ? p.attributes : {}
  const rawImageUrls = p?.image_urls ?? attrs?.image_urls
  if (Array.isArray(rawImageUrls) && rawImageUrls.length > 0) {
    return rawImageUrls.filter(Boolean)
  }
  if (typeof rawImageUrls === 'string') {
    const raw = rawImageUrls.trim()
    if (raw) {
      if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(Boolean)
        } catch {
          // ignore malformed legacy payload
        }
      } else {
        return [raw]
      }
    }
  }
  const single = String(p?.image_url ?? attrs?.image_url ?? '').trim()
  if (single) return [single]
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
  const baseJpy = Number(p.price_jpy ?? p.price) || 0
  const baseBrl = Number(p.price_brl)
  const baseUsd = Number(p.price_usd)
  const impliedBrlPerJpy = baseJpy > 0 && Number.isFinite(baseBrl) && baseBrl > 0 ? (baseBrl / baseJpy) : null
  const impliedUsdPerJpy = baseJpy > 0 && Number.isFinite(baseUsd) && baseUsd > 0 ? (baseUsd / baseJpy) : null
  const brl = impliedBrlPerJpy != null ? jpy * impliedBrlPerJpy : baseBrl
  const usd = impliedUsdPerJpy != null ? jpy * impliedUsdPerJpy : baseUsd
  const hasVariantPricing = minVariantPrice != null
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
        usd={Number.isFinite(usd) && usd > 0 ? usd : NaN}
        variant={triVariant}
        footnote={!hasVariantPricing ? t('platform.store.triUpdatingFootnote') : null}
      />
    </div>
  )
}

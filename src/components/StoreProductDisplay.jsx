/**
 * Blocos compartilhados entre vitrine (Loja), página de produto e listagens.
 */
import { useTranslation } from 'react-i18next'
import { jpyToBrl } from '../lib/fx'
import { TriCurrencyDisplay } from './TriCurrencyDisplay'

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

/** BRL em destaque; JPY e USD na mesma hierarquia visual, com bandeiras. */
export function ProductPriceBlock({ product: p, variant = 'card' }) {
  const { t } = useTranslation()
  const jpy = Number(p.price_jpy ?? p.price) || 0
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

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { jpyToBrl } from '../lib/fx'
import LinkifyText from './LinkifyText'
import { TriCurrencyDisplay } from './TriCurrencyDisplay'
import StoreProductCategorySection from './StoreProductCategorySection'

function getGroupImages(g) {
  if (Array.isArray(g?.image_urls) && g.image_urls.length > 0) return g.image_urls.filter(Boolean)
  if (g?.image_url) return [g.image_url]
  return []
}

function getProductImages(p) {
  if (Array.isArray(p?.image_urls) && p.image_urls.length > 0) return p.image_urls.filter(Boolean)
  if (p?.image_url) return [p.image_url]
  return []
}

/**
 * Galeria + descrição + grade de produtos de um grupo (vitrine).
 */
export default function GroupPurchaseDetailContent({
  group,
  products,
  productHref,
  onComprar,
  isOutOfStock,
  tt,
}) {
  const { t } = useTranslation()
  const images = getGroupImages(group)
  const [imageIndex, setImageIndex] = useState(0)

  return (
    <>
      <div className="relative w-full overflow-hidden bg-earth-100">
        {images.length > 0 ? (
          <>
            <div className="flex w-full max-w-full items-center justify-center">
              <img
                src={images[imageIndex]}
                alt={group.name}
                className="h-auto w-auto max-h-64 max-w-full object-contain sm:max-h-80"
              />
            </div>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setImageIndex((i) => (i === 0 ? images.length - 1 : i - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                  aria-label={t('platform.store.prevPhoto')}
                >
                  <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setImageIndex((i) => (i === images.length - 1 ? 0 : i + 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                  aria-label={t('platform.store.nextPhoto')}
                >
                  <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="flex justify-center gap-1 pb-2">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setImageIndex(i)}
                      className={`h-2 w-2 rounded-full ${i === imageIndex ? 'bg-earth-800' : 'bg-earth-300'}`}
                      aria-label={t('platform.store.photoDot', { n: i + 1 })}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex h-64 w-full items-center justify-center bg-earth-200 text-earth-500 sm:h-80">
            {t('platform.store.noImage')}
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6">
        <h1 id="group-detail-title" className="text-xl font-bold text-earth-900 sm:text-2xl">
          {group.name}
        </h1>
        {group.description && (
          <p className="mt-2 whitespace-pre-wrap text-earth-600">
            <LinkifyText text={group.description} />
          </p>
        )}

        <div className="mt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-earth-700">
            {tt('productsAvailable')}
          </h2>
          {products.length === 0 ? (
            <p className="mt-2 text-sm text-earth-600">{tt('noProductsLinked')}</p>
          ) : (
            <div className="mt-3">
              <StoreProductCategorySection
                products={products}
                uncategorizedLabel={tt('categoryUncategorized')}
                searchPlaceholder={tt('categorySearchPlaceholder')}
                filterAllLabel={tt('categoryFilterAll')}
                gridClassName="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                renderProduct={(p) => {
                  const productImgs = getProductImages(p)
                  const productMainImg = productImgs[0]
                  const jpy = Number(p.price_jpy ?? p.price) || 0
                  const brl = Number(p.price_brl)
                  const usd = Number(p.price_usd)
                  const hasDeriv = Number.isFinite(brl) && brl > 0 && Number.isFinite(usd) && usd > 0
                  return (
                    <div
                      key={p.id}
                      className="overflow-hidden rounded-xl border border-earth-200 bg-earth-50 text-left shadow-sm transition hover:border-earth-400 hover:shadow-md"
                    >
                      <Link
                        to={`${productHref(p)}${productHref(p).includes('?') ? '&' : '?'}group=${encodeURIComponent(group.id)}`}
                        className="block focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-inset"
                      >
                        {productMainImg ? (
                          <img src={productMainImg} alt={p.name} className="h-32 w-full object-cover" />
                        ) : (
                          <div className="flex h-32 items-center justify-center bg-earth-200 text-earth-500 text-sm">
                            {t('platform.store.noImage')}
                          </div>
                        )}
                        <div className="p-3">
                          <h3 className="line-clamp-2 text-sm font-semibold text-earth-900">{p.name}</h3>
                          <div className="mt-1">
                            {hasDeriv ? (
                              <TriCurrencyDisplay brl={brl} jpy={jpy} usd={usd} variant="card" />
                            ) : (
                              <TriCurrencyDisplay
                                brl={jpyToBrl(jpy)}
                                jpy={jpy}
                                usd={NaN}
                                variant="card"
                                footnote={t('platform.store.triUpdatingFootnote')}
                              />
                            )}
                          </div>
                          <p className="mt-2 text-xs font-medium text-earth-500">{tt('clickForDetails')}</p>
                          <div className="mt-3">
                            <span className="rounded-lg border border-earth-300 bg-white px-3 py-1.5 text-xs font-medium text-earth-700">
                              {tt('viewProduct')}
                            </span>
                          </div>
                        </div>
                      </Link>
                      <div className="border-t border-earth-200 p-3 pt-2">
                        <button
                          type="button"
                          onClick={() => void onComprar(p)}
                          disabled={isOutOfStock(p)}
                          className="w-full rounded-lg px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-earth-300 disabled:text-earth-600 bg-earth-900 text-white hover:bg-earth-800"
                        >
                          {isOutOfStock(p) ? t('platform.store.outOfStock') : tt('buy')}
                        </button>
                      </div>
                    </div>
                  )
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

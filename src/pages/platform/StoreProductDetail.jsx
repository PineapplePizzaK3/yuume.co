/**
 * Página individual de produto (vitrine em estoque ou item de grupo).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { appStoreGroupPath, publicStoreGroupPath } from '../../lib/localeRoutes'
import { PageSeo } from '../../components/PageSeo'
import { getPublicProductById } from '../../services/productService'
import { addToCart } from '../../services/cartService'
import { useAuth } from '../../hooks/useAuth'
import LinkifyText from '../../components/LinkifyText'
import ImageLightbox from '../../components/ImageLightbox'
import { getProductConditionMeta } from '../../lib/productCondition'
import { ProductPriceBlock, getProductImages, isOutOfStock } from '../../components/StoreProductDisplay'

export default function StoreProductDetail({ publicMode = false }) {
  const { t } = useTranslation()
  const { productId: rawProductId } = useParams()
  const productId = rawProductId ? decodeURIComponent(rawProductId) : ''
  const [searchParams] = useSearchParams()
  const groupIdFromQuery = (searchParams.get('group') || '').trim()
  const lp = useLocalizedPath()
  const locale = useSiteLocale()
  const { user } = useAuth()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [imageIndex, setImageIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const backHref = useMemo(() => {
    if (groupIdFromQuery) {
      return publicMode
        ? publicStoreGroupPath(groupIdFromQuery, locale)
        : appStoreGroupPath(groupIdFromQuery, locale)
    }
    return publicMode ? lp('lojaPublicVitrine') : lp('appLoja')
  }, [groupIdFromQuery, publicMode, locale, lp])

  const backLabel = groupIdFromQuery
    ? t('platform.store.productPageBackToGroup')
    : t('platform.store.productPageBack')
  useEffect(() => {
    if (!message) return
    const tmr = setTimeout(() => setMessage(''), 3200)
    return () => clearTimeout(tmr)
  }, [message])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!productId) {
        setProduct(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setMessage('')
      try {
        const { data, error } = await getPublicProductById(productId)
        if (!active) return
        if (error) {
          setMessage(error.message || t('platform.store.productPageLoadError'))
          setProduct(null)
        } else {
          setProduct(data && typeof data === 'object' ? data : null)
        }
      } catch (e) {
        if (active) {
          setMessage(e?.message || t('platform.store.productPageLoadError'))
          setProduct(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [productId, t])

  useEffect(() => {
    setImageIndex(0)
  }, [product?.id])

  const images = product ? getProductImages(product) : []

  const handleComprar = async () => {
    if (!user?.id) {
      setMessage(t('platform.groupBuy.loginToBuy'))
      return
    }
    if (!product?.id) return
    const { error } = await addToCart(user.id, product.id, 1)
    if (error) setMessage(error.message || t('platform.store.addError'))
    else setMessage(t('platform.store.added'))
  }

  const openLightbox = (event) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    setLightboxOpen(true)
  }

  return (
    <>
      <PageSeo
        routeKey={publicMode ? 'lojaPublicVitrine' : 'appLoja'}
        title={product?.name ? `${product.name} | ${t('platform.storeHub.pageTitle')}` : t('platform.store.metaTitle')}
        description={t('meta.appStore.description')}
        noindex
      />
      <div className={publicMode ? 'px-4 pt-24 pb-12' : ''}>
        <div className="mx-auto w-full max-w-3xl">
          <Link
            to={backHref}
            className="inline-flex text-sm font-medium text-earth-600 hover:text-earth-900"
          >
            ← {backLabel}
          </Link>

          {loading && <p className="mt-8 text-earth-600">{t('platform.store.loading')}</p>}

          {!loading && !product && (
            <p className="mt-8 rounded-lg bg-earth-100 px-4 py-3 text-earth-800">
              {message || t('platform.store.productPageNotFound')}
            </p>
          )}

          {!loading && product && (
            <article className="mt-6 overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-sm">
              <div className="relative bg-earth-100">
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[imageIndex]}
                      alt={product.name}
                      className="h-72 w-full cursor-zoom-in object-contain sm:h-96"
                      onClick={openLightbox}
                    />
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
                  <div className="flex h-72 items-center justify-center text-earth-500 sm:h-96">
                    {t('platform.store.noImage')}
                  </div>
                )}
              </div>

              <div className="p-6">
                {(() => {
                  const condition = getProductConditionMeta(product.item_condition)
                  const condLabel = t(`platform.productCondition.${condition.value}`, {
                    defaultValue: condition.label,
                  })
                  return (
                    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${condition.className}`}>
                      {condLabel}
                    </span>
                  )
                })()}
                <h1 className="mt-3 text-2xl font-bold text-earth-900">{product.name}</h1>
                {product.description && (
                  <div className="mt-4 whitespace-pre-wrap text-earth-600">
                    <LinkifyText text={product.description} />
                  </div>
                )}
                <div className="mt-6">
                  <ProductPriceBlock product={product} variant="page" />
                </div>
                {message && (
                  <p className="mt-4 rounded-lg bg-earth-100 px-4 py-2 text-sm text-earth-800">{message}</p>
                )}
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleComprar()}
                    disabled={isOutOfStock(product)}
                    className="rounded-xl px-6 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-earth-300 disabled:text-earth-600 bg-earth-900 text-white hover:bg-earth-800"
                  >
                    {isOutOfStock(product) ? t('platform.store.outOfStock') : t('platform.store.addToCart')}
                  </button>
                  {isOutOfStock(product) && (
                    <Link
                      to={lp('appServices')}
                      className="rounded-xl border border-earth-300 bg-white px-6 py-3 font-medium text-earth-700 hover:bg-earth-50"
                    >
                      {t('platform.store.requestOrder')}
                    </Link>
                  )}
                </div>
              </div>
            </article>
          )}
        </div>
      </div>
      <ImageLightbox
        open={lightboxOpen}
        src={images[imageIndex]}
        alt={product?.name}
        onClose={() => setLightboxOpen(false)}
        hasNavigation={images.length > 1}
        onPrev={() => setImageIndex((i) => (i === 0 ? images.length - 1 : i - 1))}
        onNext={() => setImageIndex((i) => (i === images.length - 1 ? 0 : i + 1))}
        prevLabel={t('platform.store.prevPhoto')}
        nextLabel={t('platform.store.nextPhoto')}
      />
    </>
  )
}

/**
 * Loja Virtual - Itens disponíveis para compra.
 * Usuário vê apenas produtos ativos. Clique no card abre modal com detalhes e botão Adicionar ao carrinho.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { PageSeo } from '../../components/PageSeo'
import { getProducts } from '../../services/productService'
import { addToCart } from '../../services/cartService'
import { useAuth } from '../../hooks/useAuth'
import { jpyToBrl } from '../../lib/fx'
import { getCardThumbnailUrl } from '../../lib/imageUtils'
import LinkifyText from '../../components/LinkifyText'
import { TriCurrencyDisplay } from '../../components/TriCurrencyDisplay'
import ImageLightbox from '../../components/ImageLightbox'
import { getProductConditionMeta } from '../../lib/productCondition'

/** BRL em destaque; JPY e USD na mesma hierarquia visual, com bandeiras. */
function ProductPriceBlock({ product: p, variant = 'card' }) {
  const { t } = useTranslation()
  const jpy = Number(p.price_jpy ?? p.price) || 0
  const brl = Number(p.price_brl)
  const usd = Number(p.price_usd)
  const hasDeriv = Number.isFinite(brl) && brl > 0 && Number.isFinite(usd) && usd > 0
  const approxBrlFallback = jpyToBrl(jpy)
  const triVariant = variant === 'modal' ? 'modal' : 'card'
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

/** Produto tem controle de estoque e está esgotado */
function isOutOfStock(p) {
  return p?.stock_quantity != null && Number(p.stock_quantity) <= 0
}

/** Retorna array de URLs de imagens do produto (image_urls ou image_url) */
function getProductImages(p) {
  if (Array.isArray(p?.image_urls) && p.image_urls.length > 0) {
    return p.image_urls.filter(Boolean)
  }
  if (p?.image_url) return [p.image_url]
  return []
}

export default function Loja() {
  const { t } = useTranslation()
  const lp = useLocalizedPath()
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [modalFeedback, setModalFeedback] = useState('')
  const [detailProduct, setDetailProduct] = useState(null)
  const [detailImageIndex, setDetailImageIndex] = useState(0)
  const [lightbox, setLightbox] = useState({ open: false, src: '', alt: '' })

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(t)
  }, [message])

  useEffect(() => {
    if (!modalFeedback) return
    const t = setTimeout(() => setModalFeedback(''), 2200)
    return () => clearTimeout(t)
  }, [modalFeedback])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      try {
        const { data, error } = await getProducts()
        if (!isActive) return
        setProducts(data ?? [])
        if (error) setMessage(error.message)
      } catch (e) {
        if (isActive) setMessage(e?.message || t('platform.store.loadError'))
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [t])

  const openDetail = (p) => {
    setDetailProduct(p)
    setDetailImageIndex(0)
    setModalFeedback('')
  }

  const handleComprar = async (p) => {
    if (!user?.id) return
    const { error } = await addToCart(user.id, p.id, 1)
    const inModal = !!detailProduct
    if (error) {
      if (inModal) setModalFeedback(error.message || t('platform.store.addError'))
      else setMessage(error.message)
      return
    }
    if (inModal) setModalFeedback(t('platform.store.added'))
    else setMessage(t('platform.store.added'))
  }

  const images = detailProduct ? getProductImages(detailProduct) : []
  const openLightbox = (src, alt, event) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    setLightbox({ open: true, src, alt })
  }

  return (
    <>
      <PageSeo
        routeKey="appLoja"
        title={t('meta.appStore.title')}
        description={t('meta.appStore.description')}
        noindex
      />
      <div className="px-4 pt-24 pb-12">
        <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.store.pageTitle')}</h1>
        {message && !detailProduct && (
          <p className="mt-4 rounded-lg bg-earth-100 px-4 py-2 text-sm text-earth-800">{message}</p>
        )}
        {loading && <p className="mt-6 text-earth-600">{t('platform.store.loading')}</p>}
        {!loading && products.length === 0 && (
          <p className="mt-6 text-earth-600">{t('platform.store.empty')}</p>
        )}
        {!loading && products.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => {
              const imgs = getProductImages(p)
              const mainImg = imgs[0]
              const thumbUrl = mainImg ? getCardThumbnailUrl(mainImg) : null
              const condition = getProductConditionMeta(p.item_condition)
              const condLabel = t(`platform.productCondition.${condition.value}`, {
                defaultValue: condition.label,
              })
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-lg border border-earth-200 bg-earth-50 shadow-sm transition hover:border-earth-400 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => openDetail(p)}
                    className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-inset rounded-t-lg"
                  >
                    {mainImg ? (
                      <img
                        src={thumbUrl || mainImg}
                        alt={p.name}
                        className="h-36 w-full cursor-zoom-in object-cover"
                        loading="lazy"
                        onError={(e) => { if (e.target.src !== mainImg) e.target.src = mainImg }}
                        onClick={(e) => openLightbox(mainImg, p.name, e)}
                      />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-earth-200 text-earth-500 text-sm">
                        {t('platform.store.noImage')}
                      </div>
                    )}
                    <div className="p-3">
                      <h2 className="font-semibold text-earth-900 text-sm line-clamp-2">{p.name}</h2>
                      <span className={`mt-1 inline-flex rounded border px-2 py-0.5 text-[11px] font-medium ${condition.className}`}>
                        {condLabel}
                      </span>
                      {p.description && (
                        <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-earth-600">
                          <LinkifyText text={p.description} />
                        </p>
                      )}
                      <ProductPriceBlock product={p} />
                    </div>
                  </button>
                  <div className="flex gap-2 px-3 pb-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => !isOutOfStock(p) && handleComprar(p)}
                      disabled={isOutOfStock(p)}
                      className="flex-1 rounded-lg px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-earth-300 disabled:text-earth-600 bg-earth-900 text-white hover:bg-earth-800"
                    >
                      {isOutOfStock(p) ? t('platform.store.outOfStock') : t('platform.store.addToCart')}
                    </button>
                    {isOutOfStock(p) && (
                      <Link
                        to={lp('appServices')}
                        className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-xs font-medium text-earth-700 hover:bg-earth-100"
                      >
                        {t('platform.store.requestOrder')}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && (
          <div className="mt-10 rounded-xl border border-earth-200 bg-earth-50 p-5 sm:p-6">
            <p className="text-sm text-earth-700 sm:text-base">{t('platform.store.ctaBody')}</p>
            <Link
              to={lp('appServices')}
              className="mt-3 inline-flex rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800"
            >
              {t('platform.store.ctaButton')}
            </Link>
          </div>
        )}

        {/* Modal detalhes do produto */}
        {detailProduct && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDetailProduct(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {modalFeedback && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
                  <p
                    className={`rounded-lg px-4 py-2 text-sm ${
                      modalFeedback === t('platform.store.added')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {modalFeedback}
                  </p>
                </div>
              )}
              {/* Galeria de fotos */}
              <div className="relative bg-earth-100">
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[detailImageIndex]}
                      alt={detailProduct.name}
                      className="h-64 w-full cursor-zoom-in object-contain sm:h-80"
                      onClick={(e) => openLightbox(images[detailImageIndex], detailProduct.name, e)}
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailImageIndex((i) => (i === 0 ? images.length - 1 : i - 1))
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
                          aria-label={t('platform.store.prevPhoto')}
                        >
                          <svg className="h-5 w-5 text-earth-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailImageIndex((i) => (i === images.length - 1 ? 0 : i + 1))
                          }}
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
                              onClick={(e) => {
                                e.stopPropagation()
                                setDetailImageIndex(i)
                              }}
                              className={`h-2 w-2 rounded-full ${i === detailImageIndex ? 'bg-earth-800' : 'bg-earth-300'}`}
                              aria-label={t('platform.store.photoDot', { n: i + 1 })}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex h-64 items-center justify-center bg-earth-200 text-earth-500 sm:h-80">
                    {t('platform.store.noImage')}
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                {(() => {
                  const condition = getProductConditionMeta(detailProduct.item_condition)
                  const condLabel = t(`platform.productCondition.${condition.value}`, {
                    defaultValue: condition.label,
                  })
                  return (
                    <span className={`mb-2 inline-flex rounded border px-2 py-0.5 text-xs font-medium ${condition.className}`}>
                      {condLabel}
                    </span>
                  )
                })()}
                <h2 id="product-detail-title" className="text-xl font-bold text-earth-900">
                  {detailProduct.name}
                </h2>
                {detailProduct.description && (
                  <p className="mt-2 whitespace-pre-wrap text-earth-600">
                    <LinkifyText text={detailProduct.description} />
                  </p>
                )}
                <div className="mt-4">
                  <ProductPriceBlock product={detailProduct} variant="modal" />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => !isOutOfStock(detailProduct) && handleComprar(detailProduct)}
                    disabled={isOutOfStock(detailProduct)}
                    className="rounded-xl px-6 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-earth-300 disabled:text-earth-600 bg-earth-900 text-white hover:bg-earth-800"
                  >
                    {isOutOfStock(detailProduct)
                      ? t('platform.store.outOfStock')
                      : t('platform.store.addToCart')}
                  </button>
                  {isOutOfStock(detailProduct) && (
                    <Link
                      to={lp('appServices')}
                      className="rounded-xl border border-earth-300 bg-white px-6 py-3 font-medium text-earth-700 hover:bg-earth-50"
                    >
                      {t('platform.store.requestOrder')}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailProduct(null)}
                    className="rounded-xl border border-earth-200 px-6 py-3 font-medium text-earth-600 hover:bg-earth-50"
                  >
                    {t('platform.store.close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <ImageLightbox
          open={lightbox.open}
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox({ open: false, src: '', alt: '' })}
        />
        </div>
      </div>
    </>
  )
}

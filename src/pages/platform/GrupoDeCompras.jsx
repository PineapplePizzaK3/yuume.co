/**
 * Compras Programadas - página pública na plataforma (para usuários logados).
 * Cards com modal no mesmo estilo da página de `Loja`.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { appStoreProductPath, publicStoreProductPath } from '../../lib/localeRoutes'
import { PageSeo } from '../../components/PageSeo'
import { getPurchaseGroups } from '../../services/groupService'
import { getPurchaseGroupProducts } from '../../services/productService'
import { addToCart } from '../../services/cartService'
import { jpyToBrl } from '../../lib/fx'
import LinkifyText from '../../components/LinkifyText'
import { TriCurrencyDisplay } from '../../components/TriCurrencyDisplay'
import StoreProductCategorySection from '../../components/StoreProductCategorySection'

function getGroupImages(g) {
  if (Array.isArray(g?.image_urls) && g.image_urls.length > 0) return g.image_urls.filter(Boolean)
  if (g?.image_url) return [g.image_url]
  return []
}

/** Retorna array de URLs de imagens do produto (image_urls ou image_url) */
function getProductImages(p) {
  if (Array.isArray(p?.image_urls) && p.image_urls.length > 0) return p.image_urls.filter(Boolean)
  if (p?.image_url) return [p.image_url]
  return []
}

export default function GrupoDeCompras({ embedded = false, hideHeader = false, destination = 'all', publicMode = false }) {
  const { t } = useTranslation()
  const lp = useLocalizedPath()
  const locale = useSiteLocale()
  const { user } = useAuth()
  const tt = (key, options) => t(`platform.groupBuy.${key}`, options)
  const [groups, setGroups] = useState([])
  const [groupProducts, setGroupProducts] = useState({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [modalFeedback, setModalFeedback] = useState('')
  const [detailGroup, setDetailGroup] = useState(null)
  const [detailImageIndex, setDetailImageIndex] = useState(0)

  useEffect(() => {
    if (!message) return
    const timeoutId = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(timeoutId)
  }, [message])

  useEffect(() => {
    if (!modalFeedback) return
    const timeoutId = setTimeout(() => setModalFeedback(''), 2200)
    return () => clearTimeout(timeoutId)
  }, [modalFeedback])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      setLoading(true)
      setMessage('')
      try {
        const { data: groupsData, error } = await getPurchaseGroups(destination)
        if (!isActive) return
        setGroups(groupsData ?? [])
        if (error) setMessage(error?.message)

        const groupIds = (groupsData ?? []).map((g) => g.id)
        const productsArrays = await Promise.all(
          groupIds.map((id) => getPurchaseGroupProducts(id).then((r) => r.data ?? []))
        )
        if (!isActive) return
        const map = Object.fromEntries(groupIds.map((id, i) => [id, productsArrays[i] ?? []]))
        setGroupProducts(map)
      } catch (e) {
        if (isActive) setMessage(e?.message || tt('loadError'))
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [destination, t])

  const images = useMemo(() => {
    return detailGroup ? getGroupImages(detailGroup) : []
  }, [detailGroup])

  const openDetail = (g) => {
    setDetailGroup(g)
    setDetailImageIndex(0)
    setModalFeedback('')
  }

  const productHref = (id) => (publicMode ? publicStoreProductPath(id, locale) : appStoreProductPath(id, locale))

  const getGroupProducts = (group) => {
    return groupProducts[group?.id] ?? []
  }

  const isOutOfStock = (p) => p?.stock_quantity != null && Number(p.stock_quantity) <= 0

  const handleComprar = async (product) => {
    if (!user?.id) {
      setMessage(tt('loginToBuy'))
      return
    }
    const { error } = await addToCart(user.id, product.id, 1)
    const inModal = !!detailGroup
    if (error) {
      if (inModal) setModalFeedback(error.message || tt('addError'))
      else setMessage(error.message)
      return
    }
    if (inModal) setModalFeedback(tt('added'))
    else setMessage(tt('added'))
  }

  return (
    <>
      {!embedded && (
        <PageSeo
          routeKey="appLoja"
          title={t('meta.appStore.title')}
          description={t('meta.appStore.description')}
          noindex
        />
      )}

      <div className={embedded ? 'rounded-xl border border-earth-200 bg-white p-4 sm:p-6' : ''}>
        {!hideHeader && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-earth-900">{tt('pageTitle')}</h1>
              <p className="mt-2 text-earth-600">{tt('intro')}</p>
            </div>
          </div>
        )}

        {message && !detailGroup && <p className="mt-4 rounded-lg bg-earth-100 px-4 py-2 text-sm text-earth-800">{message}</p>}

        {loading && <p className="mt-6 text-earth-600">{tt('loading')}</p>}
        {!loading && groups.length === 0 && (
          <p className="mt-6 text-earth-600">{tt('emptyGroups')}</p>
        )}

        {!loading && groups.length > 0 && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const imgs = getGroupImages(g)
              const mainImg = imgs[0]
              const groupProducts = getGroupProducts(g)

              return (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-xl border border-earth-200 bg-earth-50 shadow-sm transition hover:border-earth-400 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => openDetail(g)}
                    className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-inset rounded-t-xl"
                  >
                    {mainImg ? (
                      <img src={mainImg} alt={g.name} className="h-48 w-full object-cover" />
                    ) : (
                      <div className="flex h-48 items-center justify-center bg-earth-200 text-earth-500">
                        {t('platform.store.noImage')}
                      </div>
                    )}
                    <div className="p-4">
                      <h2 className="font-semibold text-earth-900">{g.name}</h2>
                      {g.description && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-earth-600">
                          <LinkifyText text={g.description} />
                        </p>
                      )}
                      <p className="mt-2 text-xs text-earth-500">
                        {tt('productsInGroup', { count: groupProducts.length })}
                      </p>
                    </div>
                  </button>

                  <div className="flex gap-2 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openDetail(g)}
                      className="flex-1 rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800"
                    >
                      {tt('viewDetails')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal detalhes do grupo */}
        {detailGroup && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDetailGroup(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-detail-title"
          >
            <div
              className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {modalFeedback && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
                  <p
                    className={`rounded-lg px-4 py-2 text-sm ${
                      modalFeedback === tt('added')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {modalFeedback}
                  </p>
                </div>
              )}
              <div className="relative bg-earth-100">
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[detailImageIndex]}
                      alt={detailGroup.name}
                      className="h-64 w-full object-contain sm:h-80"
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

              <div className="p-5">
                <h2 id="group-detail-title" className="text-xl font-bold text-earth-900">
                  {detailGroup.name}
                </h2>
                {detailGroup.description && (
                  <p className="mt-2 whitespace-pre-wrap text-earth-600">
                    <LinkifyText text={detailGroup.description} />
                  </p>
                )}

                <div className="mt-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">
                    {tt('productsAvailable')}
                  </h3>
                  {getGroupProducts(detailGroup).length === 0 ? (
                    <p className="mt-2 text-sm text-earth-600">{tt('noProductsLinked')}</p>
                  ) : (
                    <div className="mt-3">
                      <StoreProductCategorySection
                        products={getGroupProducts(detailGroup)}
                        uncategorizedLabel={tt('categoryUncategorized')}
                        searchPlaceholder={tt('categorySearchPlaceholder')}
                        filterAllLabel={tt('categoryFilterAll')}
                        gridClassName="grid gap-3 sm:grid-cols-2"
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
                                to={productHref(p.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="block focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-inset"
                              >
                                {productMainImg ? (
                                  <img
                                    src={productMainImg}
                                    alt={p.name}
                                    className="h-32 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-32 items-center justify-center bg-earth-200 text-earth-500 text-sm">
                                    {t('platform.store.noImage')}
                                  </div>
                                )}
                                <div className="p-3">
                                  <h4 className="line-clamp-2 text-sm font-semibold text-earth-900">{p.name}</h4>
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
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void handleComprar(p)
                                  }}
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

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setDetailGroup(null)}
                    className="rounded-xl bg-earth-900 px-6 py-3 font-medium text-white hover:bg-earth-800"
                  >
                    {t('platform.store.close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}


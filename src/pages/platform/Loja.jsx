/**
 * Loja (Vitrine): grupos de compra (todas as origens) + aba Em estoque (catálogo com pronta entrega).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { appStoreProductPath, publicStoreProductPath } from '../../lib/localeRoutes'
import { PageSeo } from '../../components/PageSeo'
import { getProducts } from '../../services/productService'
import { addToCart } from '../../services/cartService'
import { useAuth } from '../../hooks/useAuth'
import { getCardThumbnailUrl } from '../../lib/imageUtils'
import LinkifyText from '../../components/LinkifyText'
import ImageLightbox from '../../components/ImageLightbox'
import { getProductConditionMeta } from '../../lib/productCondition'
import { ProductPriceBlock, getProductImages, isOutOfStock } from '../../components/StoreProductDisplay'
import StoreProductCategorySection from '../../components/StoreProductCategorySection'
import GrupoDeCompras from './GrupoDeCompras'

function LojaEstoqueCatalog({ publicMode = false }) {
  const { t } = useTranslation()
  const lp = useLocalizedPath()
  const locale = useSiteLocale()
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: '', alt: '' })

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(timer)
  }, [message])

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

  const handleComprar = async (p) => {
    if (!user?.id) {
      setMessage(t('platform.groupBuy.loginToBuy'))
      return
    }
    const { error } = await addToCart(user.id, p.id, 1)
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage(t('platform.store.added'))
  }

  const productHref = (id) => (publicMode ? publicStoreProductPath(id, locale) : appStoreProductPath(id, locale))
  const openLightbox = (src, alt, event) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    setLightbox({ open: true, src, alt })
  }

  return (
    <div>
      <h2 className="sr-only">{t('platform.store.pageTitle')}</h2>
      {message && <p className="mt-4 rounded-lg bg-earth-100 px-4 py-2 text-sm text-earth-800">{message}</p>}
      {loading && <p className="mt-6 text-earth-600">{t('platform.store.loading')}</p>}
      {!loading && products.length === 0 && (
        <p className="mt-6 text-earth-600">{t('platform.store.empty')}</p>
      )}
      {!loading && products.length > 0 && (
        <div className="mt-6">
          <StoreProductCategorySection
            products={products}
            uncategorizedLabel={t('platform.store.categoryUncategorized')}
            searchPlaceholder={t('platform.store.categorySearchPlaceholder')}
            filterAllLabel={t('platform.store.categoryFilterAll')}
            gridClassName="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            renderProduct={(p) => {
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
                  className="overflow-hidden rounded-md border border-earth-200 bg-earth-50 shadow-sm transition hover:border-earth-400 hover:shadow-md"
                >
                  <Link
                    to={productHref(p.id)}
                    className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-inset rounded-t-lg"
                  >
                    {mainImg ? (
                      <img
                        src={thumbUrl || mainImg}
                        alt={p.name}
                        className="h-28 w-full cursor-zoom-in object-cover"
                        loading="lazy"
                        onError={(e) => {
                          if (e.target.src !== mainImg) e.target.src = mainImg
                        }}
                        onClick={(e) => openLightbox(mainImg, p.name, e)}
                      />
                    ) : (
                      <div className="flex h-28 items-center justify-center bg-earth-200 text-earth-500 text-xs">
                        {t('platform.store.noImage')}
                      </div>
                    )}
                    <div className="p-2">
                      <h3 className="font-semibold text-earth-900 text-xs leading-snug line-clamp-2 sm:text-sm">{p.name}</h3>
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
                  </Link>
                  <div className="flex gap-1.5 px-2 pb-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => !isOutOfStock(p) && handleComprar(p)}
                      disabled={isOutOfStock(p)}
                      className="flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-earth-300 disabled:text-earth-600 bg-earth-900 text-white hover:bg-earth-800"
                    >
                      {isOutOfStock(p) ? t('platform.store.outOfStock') : t('platform.store.addToCart')}
                    </button>
                    {isOutOfStock(p) && (
                      <Link
                        to={lp('appServices')}
                        className="rounded-md border border-earth-300 bg-white px-2 py-1.5 text-[11px] font-medium text-earth-700 hover:bg-earth-100"
                      >
                        {t('platform.store.requestOrder')}
                      </Link>
                    )}
                  </div>
                </div>
              )
            }}
          />
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

      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox({ open: false, src: '', alt: '' })}
      />
    </div>
  )
}

export default function Loja({ publicMode = false }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'estoque' ? 'estoque' : 'grupos'

  const tabLinks = useMemo(
    () => ({
      grupos: pathname,
      estoque: `${pathname}?tab=estoque`,
    }),
    [pathname]
  )

  return (
    <>
      <PageSeo
        routeKey="appLoja"
        title={t('meta.appStore.title')}
        description={t('meta.appStore.description')}
        noindex
      />
      <div className={publicMode ? 'px-4 pt-24 pb-12' : ''}>
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="text-2xl font-bold text-earth-900">{t('platform.groupBuy.pageTitle')}</h1>
          <p className="mt-2 text-earth-600">{t('platform.groupBuy.intro')}</p>

          <div className="mt-5 flex flex-wrap gap-2 rounded-xl border border-earth-200 bg-earth-50 p-2">
            <Link
              to={tabLinks.grupos}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === 'grupos' ? 'bg-earth-900 text-earth-50' : 'bg-white text-earth-700 hover:bg-earth-100'
              }`}
            >
              {t('platform.storeHub.tabShowcase')}
            </Link>
            <Link
              to={tabLinks.estoque}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === 'estoque' ? 'bg-earth-900 text-earth-50' : 'bg-white text-earth-700 hover:bg-earth-100'
              }`}
            >
              {t('platform.storeHub.tabStock')}
            </Link>
          </div>

          <div className="mt-6">
            {tab === 'grupos' ? (
              <GrupoDeCompras embedded hideHeader destination="all" publicMode={publicMode} />
            ) : (
              <LojaEstoqueCatalog publicMode={publicMode} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

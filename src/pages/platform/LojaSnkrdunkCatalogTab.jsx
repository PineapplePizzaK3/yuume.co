import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import {
  applyOnDemandPriceJpy,
  formatOnDemandPriceLabel,
  ON_DEMAND_PRICE_MULTIPLIER_DEFAULT,
  resolveOnDemandPriceMultiplier,
} from '../../lib/onDemandPricing'
import { publicEphemeralProductPath } from '../../lib/localeRoutes'
import { createEphemeralProductSnapshot } from '../../services/ephemeralProductService'
import { getSystemSettings } from '../../services/settingsService'
import {
  getLiveRipProductName,
  LIVE_RIPS_PRODUCT_CATEGORIES,
  LIVE_RIPS_PRODUCTS,
  LIVE_RIPS_SOURCE,
} from '../../data/liveRipsMock'

const CATEGORY_ID_ALIASES = {
  'weiss-schwarz': 'weis-schwarz',
  'duel-masters': 'duelmasters',
}

export default function LojaSnkrdunkCatalogTab() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const navigate = useNavigate()
  const [activeCategoryId, setActiveCategoryId] = useState(LIVE_RIPS_PRODUCT_CATEGORIES[0]?.id || '')
  const [buyingProductId, setBuyingProductId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [priceMultiplier, setPriceMultiplier] = useState(ON_DEMAND_PRICE_MULTIPLIER_DEFAULT)

  const activeCategory = useMemo(
    () => LIVE_RIPS_PRODUCT_CATEGORIES.find((item) => item.id === activeCategoryId) || null,
    [activeCategoryId]
  )
  const categoryProducts = useMemo(() => {
    const normalizedId = CATEGORY_ID_ALIASES[activeCategoryId] || activeCategoryId
    return LIVE_RIPS_PRODUCTS.filter((product) => product.categoryId === normalizedId)
  }, [activeCategoryId])
  const categoryCards = useMemo(
    () =>
      categoryProducts.map((item, index) => {
        const baseYen = Number(item.priceYen) || 0
        const saleYen = applyOnDemandPriceJpy(baseYen, priceMultiplier)
        return {
          ...item,
          __uiKey: [
            activeCategoryId,
            item.id,
            item.snkrdunkProductId || 'na',
            item.snkrdunkApparelId || 'na',
            item.shrinkwrapOption || 'na',
            index,
          ].join(':'),
          __saleYen: saleYen,
          __saleLabel: formatOnDemandPriceLabel(saleYen, locale),
        }
      }),
    [activeCategoryId, categoryProducts, locale, priceMultiplier]
  )

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await getSystemSettings()
      if (!active) return
      setPriceMultiplier(resolveOnDemandPriceMultiplier(data))
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setBuyingProductId('')
  }, [activeCategoryId])

  const openProductPage = async (item, uiKey) => {
    if (!item) return
    const stableId = String(uiKey || item.id || item.snkrdunkApparelId || '')
    setBuyingProductId(stableId)
    setErrorMessage('')

    const snapshotPayload = {
      storeId: 'snkrdunk',
      storeName: LIVE_RIPS_SOURCE.name,
      productUrl: String(item.snkrdunkSearchUrl || item.searchUrl || LIVE_RIPS_SOURCE.url || '').trim() || LIVE_RIPS_SOURCE.url,
      title: getLiveRipProductName(item, locale),
      // Preço original: o RPC aplica on_demand_price_multiplier no servidor.
      price: Number(item.priceYen) || 0,
      currency: 'JPY',
      imageUrl: item.image || '',
      source: 'store-direct-catalog',
      sourceProductId: item.id,
      sourceCategoryId: activeCategoryId,
      sourceCategoryLabel: activeCategory?.label?.[locale] || '',
    }

    const { data, error } = await createEphemeralProductSnapshot(snapshotPayload)
    if (error || !data?.token) {
      setErrorMessage(error?.message || t('platform.storeSnkrdunk.snapshotError'))
      setBuyingProductId('')
      return
    }

    navigate(publicEphemeralProductPath(data.token, locale))
  }

  return (
    <div>
      <div className="rounded-xl border border-earth-200 bg-earth-50 p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
          {t('platform.storeSnkrdunk.eyebrow')}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-earth-900 sm:text-xl">{t('platform.storeSnkrdunk.title')}</h2>
        <p className="mt-2 text-sm text-earth-700">{t('platform.storeSnkrdunk.description')}</p>
        <p className="mt-2 text-xs text-earth-500">
          {t('platform.storeSnkrdunk.snapshotInfo', {
            source: LIVE_RIPS_SOURCE.name,
            categoryPath: LIVE_RIPS_SOURCE.categoryPath,
          })}
        </p>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-earth-500">
          {t('platform.storeSnkrdunk.categoriesTitle')}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {LIVE_RIPS_PRODUCT_CATEGORIES.map((category) => {
            const isActive = category.id === activeCategoryId
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategoryId(category.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? 'border-earth-900 bg-earth-900 text-earth-50'
                    : 'border-earth-300 bg-white text-earth-800 hover:bg-earth-50'
                }`}
              >
                {category.label[locale]}
              </button>
            )
          })}
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {categoryProducts.length === 0 ? (
        <p className="mt-6 text-sm text-earth-600">{t('platform.storeSnkrdunk.empty')}</p>
      ) : null}

      <div key={activeCategoryId} className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {categoryCards.map((item) => (
          <article
            key={item.__uiKey}
            className="flex h-full flex-col overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm transition hover:border-earth-300 hover:shadow-md"
          >
            <button
              type="button"
              onClick={() => openProductPage(item, item.__uiKey)}
              className="block text-left"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-earth-200">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={getLiveRipProductName(item, locale)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-medium text-earth-600">
                    {t('liveRips.products.placeholder')}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="inline-flex self-start rounded-full bg-earth-100 px-2 py-1 text-xs font-medium text-earth-700">
                  {activeCategory?.label?.[locale] || ''}
                </p>
                <h3 className="mt-2 text-sm font-semibold text-earth-900 sm:text-base">
                  {getLiveRipProductName(item, locale)}
                </h3>
                <p className="mt-1 text-sm font-semibold text-earth-900">{item.__saleLabel}</p>
              </div>
            </button>
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => openProductPage(item, item.__uiKey)}
                disabled={buyingProductId === item.__uiKey}
                className="inline-flex w-full items-center justify-center rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-800 transition hover:bg-earth-50 disabled:opacity-60"
              >
                {t('platform.storeSnkrdunk.viewButton')}
              </button>
              <button
                type="button"
                onClick={() => openProductPage(item, item.__uiKey)}
                disabled={buyingProductId === item.__uiKey}
                className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-earth-50 transition hover:bg-earth-800 disabled:opacity-60"
              >
                {buyingProductId === item.__uiKey
                  ? t('platform.storeSnkrdunk.buyLoading')
                  : t('platform.storeSnkrdunk.buyButton')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

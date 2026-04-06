/**
 * Meus Produtos - Inventário do usuário (itens recebidos).
 * Lista itens e direciona a solicitação de envio para a página Envios.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { Link, useSearchParams } from 'react-router-dom'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { PageSeo } from '../../components/PageSeo'
import { getMyInventory } from '../../services/inventoryService'
import { cacheKey, readCache, writeCache } from '../../lib/cache'
import { formatWeight } from '../../lib/fx'
import LinkifyText from '../../components/LinkifyText'

function daysSince(dateValue) {
  if (!dateValue) return null
  const ts = new Date(dateValue).getTime()
  if (!Number.isFinite(ts)) return null
  const diff = Date.now() - ts
  if (diff < 0) return 0
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getStorageDays(item) {
  const baseDate = item?.received_at || item?.created_at || null
  return daysSince(baseDate)
}

const INVENTORY_PAGE_SIZE = 24

const INVENTORY_CATEGORY_KEYS = ['store', 'assisted', 'standard', 'personal', 'other']

const INVENTORY_CATEGORY_TKEY = {
  store: 'platform.inventory.categoryStore',
  assisted: 'platform.inventory.categoryAssisted',
  standard: 'platform.inventory.categoryStandard',
  personal: 'platform.inventory.categoryPersonal',
  other: 'platform.inventory.categoryOther',
}

export default function MeusProdutos() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const lp = useLocalizedPath()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [inventoryPage, setInventoryPage] = useState(0)
  const [inventoryHasMore, setInventoryHasMore] = useState(false)
  const [detailItem, setDetailItem] = useState(null)

  const getCategoryKey = (it) => {
    const order = it?.orders
    const orderSource = order?.order_source
    const orderModule = order?.order_module

    if (orderSource === 'store') return 'store'
    if (orderSource === 'service' && orderModule === 'assisted_buy') return 'assisted'
    if (orderSource === 'service' && orderModule === 'self_buy') return 'standard'
    if (orderSource === 'service') return 'personal'
    return 'other'
  }

  const getItemPhotoUrl = (item) => item?.photo_url || item?.product?.image_url || null

  useEffect(() => {
    if (searchParams.get('success') === 'true' && user?.id) {
      setFeedback(t('platform.inventory.purchaseSuccess'))
      setSearchParams({}, { replace: true })
      const k = cacheKey(user.id, `inventory_v1_p${inventoryPage}`)
      writeCache(k, null)
      getMyInventory(user.id, {
        limit: INVENTORY_PAGE_SIZE,
        offset: inventoryPage * INVENTORY_PAGE_SIZE,
      }).then(({ data }) => {
        const list = data ?? []
        setItems(list)
        setInventoryHasMore(list.length === INVENTORY_PAGE_SIZE)
        writeCache(k, { items: list, hasMore: list.length === INVENTORY_PAGE_SIZE })
      })
    }
  }, [searchParams, setSearchParams, user?.id, inventoryPage, t])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) {
        if (isActive) setLoading(false)
        return
      }
      const k = cacheKey(user.id, `inventory_v1_p${inventoryPage}`)
      const cached = readCache(k, 1000 * 60 * 30)
      if (cached && isActive) {
        setItems(Array.isArray(cached?.items) ? cached.items : [])
        setInventoryHasMore(!!cached?.hasMore)
        setLoading(false)
      }
      try {
        const { data, error } = await getMyInventory(user.id, {
          limit: INVENTORY_PAGE_SIZE,
          offset: inventoryPage * INVENTORY_PAGE_SIZE,
        })
        if (!isActive) return
        const list = data ?? []
        setItems(list)
        setInventoryHasMore(list.length === INVENTORY_PAGE_SIZE)
        writeCache(k, { items: list, hasMore: list.length === INVENTORY_PAGE_SIZE })
        if (error) setFeedback(error.message)
      } catch (e) {
        if (isActive) setFeedback(e?.message || t('platform.inventory.loadError'))
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => { isActive = false }
  }, [user?.id, inventoryPage, t])

  const feedbackPositive = (msg) => /success|sucesso|created|criada/i.test(String(msg || ''))

  return (
    <>
      <PageSeo
        routeKey="appLounge"
        title={t('platform.inventory.metaTitle')}
        description={t('platform.inventory.metaDescription')}
        noindex
      />
      <div>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.inventory.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">{t('platform.inventory.intro')}</p>

        {feedback && (
          <p
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              feedbackPositive(feedback) ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">{t('platform.inventory.loading')}</p>}

        {!loading && items.length === 0 && (
          <p className="mt-6 text-earth-600">{t('platform.inventory.empty')}</p>
        )}

        {!loading && items.length > 0 && (
          <>
            <div className="mt-6 rounded-xl border border-sky-300 bg-gradient-to-r from-sky-50 to-blue-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-sky-900">
                    {t('platform.inventory.shippingBannerTitle')}
                  </p>
                  <p className="mt-1 text-xs text-sky-800">{t('platform.inventory.shippingBannerBody')}</p>
                </div>
                <Link
                  to={lp('appLounge', '?tab=envios')}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
                >
                  {t('platform.inventory.goToShipments')}
                </Link>
              </div>
            </div>

            {(() => {
              const grouped = INVENTORY_CATEGORY_KEYS.reduce((acc, key) => {
                acc[key] = []
                return acc
              }, {})

              for (const it of items) {
                const key = getCategoryKey(it)
                if (!grouped[key]) grouped[key] = []
                grouped[key].push(it)
              }

              return INVENTORY_CATEGORY_KEYS.filter((key) => grouped[key]?.length > 0).map((key) => (
                  <section key={key} className="mt-6">
                    <h3 className="text-base font-semibold text-earth-900">{t(INVENTORY_CATEGORY_TKEY[key])}</h3>
                    <p className="mt-1 text-sm text-earth-600">
                      {t('platform.inventory.sectionTotal')}{' '}
                      <span className="font-medium text-earth-800">{grouped[key].length}</span>
                    </p>
                    <ul className="mt-4 space-y-4">
                      {grouped[key].map((item) => (
                        <li
                          key={item.id}
                          className="group overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="grid gap-0 md:grid-cols-[180px_1fr]">
                            <div className="relative h-28 overflow-hidden bg-earth-100 md:h-32">
                              {getItemPhotoUrl(item) ? (
                                <div className="flex h-full w-full items-center justify-center bg-earth-100 p-2">
                                  <img
                                    src={getItemPhotoUrl(item)}
                                    alt={item.name || t('platform.inventory.productFallback')}
                                    className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                                  />
                                </div>
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-earth-100 text-earth-500">
                                  {t('platform.inventory.noImage')}
                                </div>
                              )}
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                            </div>
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-base font-semibold text-earth-900">{item.name}</p>
                                    <span className="inline-flex items-center rounded bg-earth-100 px-2 py-0.5 text-xs text-earth-700">
                                      {item.status === 'stored'
                                        ? t('platform.inventory.statusStored')
                                        : t('platform.inventory.statusReady')}
                                    </span>
                                    {getStorageDays(item) != null && (
                                      <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                                        {t('platform.inventory.days', { count: getStorageDays(item) })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDetailItem(item)}
                                  className="shrink-0 rounded-md border border-earth-300 px-2.5 py-1 text-xs font-semibold text-earth-700 hover:bg-earth-100"
                                >
                                  {t('platform.inventory.viewDetails')}
                                </button>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-earth-500">
                                {item.items_count != null && (
                                  <span>
                                    {t('platform.inventory.itemsLabel')} {item.items_count}
                                  </span>
                                )}
                                {item.weight_kg != null && (
                                  <span>
                                    {t('platform.inventory.weightLabel')} {formatWeight(item.weight_kg)}
                                  </span>
                                )}
                              </div>
                              {item.products_description && (
                                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-earth-700">
                                  <LinkifyText text={item.products_description} />
                                </p>
                              )}
                              {item.notes && (
                                <p className="mt-2 line-clamp-2 text-sm text-earth-600">
                                  <LinkifyText text={item.notes} />
                                </p>
                              )}
                              <div className="mt-3 flex flex-wrap gap-3">
                                {item.video_url && (
                                  <a
                                    href={item.video_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium text-earth-700 underline hover:text-earth-900"
                                  >
                                    {t('platform.inventory.openVideo')}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              })()}

            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-white px-3 py-2">
              <p className="text-xs text-earth-600">
                {t('platform.inventory.pageIndicator', { page: inventoryPage + 1 })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInventoryPage((p) => Math.max(0, p - 1))}
                  disabled={loading || inventoryPage <= 0}
                  className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                >
                  {t('platform.inventory.prevPage')}
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryPage((p) => p + 1)}
                  disabled={loading || !inventoryHasMore}
                  className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                >
                  {t('platform.inventory.nextPage')}
                </button>
              </div>
            </div>
          </>
        )}
        {detailItem && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t('platform.inventory.detailAria')}
              className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-earth-200 px-5 py-4">
                <p className="text-base font-semibold text-earth-900">{t('platform.inventory.detailTitle')}</p>
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="rounded-md border border-earth-300 px-2.5 py-1 text-sm font-medium text-earth-700 hover:bg-earth-100"
                >
                  {t('platform.inventory.close')}
                </button>
              </div>
              <div className="grid max-h-[calc(90vh-64px)] overflow-y-auto md:grid-cols-[1.2fr_1fr]">
                <div className="bg-earth-100">
                  {getItemPhotoUrl(detailItem) ? (
                    <img
                      src={getItemPhotoUrl(detailItem)}
                      alt={detailItem.name || t('platform.inventory.productFallback')}
                      className="h-full max-h-[70vh] w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full min-h-[320px] items-center justify-center text-earth-500">
                      {t('platform.inventory.noImageDetail')}
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-lg font-semibold text-earth-900">{detailItem.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-earth-600">
                    {detailItem.items_count != null && (
                      <span>
                        {t('platform.inventory.itemsLabel')} {detailItem.items_count}
                      </span>
                    )}
                    {detailItem.weight_kg != null && (
                      <span>
                        {t('platform.inventory.weightLabel')} {formatWeight(detailItem.weight_kg)}
                      </span>
                    )}
                    {getStorageDays(detailItem) != null && (
                      <span>
                        {t('platform.inventory.storedFor', { count: getStorageDays(detailItem) })}
                      </span>
                    )}
                  </div>
                  {detailItem.products_description && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                        {t('platform.inventory.description')}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-earth-800">
                        <LinkifyText text={detailItem.products_description} />
                      </p>
                    </div>
                  )}
                  {detailItem.notes && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                        {t('platform.inventory.notes')}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-earth-700">
                        <LinkifyText text={detailItem.notes} />
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {detailItem.video_url && (
                      <a
                        href={detailItem.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-earth-700 underline hover:text-earth-900"
                      >
                        {t('platform.inventory.openVideo')}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

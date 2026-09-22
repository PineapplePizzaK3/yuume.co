import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import LiveRipPullReveal from '../../components/live-rips/LiveRipPullReveal'
import { supabase } from '../../lib/supabase'
import {
  getLiveRipProductName,
  LIVE_RIPS_BASE_PULLS,
  LIVE_RIPS_PRODUCTS,
  LIVE_RIPS_QUEUE,
} from '../../data/liveRipsMock'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { getLiveRipPulls, getLiveRipQueue } from '../../services/liveRipService'

function LiveRipBroadcastPage() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const [hasExtraPull, setHasExtraPull] = useState(false)
  const [queueData, setQueueData] = useState({ event: null, rows: [] })
  const [remotePulls, setRemotePulls] = useState([])
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)

  const productsById = useMemo(() => {
    const map = new Map()
    LIVE_RIPS_PRODUCTS.forEach((product) => map.set(product.id, product))
    return map
  }, [])

  useEffect(() => {
    let isMounted = true
    let timerId = null

    const load = async () => {
      const [queueResult, pullsResult] = await Promise.all([getLiveRipQueue(), getLiveRipPulls()])
      if (!isMounted) return
      if (queueResult?.data) setQueueData(queueResult.data)
      if (Array.isArray(pullsResult?.data)) setRemotePulls(pullsResult.data)
      timerId = window.setTimeout(load, 20000)
    }

    load()

    const channel = supabase
      .channel('live-rips-broadcast')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_rip_reservations' },
        () => {
          void load()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_rip_pulls' },
        () => {
          void load()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_events' },
        () => {
          void load()
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      isMounted = false
      if (timerId) window.clearTimeout(timerId)
      supabase.removeChannel(channel)
    }
  }, [])

  const queueRows = queueData.rows?.length ? queueData.rows : LIVE_RIPS_QUEUE.map((row) => ({
    rip_code: row.ripCode,
    customer_name: row.customerName,
    product_id: row.productId,
  }))
  const currentRip = queueRows[0] || { customer_name: '-', product_id: LIVE_RIPS_PRODUCTS[0]?.id }
  const currentProduct = productsById.get(currentRip.product_id || currentRip.productId) || LIVE_RIPS_PRODUCTS[0]
  const streamUrl = queueData?.event?.stream_url || ''
  const showEmbeddedStream = /^https?:\/\//i.test(streamUrl)

  const normalizedPulls = remotePulls.length
    ? remotePulls.map((pull) => ({
      id: pull.id,
      card_name: pull.card_name,
      card_name_en: pull.card_name_en,
      rarity: pull.rarity || '-',
      image_url: pull.image_url || '',
      market_value_jpy: pull.market_value_jpy,
    }))
    : LIVE_RIPS_BASE_PULLS.map((pull) => ({
      id: pull.id,
      card_name: pull.name,
      rarity: pull.rarity,
      image_url: pull.image,
    }))

  const pulls = hasExtraPull
    ? [
        ...normalizedPulls,
        {
          id: 'pull-extra-demo',
          card_name: 'Demo Promo Card',
          rarity: 'PROMO',
          image_url: '/home/anime-2-unboxing-japanese.jpeg',
        },
      ]
    : normalizedPulls

  return (
    <>
      <PageSeo
        routeKey="liveRipsLive"
        title={t('meta.liveRipsLive.title')}
        description={t('meta.liveRipsLive.description')}
        noindex
      />

      <section className="px-4 pb-14 pt-8 sm:pt-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
            {t('liveRips.live.title')}
          </h1>
          <p className="mt-2 text-xs text-earth-600">
            {isRealtimeConnected
              ? 'Atualização em tempo real conectada.'
              : 'Atualização em modo fallback (polling).'}
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr,0.9fr]">
            <article className="rounded-xl border border-earth-200 bg-white p-4 shadow-sm sm:p-6">
              {showEmbeddedStream ? (
                <div className="overflow-hidden rounded-lg border border-earth-200 bg-earth-100">
                  <iframe
                    src={streamUrl}
                    title={queueData?.event?.title || 'Live stream'}
                    className="aspect-video w-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-lg border border-earth-200 bg-earth-100">
                  <div className="text-center text-earth-700">
                    <p className="text-sm font-semibold uppercase tracking-wide text-earth-500">
                      {t('liveRips.live.videoLabel')}
                    </p>
                    <p className="mt-2 text-xl font-bold text-earth-900">
                      {queueData?.event?.title || 'JAPAN RIP NIGHT #01'}
                    </p>
                    <p className="mt-1 text-sm text-earth-600">{t('liveRips.live.videoPlaceholder')}</p>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-earth-900">{t('liveRips.live.pullsTitle')}</h2>
                  <button
                    type="button"
                    onClick={() => setHasExtraPull((prev) => !prev)}
                    className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
                  >
                    {hasExtraPull ? t('liveRips.live.removePullButton') : t('liveRips.live.addPullButton')}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pulls.map((pull) => (
                    <LiveRipPullReveal key={pull.id} pull={pull} compact />
                  ))}
                </div>
              </div>
            </article>

            <aside className="rounded-xl border border-earth-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-earth-900">{t('liveRips.live.queueTitle')}</h2>
              <div className="mt-4 space-y-3">
                {queueRows.map((entry) => {
                  const pid = entry.product_id || entry.productId
                  const product = productsById.get(pid)
                  return (
                    <div
                      key={entry.rip_code || entry.ripCode}
                      className="rounded-lg border border-earth-200 bg-earth-50 p-2 text-sm text-earth-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-earth-200 bg-earth-200">
                          {product?.image ? (
                            <img
                              src={product.image}
                              alt={getLiveRipProductName(product, locale)}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold">{entry.rip_code || entry.ripCode} {entry.customer_name || entry.customerName}</p>
                          <p className="truncate text-earth-600">{getLiveRipProductName(product, locale) || '-'}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 rounded-lg border border-earth-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                  {t('liveRips.live.nowOpening')}
                </p>
                <p className="mt-2 text-lg font-semibold text-earth-900">{currentRip.customer_name || currentRip.customerName}</p>
                <p className="text-earth-700">{getLiveRipProductName(currentProduct, locale)}</p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  )
}

export default LiveRipBroadcastPage

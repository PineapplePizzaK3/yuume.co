import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalizedLink } from '../../components/LocalizedLink'
import { PageSeo } from '../../components/PageSeo'
import LiveRipPullReveal from '../../components/live-rips/LiveRipPullReveal'
import { LiveRipStatusTimeline } from '../../components/live-rips/LiveRipStatusTimeline'
import { useAuth } from '../../hooks/useAuth'
import {
  getLiveRipProductName,
  LIVE_RIPS_NEXT_LIVE,
  LIVE_RIPS_PRODUCTS,
} from '../../data/liveRipsMock'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { getMyLiveRipPulls, getMyLiveRipReservation } from '../../services/liveRipService'

function MyRipPage() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const { isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [reservation, setReservation] = useState(null)
  const [myPulls, setMyPulls] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    async function loadReservation() {
      if (!isAuthenticated) {
        setLoading(false)
        setReservation(null)
        return
      }
      setLoading(true)
      const [{ data, error }, { data: pullsData }] = await Promise.all([
        getMyLiveRipReservation(),
        getMyLiveRipPulls(),
      ])
      if (!active) return
      if (error) {
        setErrorMessage(error.message || t('liveRips.myRip.loadError'))
        setReservation(null)
      } else {
        setErrorMessage('')
        setReservation(data || null)
      }
      setMyPulls(Array.isArray(pullsData) ? pullsData : [])
      setLoading(false)
    }
    loadReservation()
    return () => {
      active = false
    }
  }, [isAuthenticated, t])

  const product = useMemo(() => {
    if (reservation) {
      return {
        name: reservation.product_name || '',
        nameEn: reservation.product_name_en || '',
        image: reservation.product_image || '',
      }
    }
    return LIVE_RIPS_PRODUCTS[0]
  }, [reservation])
  const productName = getLiveRipProductName(product, locale)

  const statusOrder = ['reserved', 'paid', 'separated', 'waiting_live', 'opening', 'cards_logged']
  const currentStatus = reservation?.status || 'reserved'
  const currentIndex = Math.max(0, statusOrder.indexOf(currentStatus))

  const timelineItems = useMemo(
    () => [
      { id: 'reserved', label: t('liveRips.myRip.timeline.reserved'), done: currentIndex >= 0 },
      { id: 'separated', label: t('liveRips.myRip.timeline.separated'), done: currentIndex >= 2 },
      { id: 'waiting', label: t('liveRips.myRip.timeline.waiting'), done: currentIndex >= 3 },
      { id: 'opening', label: t('liveRips.myRip.timeline.opening'), done: currentIndex >= 4 },
      { id: 'registered', label: t('liveRips.myRip.timeline.registered'), done: currentIndex >= 5 },
    ],
    [currentIndex, t]
  )

  return (
    <>
      <PageSeo
        routeKey="liveRipsMine"
        title={t('meta.liveRipsMyRip.title')}
        description={t('meta.liveRipsMyRip.description')}
        noindex
      />

      <section className="px-4 pb-16 pt-8 sm:pt-10">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
            {t('liveRips.myRip.title')}
          </h1>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <article className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
              <p className="inline-flex rounded-full bg-earth-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-earth-800">
                {reservation?.payment_status === 'paid' ? t('liveRips.myRip.statusPaid') : t('liveRips.myRip.statusReserved')}
              </p>
              <div className="mt-4 overflow-hidden rounded-lg border border-earth-200 bg-earth-50">
                {product.image ? (
                  <img src={product.image} alt={productName} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center text-sm text-earth-600">
                    {t('liveRips.products.placeholder')}
                  </div>
                )}
              </div>
              <dl className="mt-5 space-y-3 text-sm text-earth-700">
                <div className="flex items-center justify-between gap-4">
                  <dt>{t('liveRips.myRip.product')}</dt>
                  <dd className="font-semibold text-earth-900">{productName}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>{t('liveRips.myRip.ripCode')}</dt>
                  <dd className="font-semibold text-earth-900">{reservation?.rip_code || 'Aguardando geração'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>{t('liveRips.myRip.nextLive')}</dt>
                  <dd className="font-semibold text-earth-900">
                    {reservation?.event_starts_at
                      ? new Date(reservation.event_starts_at).toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')
                      : `${LIVE_RIPS_NEXT_LIVE.dateLabel[locale]} - ${LIVE_RIPS_NEXT_LIVE.timeLabel}`}
                  </dd>
                </div>
              </dl>
              {loading ? <p className="mt-3 text-sm text-earth-600">{t('liveRips.myRip.loading')}</p> : null}
              {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}
              {!loading && !reservation ? (
                <p className="mt-3 text-sm text-earth-600">{t('liveRips.myRip.noReservation')}</p>
              ) : null}

              <LocalizedLink
                toRoute="liveRipsLive"
                className="mt-7 inline-flex rounded-lg bg-earth-900 px-4 py-2.5 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
              >
                {t('liveRips.myRip.watchButton')}
              </LocalizedLink>
              <p className="mt-3 text-sm text-earth-600">{t('liveRips.myRip.liveNotStarted')}</p>
            </article>

            <article className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-earth-900">{t('liveRips.myRip.timelineTitle')}</h2>
              <div className="mt-4">
                <LiveRipStatusTimeline items={timelineItems} />
              </div>
              {myPulls.length ? (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-700">
                    {t('liveRips.myRip.pullsTitle')}
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {myPulls.map((pull) => (
                      <LiveRipPullReveal key={pull.id} pull={pull} compact />
                    ))}
                  </div>
                  {currentStatus === 'cards_logged' ? (
                    <p className="mt-3 text-sm text-earth-700">
                      {t('liveRips.myRip.postLiveHint')}{' '}
                      <LocalizedLink toRoute="appLounge" className="underline">
                        {t('liveRips.myRip.postLiveCta')}
                      </LocalizedLink>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          </div>
        </div>
      </section>
    </>
  )
}

export default MyRipPage

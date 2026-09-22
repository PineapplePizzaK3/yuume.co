import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { LocalizedLink } from '../../components/LocalizedLink'
import { PageSeo } from '../../components/PageSeo'
import { useAuth } from '../../hooks/useAuth'
import { localizedPath } from '../../lib/localeRoutes'
import {
  getLiveRipProductName,
  LIVE_RIPS_NEXT_LIVE,
  LIVE_RIPS_PRODUCTS,
  LIVE_RIPS_SOURCE,
  getLiveRipCategoryById,
  getLiveRipProductById,
} from '../../data/liveRipsMock'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { payLiveRipReservationWithWallet, reserveLiveRipProduct } from '../../services/liveRipService'
import { getWallet } from '../../services/walletService'

function LiveRipDetailPage() {
  const { t } = useTranslation()
  const { productId = '' } = useParams()
  const locale = useSiteLocale()
  const { isAuthenticated, user } = useAuth()
  const [reservedReservation, setReservedReservation] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [walletBalance, setWalletBalance] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const product = getLiveRipProductById(productId) || LIVE_RIPS_PRODUCTS[0]
  const productName = getLiveRipProductName(product, locale)
  const category = getLiveRipCategoryById(product?.categoryId)
  const reservationId = reservedReservation?.id || reservedReservation?.reservation?.id || ''
  const reservationPriceJpy = Number(reservedReservation?.price_jpy || product?.priceJpy || 0)
  const walletGap = walletBalance == null ? 0 : Math.max(0, reservationPriceJpy - walletBalance)
  const loginHref = useMemo(
    () => {
      const redirectPath = typeof window !== 'undefined' ? window.location.pathname : localizedPath('liveRipsHub', locale)
      return `${localizedPath('login', locale)}?redirect=${encodeURIComponent(redirectPath)}`
    },
    [locale]
  )

  useEffect(() => {
    let active = true
    async function loadWallet() {
      if (!user?.id) return
      const walletResult = await getWallet(user.id)
      if (!active) return
      setWalletBalance(Number(walletResult?.data?.balance || 0))
    }
    loadWallet()
    return () => {
      active = false
    }
  }, [user?.id])

  const handleReserve = async () => {
    if (!isAuthenticated) {
      setErrorMessage(t('liveRips.detail.loginRequired'))
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    const { data, error } = await reserveLiveRipProduct(product.id)
    setSubmitting(false)
    if (error) {
      setErrorMessage(error.message || t('liveRips.detail.reserveError'))
      return
    }
    const normalized = data?.reservation || data
    setReservedReservation(normalized || null)
    if (user?.id) {
      const walletResult = await getWallet(user.id)
      setWalletBalance(Number(walletResult?.data?.balance || 0))
    }
  }

  const handlePayReservation = async () => {
    if (!reservationId) return
    setPaymentLoading(true)
    setErrorMessage('')
    const { data, error } = await payLiveRipReservationWithWallet(reservationId)
    setPaymentLoading(false)
    if (error) {
      setErrorMessage(error?.message || t('liveRips.detail.walletPayError'))
      return
    }
    const nextReservation = data?.reservation || data || null
    setReservedReservation(nextReservation)
    if (user?.id) {
      const walletResult = await getWallet(user.id)
      setWalletBalance(Number(walletResult?.data?.balance || 0))
    }
  }

  return (
    <>
      <PageSeo
        routeKey="liveRipsDetail"
        title={t('meta.liveRipsDetail.title')}
        description={t('meta.liveRipsDetail.description')}
        noindex
      />

      <section className="px-4 pb-16 pt-8 sm:pt-10">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <article className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
              {t('liveRips.detail.pageEyebrow')}
            </p>
            {category ? (
              <p className="mt-2 inline-flex rounded-full bg-earth-100 px-2.5 py-1 text-xs font-medium text-earth-700">
                {category.label[locale]}
              </p>
            ) : null}
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-earth-900">{productName}</h1>
            <p className="mt-4 text-earth-700">
              {t('liveRips.detail.description')}
            </p>
            <p className="mt-2 text-xs text-earth-500">
              {t('liveRips.detail.sourceLabel', {
                source: product.source || LIVE_RIPS_SOURCE.name,
              })}
            </p>

            <div className="mt-6 overflow-hidden rounded-lg border border-earth-200 bg-earth-50">
              {product.image ? (
                <img src={product.image} alt={productName} className="h-56 w-full object-cover" />
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-earth-600">
                  {t('liveRips.products.placeholder')}
                </div>
              )}
            </div>

            <dl className="mt-6 grid gap-3 text-sm text-earth-700 sm:grid-cols-2">
              <div className="rounded-lg border border-earth-200 bg-earth-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-earth-500">{t('liveRips.products.price')}</dt>
                <dd className="mt-1 font-semibold text-earth-900">{product.priceLabel}</dd>
              </div>
              <div className="rounded-lg border border-earth-200 bg-earth-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-earth-500">{t('liveRips.nextLive.title')}</dt>
                <dd className="mt-1 font-semibold text-earth-900">{LIVE_RIPS_NEXT_LIVE.title}</dd>
              </div>
              <div className="rounded-lg border border-earth-200 bg-earth-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-earth-500">{t('liveRips.nextLive.time')}</dt>
                <dd className="mt-1 font-semibold text-earth-900">{LIVE_RIPS_NEXT_LIVE.timeLabel}</dd>
              </div>
              <div className="rounded-lg border border-earth-200 bg-earth-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-earth-500">{t('liveRips.products.availability')}</dt>
                <dd className="mt-1 font-semibold text-earth-900">
                  {t('liveRips.products.availableCount', { count: product.availableRips })}
                </dd>
              </div>
            </dl>

            <div className="mt-8">
              <h2 className="text-xl font-semibold text-earth-900">{t('liveRips.detail.howItWorksTitle')}</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-6 text-earth-700">
                <li>{t('liveRips.detail.steps.step1')}</li>
                <li>{t('liveRips.detail.steps.step2')}</li>
                <li>{t('liveRips.detail.steps.step3')}</li>
                <li>{t('liveRips.detail.steps.step4')}</li>
              </ol>
            </div>

            <p className="mt-6 rounded-lg border border-earth-200 bg-earth-50 p-4 text-sm text-earth-700">
              {t('liveRips.detail.futureNotice')}
            </p>
          </article>

          <aside className="rounded-xl border border-earth-200 bg-white p-6 shadow-sm sm:p-7">
            <h2 className="text-xl font-semibold text-earth-900">{t('liveRips.detail.reserveTitle')}</h2>
            <p className="mt-3 text-sm text-earth-600">{t('liveRips.detail.reserveBody')}</p>
            <button
              type="button"
              onClick={handleReserve}
              disabled={submitting}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-earth-900 px-4 py-3 text-sm font-medium text-earth-50 transition hover:bg-earth-800"
            >
              {submitting ? t('liveRips.detail.reserveLoading') : t('liveRips.detail.reserveButton')}
            </button>
            {reservedReservation ? (
              <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-4 text-sm text-earth-900">
                <p className="font-semibold">{t('liveRips.detail.reserveSuccess')}</p>
                <p className="mt-1 text-earth-700">
                  {t('liveRips.detail.ripCodeLabel')}: {reservedReservation.rip_code || 'Aguardando geração'}
                </p>
                <button
                  type="button"
                  onClick={handlePayReservation}
                  disabled={paymentLoading || reservedReservation.payment_status === 'paid'}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-800 hover:bg-earth-100 disabled:opacity-60"
                >
                  {reservedReservation.payment_status === 'paid'
                    ? t('liveRips.detail.alreadyPaid')
                    : paymentLoading
                      ? t('liveRips.detail.walletPayLoading')
                      : t('liveRips.detail.payWithWalletButton')}
                </button>
                <p className="mt-2 text-xs text-earth-600">
                  {t('liveRips.detail.walletOnlyHint')}
                  {walletBalance != null ? ` ${t('liveRips.detail.walletBalanceLabel')}: ¥${Math.max(0, walletBalance).toLocaleString('ja-JP')}` : ''}
                </p>
                <p className="mt-1 text-xs text-earth-600">
                  {t('liveRips.detail.ripPriceLabel')}: ¥{Math.max(0, reservationPriceJpy).toLocaleString('ja-JP')}
                  {walletBalance != null ? ` • ${t('liveRips.detail.walletGapLabel')}: ¥${walletGap.toLocaleString('ja-JP')}` : ''}
                </p>
                <a href={localizedPath('appConta', locale)} className="mt-1 inline-block text-xs text-earth-700 underline">
                  {t('liveRips.detail.addCreditsCta')}
                </a>
                <LocalizedLink toRoute="liveRipsMine" className="mt-2 inline-block text-earth-800 underline">
                  {t('liveRips.detail.goToMyRip')}
                </LocalizedLink>
              </div>
            ) : null}
            {errorMessage ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p>{errorMessage}</p>
                {!isAuthenticated ? (
                  <a href={loginHref} className="mt-2 inline-block underline">
                    {t('liveRips.detail.loginCta')}
                  </a>
                ) : null}
              </div>
            ) : null}
            <LocalizedLink
              toRoute="liveRipsHub"
              className="mt-6 inline-flex text-sm font-medium text-earth-700 underline"
            >
              {t('liveRips.detail.backToCatalog')}
            </LocalizedLink>
          </aside>
        </div>
      </section>
    </>
  )
}

export default LiveRipDetailPage

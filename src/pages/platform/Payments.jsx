/**
 * Payments - Histórico de pagamentos do usuário.
 * Exibe pagamentos de frete (cartão e carteira) vinculados aos pedidos.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { PageSeo } from '../../components/PageSeo'
import { getMyPayments } from '../../services/paymentService'
import { brlToJpy, jpyToBrl } from '../../lib/fx'
import { TriCurrencyDisplay } from '../../components/TriCurrencyDisplay'

export default function Payments() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'pt-BR'
  const { user } = useAuth()
  const lp = useLocalizedPath()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')

  const paymentStatusLabels = useMemo(
    () => ({
      pending: t('platform.cart.paymentStatus.pending'),
      completed: t('platform.cart.paymentStatus.completed'),
      failed: t('platform.cart.paymentStatus.failed'),
      refunded: t('platform.cart.paymentStatus.refunded'),
    }),
    [t]
  )

  const historyPaymentKind = (order, orderId, paymentIdLower) => {
    if (paymentIdLower === 'referral_discount' || paymentIdLower === 'coupon_discount') return t('platform.cart.historyKind.discount')
    if (order?.order_source === 'store') return t('platform.cart.historyKind.store')
    if (Number(order?.quote_amount) > 0) return t('platform.cart.historyKind.service')
    if (Number(order?.shipping_cost) > 0) return t('platform.cart.historyKind.shipping')
    if (orderId) return t('platform.cart.historyKind.order')
    return t('platform.cart.historyKind.payment')
  }

  const historyPayMethodLabel = (raw) => {
    const paymentId = String(raw || '').trim().toLowerCase()
    if (!paymentId) return '—'
    if (paymentId.startsWith('wallet')) return t('platform.cart.payMethod.wallet')
    if (paymentId === 'referral_discount' || paymentId === 'coupon_discount') return t('platform.cart.payMethod.discount')
    if (paymentId.startsWith('glin')) return 'Glin'
    if (paymentId.startsWith('parcelow')) return 'Parcelow'
    if (paymentId.includes('pix')) return 'PIX'
    if (paymentId.startsWith('pi_') || paymentId.startsWith('cs_') || paymentId.startsWith('ch_')) {
      return t('platform.cart.payMethod.card')
    }
    if (paymentId.includes('manual')) return t('platform.cart.payMethod.manual')
    return t('platform.cart.payMethod.card')
  }

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) {
        if (isActive) setLoading(false)
        return
      }
      try {
        const { data, error } = await getMyPayments()
        if (!isActive) return
        setPayments(data ?? [])
        if (error) setFeedback(error.message)
      } catch (e) {
        if (isActive) setFeedback(e?.message || t('platform.paymentHistory.loadError'))
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id, t])

  const paymentMethod = (p) => historyPayMethodLabel(p?.stripe_payment_id)
  const paymentKind = (p) => {
    const o = order(p)
    const id = String(p?.stripe_payment_id || '').toLowerCase()
    const oid = o?.id ?? p.order_id
    return historyPaymentKind(o, oid, id)
  }

  const order = (p) => {
    const o = p.orders ?? p.order
    return o != null && !Array.isArray(o) ? o : null
  }
  const serviceName = (p) => {
    const o = order(p)
    if (!o) return ''
    const svc = o.service
    return (svc && (svc.name ?? (Array.isArray(svc) ? svc[0]?.name : null))) ?? ''
  }

  const paymentTriValues = (p) => {
    const o = order(p)
    const amount = Number(p?.amount) || 0
    const cur = String(p?.currency || 'JPY').toUpperCase()
    const totalUsd = Number(o?.total_amount_usd)
    const totalBrl = Number(o?.total_amount)
    const isStore = o?.order_source === 'store'
    const canScaleUsd =
      isStore && Number.isFinite(totalUsd) && totalUsd > 0 && Number.isFinite(totalBrl) && totalBrl > 0

    if (cur === 'USD') {
      const usd = amount
      let brl = NaN
      let jpy = NaN
      if (canScaleUsd) {
        const ratio = amount / totalUsd
        brl = totalBrl * ratio
        jpy = Math.round(brlToJpy(brl))
      }
      return {
        brl,
        jpy,
        usd,
        footnote: Number.isFinite(brl) ? null : t('platform.paymentHistory.usdChargeFootnote'),
      }
    }
    if (cur === 'BRL') {
      const brl = amount
      const jpy = Math.round(brlToJpy(brl))
      let usd = NaN
      if (canScaleUsd) usd = totalUsd * (amount / totalBrl)
      return { brl, jpy, usd, footnote: null }
    }
    const jpy = Math.round(amount)
    const brl = jpyToBrl(jpy)
    let usd = NaN
    if (canScaleUsd) {
      const jpyRef = Math.round(brlToJpy(totalBrl))
      if (jpyRef > 0) usd = totalUsd * (jpy / jpyRef)
    }
    return { brl, jpy, usd, footnote: null }
  }

  return (
    <>
      <PageSeo
        routeKey="appPayments"
        title={t('meta.appPayments.title')}
        description={t('meta.appPayments.description')}
        noindex
      />
      <div>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.paymentHistory.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">
          {t('platform.paymentHistory.introBefore')}{' '}
          <Link to={lp('appLounge')} className="font-medium text-earth-900 underline hover:no-underline">
            {t('platform.wallet.pageTitle')}
          </Link>{' '}
          {t('platform.paymentHistory.introAfter')}
        </p>

        {feedback && (
          <p className="mt-4 rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800">
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">{t('platform.paymentHistory.loading')}</p>}

        {!loading && payments.length === 0 && (
          <p className="mt-6 text-earth-600">{t('platform.paymentHistory.empty')}</p>
        )}

        {!loading && payments.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-xl border border-earth-200">
            <div className="hidden bg-earth-100 sm:grid sm:grid-cols-12 sm:gap-4 sm:px-4 sm:py-3 sm:text-xs sm:font-semibold sm:uppercase sm:tracking-wide sm:text-earth-600">
              <div className="sm:col-span-3">{t('platform.cart.colDate')}</div>
              <div className="sm:col-span-3">{t('platform.cart.colDescription')}</div>
              <div className="sm:col-span-2">{t('platform.cart.colAmount')}</div>
              <div className="sm:col-span-2">{t('platform.cart.colMethod')}</div>
              <div className="sm:col-span-2">{t('platform.cart.colStatus')}</div>
            </div>
            <ul className="divide-y divide-earth-200">
              {payments.map((p) => {
                const o = order(p)
                const orderId = o?.id ?? p.order_id
                const tri = paymentTriValues(p)
                const kind = paymentKind(p)
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-2 bg-white px-4 py-4 sm:grid sm:grid-cols-12 sm:gap-4 sm:py-3"
                  >
                    <div className="w-full text-earth-700 sm:col-span-3 sm:w-auto">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleString(dateLocale, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </div>
                    <div className="w-full sm:col-span-3 sm:w-auto">
                      {orderId ? (
                        <Link
                          to={lp('appLounge', `?tab=pedidos&orderId=${encodeURIComponent(orderId)}`)}
                          className="text-earth-900 underline decoration-earth-300 underline-offset-2 hover:decoration-earth-700"
                        >
                          {t('platform.cart.historyDesc', {
                            kind,
                            id: String(orderId).slice(0, 8),
                          })}
                        </Link>
                      ) : (
                        <span className="text-earth-900">{kind}</span>
                      )}
                      {serviceName(p) && (
                        <p className="text-sm text-earth-500">{serviceName(p)}</p>
                      )}
                    </div>
                    <div className="w-full sm:col-span-2 sm:w-auto">
                      <TriCurrencyDisplay
                        brl={tri.brl}
                        jpy={tri.jpy}
                        usd={tri.usd}
                        variant="compact"
                        footnote={tri.footnote}
                      />
                    </div>
                    <div className="w-full text-earth-600 sm:col-span-2 sm:w-auto">
                      {paymentMethod(p)}
                    </div>
                    <div className="w-full sm:col-span-2 sm:w-auto">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : p.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-earth-100 text-earth-700'
                        }`}
                      >
                        {paymentStatusLabels[p.status] ?? p.status}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

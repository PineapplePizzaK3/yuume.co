/**
 * Modal de pagamento alinhado à Central de Pagamentos — recarga de carteira.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { fetchExchangeRates, createTopUpCheckoutSession } from '../services/paymentService'
import { formatBRL, formatJPY, formatUSD, jpyToBrl } from '../lib/fx'
import { GATEWAY_OPTIONS_META, PAYMENT_METHODS_BY_GATEWAY } from './paymentModalConstants'
import { FlagIcon } from './FlagIcon'

export default function CentralPaymentModal({ open, onClose, amountJpy, accessToken }) {
  const { t } = useTranslation()
  const [exchangeSnapshot, setExchangeSnapshot] = useState(null)
  const [selectedGateway, setSelectedGateway] = useState('stripe')
  const [selectedMethodGroup, setSelectedMethodGroup] = useState('card')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const gatewayOptions = useMemo(
    () =>
      GATEWAY_OPTIONS_META.map((entry) => ({
        ...entry,
        details: t(`platform.orders.gateway.${entry.id}`),
      })),
    [t]
  )

  const methodGroupLabels = useMemo(
    () => ({
      card: t('platform.cart.methodGroup.card'),
      pix: t('platform.cart.methodGroup.pix'),
      transfer: t('platform.cart.methodGroup.transfer'),
    }),
    [t]
  )

  useEffect(() => {
    if (!open) {
      setFeedback('')
      setSelectedGateway('stripe')
      setSelectedMethodGroup('card')
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await fetchExchangeRates()
      if (!cancelled && res?.ok) setExchangeSnapshot(res)
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const methods = PAYMENT_METHODS_BY_GATEWAY[selectedGateway] || []
    const groups = Array.from(new Set(methods.map((method) => method.group || 'card')))
    if (groups.length > 0 && !groups.includes(selectedMethodGroup)) {
      setSelectedMethodGroup(groups[0])
    }
  }, [open, selectedGateway, selectedMethodGroup])

  const remainingBrlUi =
    amountJpy > 0
      ? Number(exchangeSnapshot?.effective_brl_per_jpy) > 0
        ? amountJpy * Number(exchangeSnapshot.effective_brl_per_jpy)
        : jpyToBrl(amountJpy)
      : 0

  const jpyUsdForDisplay =
    Number(exchangeSnapshot?.jpy_usd_charge) > 0
      ? Number(exchangeSnapshot.jpy_usd_charge)
      : Number(exchangeSnapshot?.jpy_usd) > 0
        ? Number(exchangeSnapshot.jpy_usd)
        : null
  const amountUsdApprox =
    jpyUsdForDisplay != null && amountJpy > 0 ? amountJpy * jpyUsdForDisplay : null

  const handlePay = async () => {
    if (!accessToken) {
      setFeedback(t('platform.wallet.loginAgain'))
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      const { url } = await createTopUpCheckoutSession(amountJpy, accessToken, selectedGateway)
      if (url) window.location.href = url
      else setFeedback(t('platform.wallet.openPayError'))
    } catch (err) {
      setFeedback(err.message || t('platform.wallet.addError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open || !amountJpy || amountJpy < 500) return null

  const option = gatewayOptions.find((entry) => entry.id === selectedGateway) || gatewayOptions[0]
  const methodsForBadges = PAYMENT_METHODS_BY_GATEWAY[option.id] || []
  const groups = Array.from(new Set(methodsForBadges.map((method) => method.group || 'card')))
  const visibleMethods = methodsForBadges.filter(
    (method) => (method.group || 'card') === selectedMethodGroup
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 relative"
      style={{ position: 'fixed', inset: 0 }}
      onClick={() => !submitting && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="central-payment-modal-title"
    >
      {feedback && (
        <div className="absolute inset-0 z-[10001] flex items-center justify-center pointer-events-none">
          <p
            className={`rounded-lg px-4 py-2 text-sm ${
              /error|erro|indispon/i.test(String(feedback))
                ? 'bg-red-100 text-red-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {feedback}
          </p>
        </div>
      )}
      <div
        className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-xl bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <h3 id="central-payment-modal-title" className="font-semibold text-earth-900">
            {t('platform.cart.modalTitle')}
          </h3>
          <p className="mt-1 text-sm text-earth-600">{t('platform.wallet.topupPaymentSubtitle')}</p>

          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-earth-200 bg-earth-50 p-4 space-y-2">
              <div className="text-sm font-medium text-earth-700">
                {t('platform.wallet.topupChargeLabel')}
              </div>
              <div className="mt-2 rounded-lg border border-earth-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-earth-800">
                    <FlagIcon code="JP" size={20} title={t('platform.triCurrency.flagJp')} />
                    <span className="text-base font-semibold">{t('platform.wallet.topupJpyBase')}</span>
                  </span>
                  <span className="text-2xl font-bold text-earth-900">{formatJPY(amountJpy)}</span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 border-t border-earth-200 pt-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-earth-700">
                      <FlagIcon code="US" size={16} title={t('platform.triCurrency.flagUs')} />
                      {t('platform.wallet.topupUsdRef')}
                    </span>
                    <span className="font-semibold text-earth-900">
                      {amountUsdApprox != null && Number.isFinite(amountUsdApprox) && amountUsdApprox > 0
                        ? formatUSD(amountUsdApprox)
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-earth-700">
                      <FlagIcon code="BR" size={16} title={t('platform.triCurrency.flagBr')} />
                      {t('platform.wallet.topupBrlRef')}
                    </span>
                    <span className="font-semibold text-earth-900">{formatBRL(remainingBrlUi)}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-earth-500 mt-1">{t('platform.cart.modalBrlNote')}</p>
              <p className="text-xs text-earth-600 mt-2">{t('platform.wallet.topupFxPipelineNote')}</p>
            </div>

            <div className="rounded-lg border border-earth-200 bg-white p-4">
              <p className="font-medium text-earth-900">{t('platform.cart.modalPayMethod')}</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {gatewayOptions.map((entry) => {
                  const active = entry.id === option.id
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedGateway(entry.id)}
                      className={`rounded-md border px-3 py-2 text-left transition ${
                        active
                          ? 'border-earth-400 bg-earth-100'
                          : 'border-earth-200 bg-white hover:bg-earth-50'
                      }`}
                    >
                      <p className="text-sm font-medium text-earth-900">
                        <span className="mr-1">{entry.icon}</span>
                        {entry.label}
                      </p>
                      <p className="text-xs text-earth-600">{entry.details}</p>
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 rounded-md border border-earth-100 bg-earth-50 px-3 py-2">
                <p className="text-sm font-medium text-earth-900">
                  <span className="mr-1">{option.icon}</span>
                  {option.label}
                </p>
                <p className="text-xs text-earth-600">{option.details}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-earth-500">
                  {t('platform.cart.modalAccepted')}
                </p>
                {groups.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {groups.map((group) => {
                      const activeGroup = group === selectedMethodGroup
                      return (
                        <button
                          key={group}
                          type="button"
                          onClick={() => setSelectedMethodGroup(group)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                            activeGroup
                              ? 'border-earth-400 bg-earth-200 text-earth-900'
                              : 'border-earth-200 bg-white text-earth-600 hover:bg-earth-100'
                          }`}
                        >
                          {methodGroupLabels[group] || group}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {visibleMethods.map((method) => (
                    <div
                      key={method.id}
                      className="inline-flex items-center gap-2 rounded-md border border-earth-200 bg-white px-2 py-1"
                    >
                      <img
                        src={method.src}
                        alt={t('platform.cart.cardBadgeAlt', { label: method.label })}
                        className="h-7 w-auto rounded"
                        loading="lazy"
                      />
                      <span className="text-xs font-medium text-earth-700">{method.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs text-earth-500">{t('platform.wallet.topupMethodsFootnote')}</p>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-earth-200 bg-earth-50 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePay}
                disabled={submitting}
                className="flex-1 min-w-0 rounded-lg bg-earth-900 px-6 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
              >
                {submitting ? t('platform.cart.processing') : t('platform.cart.modalPaySelected')}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
              >
                {t('platform.cart.modalClose')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

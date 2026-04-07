/**
 * Modal de recarga no Lounge: escolha do valor → botão Pagar → mesmo modal de pagamento da Central de Pagamentos.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useFormatPrice } from '../hooks/useFormatPrice'
import CentralPaymentModal from './CentralPaymentModal'

export default function WalletAddFundsModal({ open, onClose, accessToken }) {
  const { t } = useTranslation()
  const fp = useFormatPrice()
  const [topUpAmount, setTopUpAmount] = useState('1000')
  const [feedback, setFeedback] = useState('')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [resolvedAmountJpy, setResolvedAmountJpy] = useState(null)

  useEffect(() => {
    if (!open) return
    setTopUpAmount('1000')
    setFeedback('')
    setPaymentModalOpen(false)
    setResolvedAmountJpy(null)
  }, [open])

  const handleProceedToPayment = () => {
    const value = parseFloat(String(topUpAmount).replace(',', '.'))
    if (!value || value < 500 || value > 500000) {
      setFeedback(t('platform.wallet.invalidAmount'))
      return
    }
    setFeedback('')
    setResolvedAmountJpy(Math.round(value))
    setPaymentModalOpen(true)
  }

  const feedbackPositive = (msg) => /success|sucesso/i.test(String(msg || ''))
  const feedbackCanceled = (msg) => /cancel|canceled|cancelada/i.test(String(msg || ''))

  const handleBackdropClose = () => {
    if (paymentModalOpen) return
    onClose?.()
  }

  const presets = [1000, 2000, 5000, 10000]

  if (!open) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
        onClick={handleBackdropClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-add-funds-title"
      >
        <div
          className="relative w-full max-w-lg rounded-xl border border-earth-200 bg-white p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="wallet-add-funds-title" className="text-lg font-semibold text-earth-900">
                {t('platform.wallet.pageTitle')}
              </h2>
              <p className="mt-1 text-sm text-earth-600">{t('platform.wallet.intro')}</p>
            </div>
            <button
              type="button"
              onClick={handleBackdropClose}
              className="shrink-0 rounded-lg p-1.5 text-earth-500 hover:bg-earth-100 hover:text-earth-800"
              aria-label={t('platform.pixTopup.close')}
            >
              <span aria-hidden>×</span>
            </button>
          </div>

          {feedback && (
            <p
              className={`mt-4 rounded-lg px-3 py-2 text-sm ${
                feedbackPositive(feedback)
                  ? 'bg-green-100 text-green-800'
                  : feedbackCanceled(feedback)
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
              }`}
            >
              {feedback}
            </p>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-earth-700">{t('platform.wallet.addBalance')}</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTopUpAmount(String(p))}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    topUpAmount === String(p)
                      ? 'border-earth-900 bg-earth-900 text-white'
                      : 'border-earth-300 text-earth-700 hover:bg-earth-100'
                  }`}
                >
                  {fp.jpy(p)}
                </button>
              ))}
              <input
                type="text"
                inputMode="decimal"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value.replace(/[^0-9,.]/g, ''))}
                placeholder={t('platform.wallet.otherAmountPh')}
                className="w-28 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              />
              <span className="text-xs text-earth-500">{t('platform.wallet.minMaxHint')}</span>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={handleProceedToPayment}
                className="w-full rounded-lg bg-earth-900 px-5 py-2.5 text-sm font-medium text-earth-50 hover:bg-earth-800 sm:w-auto"
              >
                {t('platform.wallet.proceedToPay')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <CentralPaymentModal
        open={paymentModalOpen && resolvedAmountJpy != null}
        onClose={() => setPaymentModalOpen(false)}
        amountJpy={resolvedAmountJpy ?? 0}
        accessToken={accessToken}
      />
    </>,
    document.body
  )
}

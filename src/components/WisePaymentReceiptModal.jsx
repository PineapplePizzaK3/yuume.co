import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { uploadWisePaymentReceipt } from '../services/productService'
import { submitWisePaymentReceipt } from '../services/wisePaymentService'

export default function WisePaymentReceiptModal({
  open,
  orderLabel = '',
  amountJpy = 0,
  wisePayUrl = '',
  wiseRequestId = '',
  userId = '',
  onClose,
  onSubmitted,
}) {
  const { t } = useTranslation()
  const [receiptFile, setReceiptFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  if (!open) return null

  const handleCopyLink = async () => {
    if (!wisePayUrl) return
    try {
      await navigator.clipboard.writeText(wisePayUrl)
      setFeedback(t('platform.wiseModal.linkCopied'))
    } catch {
      setFeedback(t('platform.wiseModal.copyError'))
    }
  }

  const handleOpenWise = () => {
    if (!wisePayUrl) return
    const tab = window.open(wisePayUrl, '_blank', 'noopener,noreferrer')
    if (!tab) {
      setFeedback(t('platform.wiseModal.popupBlocked'))
    }
  }

  const handleSubmitReceipt = async () => {
    if (!wiseRequestId || !userId || !receiptFile) {
      setFeedback(t('platform.wiseModal.receiptRequired'))
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      const { data: receiptUrl, error: uploadErr } = await uploadWisePaymentReceipt(
        receiptFile,
        userId,
        wiseRequestId
      )
      if (uploadErr) {
        setFeedback(uploadErr.message || t('platform.wiseModal.uploadError'))
        setSubmitting(false)
        return
      }
      const { error: submitErr } = await submitWisePaymentReceipt(wiseRequestId, receiptUrl)
      if (submitErr) {
        setFeedback(submitErr.message || t('platform.wiseModal.submitError'))
        setSubmitting(false)
        return
      }
      setFeedback(t('platform.wiseModal.submitSuccess'))
      setReceiptFile(null)
      onSubmitted?.()
    } catch (e) {
      setFeedback(e?.message || t('platform.wiseModal.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !submitting && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={t('platform.wiseModal.title')}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-earth-900">{t('platform.wiseModal.title')}</h3>
        <p className="mt-1 text-sm text-earth-600">
          {t('platform.wiseModal.subtitle')}
        </p>
        {!!orderLabel && (
          <p className="mt-2 text-xs text-earth-500">{t('platform.wiseModal.orderLabel', { orderLabel })}</p>
        )}
        <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-3">
          <p className="text-sm text-earth-700">{t('platform.wiseModal.expectedAmount')}</p>
          <p className="text-2xl font-bold text-earth-900">JPY {Math.max(0, Math.round(Number(amountJpy) || 0)).toLocaleString('en-US')}</p>
          <p className="mt-2 text-xs text-earth-500">
            {t('platform.wiseModal.amountHint')}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpenWise}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {t('platform.wiseModal.openWise')}
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="rounded-lg border border-earth-300 px-4 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
          >
            {t('platform.wiseModal.copyLink')}
          </button>
        </div>
        <p className="mt-2 break-all text-xs text-earth-500">{wisePayUrl}</p>

        <div className="mt-4">
          <label className="text-sm font-medium text-earth-800">{t('platform.wiseModal.receiptLabel')}</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            className="mt-2 block w-full text-sm text-earth-600 file:mr-2 file:rounded-lg file:border-0 file:bg-earth-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-earth-800"
          />
          {receiptFile ? <p className="mt-1 text-xs text-earth-500">{receiptFile.name}</p> : null}
        </div>

        {feedback ? (
          <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">{feedback}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSubmitReceipt}
            disabled={submitting || !receiptFile}
            className="flex-1 min-w-0 rounded-lg bg-earth-900 py-2.5 font-medium text-white hover:bg-earth-800 disabled:opacity-50"
          >
            {submitting ? t('platform.wiseModal.sending') : t('platform.wiseModal.submitReceipt')}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
          >
            {t('platform.wiseModal.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

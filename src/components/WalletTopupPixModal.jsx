/**
 * Modal PIX para recarga de carteira: QR Code, chave e upload de comprovante.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { LOCALE_EN } from '../lib/localeRoutes'
import { formatBrlForSite } from '../lib/moneyDisplay'
import { generatePixQr } from '../lib/pixQr'
import { PIX_CONFIG } from '../data/pixConfig'
import { uploadWalletTopupComprovante } from '../services/productService'
import { submitWalletTopupComprovante } from '../services/walletService'
import { formatBRL } from '../lib/fx'

export default function WalletTopupPixModal({ open, onClose, amountBrl, amountJpy, requestId, userId }) {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const numLocale = locale === 'en' ? 'en-US' : 'pt-BR'
  const [qrBase64, setQrBase64] = useState(null)
  const [comprovanteFile, setComprovanteFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const value = amountBrl != null ? Number(amountBrl) : null

  useEffect(() => {
    if (!open || value == null || value <= 0) {
      setQrBase64(null)
      return
    }
    let cancelled = false
    const run = async () => {
      const { dataUrl, error } = await generatePixQr({
        valueBrl: value,
        requestId,
      })
      if (!cancelled) {
        setQrBase64(error ? null : dataUrl)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [open, value, requestId])

  const handleCopyKey = () => {
    navigator.clipboard.writeText(PIX_CONFIG.key)
    setFeedback(t('platform.pixTopup.keyCopied'))
    setTimeout(() => setFeedback(''), 2000)
  }

  const handleSubmit = async () => {
    if (!requestId || !comprovanteFile) {
      setFeedback(t('platform.pixTopup.needReceipt'))
      return
    }
    if (!userId) {
      setFeedback(t('platform.pixTopup.userUnknown'))
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      const { data: url, error: upErr } = await uploadWalletTopupComprovante(
        comprovanteFile,
        userId,
        requestId
      )
      if (upErr) {
        setFeedback(upErr.message || t('platform.pixTopup.uploadError'))
        setSubmitting(false)
        return
      }
      const { error: subErr } = await submitWalletTopupComprovante(requestId, url)
      if (subErr) {
        setFeedback(subErr.message || t('platform.pixTopup.submitError'))
        setSubmitting(false)
        return
      }
      setFeedback(t('platform.pixTopup.sentSuccess'))
      setComprovanteFile(null)
      setTimeout(() => {
        onClose?.()
      }, 2000)
    } catch (e) {
      setFeedback(e?.message || t('platform.pixTopup.sendError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const feedbackOk = /sent|enviado/i.test(String(feedback))

  return (
    createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 relative"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-topup-pix-title"
      >
        {feedback && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center pointer-events-none">
            <p
              className={`rounded-lg px-4 py-2 text-sm ${
                feedbackOk ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {feedback}
            </p>
          </div>
        )}
        <div
          className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="wallet-topup-pix-title" className="font-semibold text-earth-900">
            {t('platform.pixTopup.title')}
          </h3>
          <p className="mt-1 text-sm text-earth-600">{t('platform.pixTopup.subtitle')}</p>

          {value != null && value > 0 && (
            <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-4 text-center">
              <p className="text-sm font-medium text-earth-800">{t('platform.pixTopup.amountDue')}</p>
              <p className="text-xl font-bold text-earth-900">{formatBrlForSite(locale, value)}</p>
              {locale === LOCALE_EN ? (
                <p className="mt-1 text-sm text-earth-600">
                  {t('platform.pixTopup.pixAmountBrl')}: {formatBRL(value)}
                </p>
              ) : null}
              {amountJpy != null && (
                <p className="mt-1 text-sm text-earth-600">
                  {t('platform.pixTopup.approxJpy', {
                    amount: Number(amountJpy).toLocaleString(numLocale),
                  })}
                </p>
              )}
            </div>
          )}

          {qrBase64 && (
            <div className="mt-4 flex justify-center">
              <img
                src={qrBase64}
                alt={t('platform.pixTopup.qrAlt')}
                className="h-48 w-48 rounded-lg border border-earth-200"
              />
            </div>
          )}

          <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-3">
            <p className="text-xs text-earth-600">{t('platform.pixTopup.pixKeyHelp')}</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white px-2 py-1.5 text-sm text-earth-800">
                {PIX_CONFIG.key}
              </code>
              <button
                type="button"
                onClick={handleCopyKey}
                className="shrink-0 rounded-lg bg-earth-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-earth-800"
              >
                {t('platform.pixTopup.copy')}
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <p className="text-sm font-medium text-earth-800">{t('platform.pixTopup.sendReceipt')}</p>
            <p className="text-xs text-earth-600">{t('platform.pixTopup.sendReceiptHint')}</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setComprovanteFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-earth-600 file:mr-2 file:rounded-lg file:border-0 file:bg-earth-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-earth-800"
            />
            {comprovanteFile && (
              <p className="text-xs text-earth-500">{comprovanteFile.name}</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !comprovanteFile}
              className="flex-1 min-w-0 rounded-lg bg-earth-900 py-2.5 font-medium text-white hover:bg-earth-800 disabled:opacity-50"
            >
              {submitting ? t('platform.pixTopup.sending') : t('platform.pixTopup.submitReceipt')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-50"
            >
              {t('platform.pixTopup.close')}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  )
}

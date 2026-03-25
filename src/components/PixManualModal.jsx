/**
 * Modal PIX manual: QR Code, chave e upload de comprovante.
 */
import { useState, useEffect } from 'react'
import { generatePixQr } from '../lib/pixQr'
import { PIX_CONFIG } from '../data/pixConfig'
import { uploadPixComprovante } from '../services/productService'
import { submitPixComprovante } from '../services/paymentService'
import { formatBRL } from '../lib/fx'

export default function PixManualModal({ open, onClose, onBack, order, amountBrl, amountJpy, userId }) {
  const [qrBase64, setQrBase64] = useState(null)
  const [comprovanteFile, setComprovanteFile] = useState(null)
  const [uploading, setUploading] = useState(false)
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
        orderId: order?.id,
      })
      if (!cancelled) {
        setQrBase64(error ? null : dataUrl)
      }
    }
    run()
    return () => { cancelled = true }
  }, [open, value, order?.id])

  const handleCopyKey = () => {
    navigator.clipboard.writeText(PIX_CONFIG.key)
    setFeedback('Chave copiada!')
    setTimeout(() => setFeedback(''), 2000)
  }

  const handleSubmit = async () => {
    if (!order?.id || !comprovanteFile) {
      setFeedback('Envie o comprovante de pagamento.')
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      const uid = userId || order?.user_id || order?.userId
      if (!uid) {
        setFeedback('Erro: usuário não identificado.')
        setSubmitting(false)
        return
      }
      const { data: url, error: upErr } = await uploadPixComprovante(
        comprovanteFile,
        uid,
        order.id
      )
      if (upErr) {
        setFeedback(upErr.message || 'Erro ao enviar comprovante.')
        setSubmitting(false)
        return
      }
      const { error: subErr } = await submitPixComprovante(order.id, url)
      if (subErr) {
        setFeedback(subErr.message || 'Erro ao registrar comprovante.')
        setSubmitting(false)
        return
      }
      setFeedback('Comprovante enviado! Verificaremos o mais rápido possível.')
      setComprovanteFile(null)
      setTimeout(() => {
        onClose?.()
      }, 2000)
    } catch (e) {
      setFeedback(e?.message || 'Erro ao enviar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 relative"
      onClick={onClose}
    >
      {feedback && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center pointer-events-none">
          <p
            className={`rounded-lg px-4 py-2 text-sm ${
              feedback.includes('enviado')
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
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
        <h3 className="font-semibold text-earth-900">Pagamento via PIX</h3>
        <p className="mt-1 text-sm text-earth-600">
          Por enquanto trabalhamos com PIX manual. Verificaremos o comprovante o mais rápido possível.
        </p>

        {value != null && value > 0 && (
          <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-4 text-center">
            <p className="text-sm font-medium text-earth-800">Valor a pagar</p>
            <p className="text-xl font-bold text-earth-900">{formatBRL(value)}</p>
          </div>
        )}

        {qrBase64 && (
          <div className="mt-4 flex justify-center">
            <img src={qrBase64} alt="QR Code PIX" className="h-48 w-48 rounded-lg border border-earth-200" />
          </div>
        )}

        <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-3">
          <p className="text-xs text-earth-600">Chave PIX (copie e cole no app do seu banco)</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-2 py-1.5 text-sm text-earth-800">
              {PIX_CONFIG.key}
            </code>
            <button
              type="button"
              onClick={handleCopyKey}
              className="shrink-0 rounded-lg bg-earth-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-earth-800"
            >
              Copiar
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-sm font-medium text-earth-800">Envie o comprovante</p>
          <p className="text-xs text-earth-600">
            Após realizar o pagamento, envie a imagem do comprovante abaixo. Por enquanto estamos trabalhando manualmente e verificaremos o mais rápido possível.
          </p>
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
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !comprovanteFile}
            className="flex-1 min-w-0 rounded-lg bg-earth-900 py-2.5 font-medium text-white hover:bg-earth-800 disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar comprovante'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

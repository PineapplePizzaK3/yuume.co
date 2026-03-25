/**
 * Utilitário para gerar QR Code PIX de forma confiável.
 * Garante parâmetros válidos conforme especificação BR Code (Bacen).
 */
import { QrCodePix } from 'qrcode-pix'
import QRCode from 'qrcode'
import { PIX_CONFIG } from '../data/pixConfig'

/** transactionId: máximo 25 caracteres, apenas alfanuméricos (padrão Bacen) */
export function safeTransactionId(id, prefix = '') {
  const base = String(id || '').replace(/[^A-Za-z0-9]/g, '')
  const withPrefix = prefix ? (prefix.replace(/[^A-Za-z0-9]/g, '') + base) : base
  const trimmed = withPrefix.slice(0, 25)
  if (trimmed.length >= 5) return trimmed
  const fallback = ('P' + Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9]/g, '').slice(0, 25)
  return fallback || 'PIX' + Date.now()
}

/** Valor em BRL: número positivo com 2 casas decimais */
export function safeValueBrl(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

/**
 * Gera QR Code PIX em base64 (data URL).
 * Retorna { dataUrl, payload } ou { error } em caso de falha.
 */
export async function generatePixQr({ valueBrl, transactionId, orderId, requestId }) {
  const value = safeValueBrl(valueBrl)
  if (value == null || value <= 0) {
    return { error: 'Valor inválido para PIX' }
  }

  let txId = transactionId
  if (!txId) {
    if (orderId) txId = safeTransactionId(orderId)
    else if (requestId) txId = safeTransactionId(requestId, 'T')
    else txId = safeTransactionId(null)
  } else {
    txId = safeTransactionId(txId)
  }

  const config = {
    version: '01',
    key: PIX_CONFIG.key?.trim() || '',
    name: String(PIX_CONFIG.name || 'Recebedor').trim().slice(0, 25),
    city: String(PIX_CONFIG.city || 'SAOPAULO').trim().slice(0, 15),
    value,
    transactionId: txId,
  }

  if (!config.key || config.key.length < 8) {
    return { error: 'Chave PIX não configurada' }
  }

  try {
    const qr = QrCodePix(config)
    const payload = qr.payload()
    let dataUrl
    try {
      dataUrl = await qr.base64({ margin: 2, width: 256 })
    } catch (imgErr) {
      dataUrl = await QRCode.toDataURL(payload, { margin: 2, width: 256 })
    }
    return { dataUrl, payload }
  } catch (e) {
    console.error('Erro ao gerar QR PIX:', e)
    return { error: e?.message || 'Erro ao gerar QR Code' }
  }
}

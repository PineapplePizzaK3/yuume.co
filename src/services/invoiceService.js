/**
 * Faturas — API server-side (/api/invoices).
 */
import { getPaymentsApiBase } from './paymentService'

async function parseJson(res) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
}

export async function listInvoices(accessToken) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/invoices`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await parseJson(res)
  if (!res.ok) {
    return { data: null, error: data?.error || res.statusText }
  }
  return { data: data?.invoices ?? [], error: null }
}

export async function getInvoice(accessToken, invoiceId) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/invoices?id=${encodeURIComponent(invoiceId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await parseJson(res)
  if (!res.ok) {
    return { data: null, error: data?.error || res.statusText }
  }
  return { data, error: null }
}

export async function getInvoiceByOrder(accessToken, orderId) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/invoices?orderId=${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await parseJson(res)
  if (!res.ok) {
    return { data: null, error: data?.error || res.statusText }
  }
  return { data, error: null }
}

export async function downloadInvoicePdf(accessToken, invoiceId, filename) {
  const base = getPaymentsApiBase()
  const res = await fetch(
    `${base}/invoices?id=${encodeURIComponent(invoiceId)}&format=pdf`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) {
    const err = await parseJson(res)
    throw new Error(err?.error || 'Falha ao gerar PDF')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'invoice.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadInvoicePdfByOrder(accessToken, orderId, filename) {
  const base = getPaymentsApiBase()
  const res = await fetch(
    `${base}/invoices?orderId=${encodeURIComponent(orderId)}&format=pdf`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) {
    const err = await parseJson(res)
    throw new Error(err?.error || 'Falha ao gerar PDF')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'invoice.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

export async function ensureInvoiceAdmin(accessToken, orderId) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'ensure_invoice', orderId }),
  })
  return parseJson(res)
}

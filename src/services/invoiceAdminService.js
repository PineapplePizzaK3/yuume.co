import { getPaymentsApiBase } from './paymentService'

async function parsePayload(res) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

function normalizeAdminApiError(res, data) {
  const raw = String(data?.error || res.statusText || '').trim()
  const looksProxyFailure =
    res.status === 500 &&
    /internal server error/i.test(raw)
  if (looksProxyFailure) {
    return 'API local indisponível. Inicie com `npm run dev:full` (Vercel) para habilitar rotas /api no ambiente de desenvolvimento.'
  }
  return raw || `HTTP ${res.status}`
}

export async function listFinancialDocumentsAdmin(accessToken, opts = {}) {
  const base = getPaymentsApiBase()
  const qs = new URLSearchParams()
  qs.set('scope', 'all')
  if (opts.kind) qs.set('kind', String(opts.kind))
  if (opts.userId) qs.set('userId', String(opts.userId))
  const res = await fetch(`${base}/invoices?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await parsePayload(res)
  if (!res.ok) return { data: null, error: normalizeAdminApiError(res, data) }
  return { data: data?.invoices || [], error: null }
}

export async function createInvoiceDocumentAdmin(accessToken, payload) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/create-invoice`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload || {}),
  })
  const data = await parsePayload(res)
  if (!res.ok) return { data: null, error: normalizeAdminApiError(res, data) }
  return { data, error: null }
}

export async function createCreditNoteAdmin(accessToken, payload) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/create-credit-note`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload || {}),
  })
  const data = await parsePayload(res)
  if (!res.ok) return { data: null, error: normalizeAdminApiError(res, data) }
  return { data, error: null }
}

export async function createPayoutStatementAdmin(accessToken, payload) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/create-payout`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload || {}),
  })
  const data = await parsePayload(res)
  if (!res.ok) return { data: null, error: normalizeAdminApiError(res, data) }
  return { data, error: null }
}

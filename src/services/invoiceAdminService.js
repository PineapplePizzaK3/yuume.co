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
  if (raw === 'Unknown action') {
    return 'A API em produção ainda não tem suporte a fatura manual. Faça deploy da versão mais recente do backend (/api/invoices).'
  }
  if (/^<!doctype html/i.test(raw) || /^<html/i.test(raw)) {
    return 'Resposta inválida da API (HTML em vez de JSON). Verifique se /api/invoices está disponível no servidor (Vercel) ou configure VITE_PAYMENTS_API_ORIGIN.'
  }
  return raw || `HTTP ${res.status}`
}

function validateInvoiceMutationResponse(res, data) {
  if (!res.ok) {
    return { data: null, error: normalizeAdminApiError(res, data) }
  }
  if (data?.ok === false) {
    return { data: null, error: String(data?.error || 'Falha ao processar documento financeiro') }
  }
  if (data?.error && !data?.invoice_id && !data?.document_id) {
    return { data: null, error: normalizeAdminApiError(res, data) }
  }
  return { data, error: null }
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
  const res = await fetch(`${base}/invoices`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ action: 'create_invoice', ...(payload || {}) }),
  })
  const data = await parsePayload(res)
  return validateInvoiceMutationResponse(res, data)
}

export async function createManualInvoiceAdmin(accessToken, payload) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/invoices`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ action: 'create_manual_invoice', ...(payload || {}) }),
  })
  const data = await parsePayload(res)
  return validateInvoiceMutationResponse(res, data)
}

export async function createCreditNoteAdmin(accessToken, payload) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/invoices`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ action: 'create_credit_note', ...(payload || {}) }),
  })
  const data = await parsePayload(res)
  if (!res.ok) return { data: null, error: normalizeAdminApiError(res, data) }
  return { data, error: null }
}

export async function createPayoutStatementAdmin(accessToken, payload) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/invoices`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ action: 'create_payout', ...(payload || {}) }),
  })
  const data = await parsePayload(res)
  if (!res.ok) return { data: null, error: normalizeAdminApiError(res, data) }
  return { data, error: null }
}

export async function deleteFinancialDocumentAdmin(accessToken, invoiceId) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/invoices`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ action: 'delete_document', invoiceId }),
  })
  const data = await parsePayload(res)
  if (!res.ok) return { data: null, error: normalizeAdminApiError(res, data) }
  return { data, error: null }
}

export async function deleteFinancialDocumentsAdmin(accessToken, invoiceIds = []) {
  const base = getPaymentsApiBase()
  const res = await fetch(`${base}/invoices`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ action: 'delete_documents', invoiceIds }),
  })
  const data = await parsePayload(res)
  if (!res.ok) return { data: null, error: normalizeAdminApiError(res, data) }
  return { data, error: null }
}

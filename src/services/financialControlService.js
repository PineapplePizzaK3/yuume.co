import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'

const ALLOWED_CURRENCIES = new Set(['JPY', 'USD', 'BRL'])
const ALLOWED_EXPENSE_KINDS = new Set(['general', 'shipping', 'order_related'])

function safeText(value) {
  return String(value ?? '').trim()
}

function safeNumber(value, fallback = 0) {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeCurrency(value) {
  const normalized = safeText(value).toUpperCase() || 'JPY'
  return ALLOWED_CURRENCIES.has(normalized) ? normalized : 'JPY'
}

function normalizeExpenseKind(value) {
  const normalized = safeText(value).toLowerCase() || 'general'
  return ALLOWED_EXPENSE_KINDS.has(normalized) ? normalized : 'general'
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => ({
      id: safeText(item?.id) || undefined,
      product_name: safeText(item?.product_name),
      quantity: safeNumber(item?.quantity, 0),
      unit_sale_amount: safeNumber(item?.unit_sale_amount, 0),
      unit_cost_amount: safeNumber(item?.unit_cost_amount, 0),
    }))
    .filter((item) => item.product_name)
}

function normalizeOrderPayload(payload = {}) {
  const currency = normalizeCurrency(payload?.currency)
  const rateDefault = currency === 'JPY' ? 1 : safeNumber(payload?.exchange_rate_to_jpy, 1)
  return {
    id: safeText(payload?.id) || undefined,
    reference: safeText(payload?.reference),
    sale_date: safeText(payload?.sale_date),
    customer_name: safeText(payload?.customer_name) || null,
    currency,
    exchange_rate_to_jpy: Math.max(rateDefault || 1, 0.000001),
    shipping_charged_amount: Math.max(safeNumber(payload?.shipping_charged_amount, 0), 0),
    discount_amount: Math.max(safeNumber(payload?.discount_amount, 0), 0),
    refund_amount: Math.max(safeNumber(payload?.refund_amount, 0), 0),
    notes: safeText(payload?.notes) || null,
    items: normalizeItems(payload?.items),
  }
}

function normalizeExpensePayload(payload = {}) {
  const currency = normalizeCurrency(payload?.currency)
  const rateDefault = currency === 'JPY' ? 1 : safeNumber(payload?.exchange_rate_to_jpy, 1)
  const kind = normalizeExpenseKind(payload?.expense_kind)
  return {
    id: safeText(payload?.id) || undefined,
    expense_date: safeText(payload?.expense_date),
    category: safeText(payload?.category),
    description: safeText(payload?.description),
    amount: Math.max(safeNumber(payload?.amount, 0), 0),
    currency,
    exchange_rate_to_jpy: Math.max(rateDefault || 1, 0.000001),
    expense_kind: kind,
    manual_order_id: safeText(payload?.manual_order_id) || null,
    notes: safeText(payload?.notes) || null,
  }
}

export async function listManualOrders(filters = {}) {
  try {
    const params = {
      p_from: safeText(filters?.from) || null,
      p_to: safeText(filters?.to) || null,
      p_search: safeText(filters?.search) || null,
      p_limit: Math.max(Number(filters?.limit) || 50, 1),
      p_offset: Math.max(Number(filters?.offset) || 0, 0),
    }
    const { data, error } = await withDbTimeout(callAdminRpc('admin_financial_list_manual_orders', params))
    return {
      data: {
        rows: Array.isArray(data?.rows) ? data.rows : [],
        total: Number(data?.total) || 0,
      },
      error,
    }
  } catch (e) {
    return { data: { rows: [], total: 0 }, error: toServiceError(e) }
  }
}

export async function getManualOrder(orderId) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_financial_get_manual_order', { p_order_id: orderId })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function saveManualOrder(payload) {
  try {
    const normalized = normalizeOrderPayload(payload)
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_financial_upsert_manual_order', { p_payload: normalized })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function deleteManualOrder(orderId) {
  try {
    const { error } = await withDbTimeout(
      callAdminRpc('admin_financial_delete_manual_order', { p_order_id: orderId })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

export async function listFinancialExpenses(filters = {}) {
  try {
    const params = {
      p_from: safeText(filters?.from) || null,
      p_to: safeText(filters?.to) || null,
      p_category: safeText(filters?.category) || null,
      p_manual_order_id: safeText(filters?.manualOrderId) || null,
      p_limit: Math.max(Number(filters?.limit) || 100, 1),
      p_offset: Math.max(Number(filters?.offset) || 0, 0),
    }
    const { data, error } = await withDbTimeout(callAdminRpc('admin_financial_list_expenses', params))
    return {
      data: {
        rows: Array.isArray(data?.rows) ? data.rows : [],
        total: Number(data?.total) || 0,
        categories: Array.isArray(data?.categories) ? data.categories : [],
      },
      error,
    }
  } catch (e) {
    return { data: { rows: [], total: 0, categories: [] }, error: toServiceError(e) }
  }
}

export async function saveFinancialExpense(payload) {
  try {
    const normalized = normalizeExpensePayload(payload)
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_financial_upsert_expense', { p_payload: normalized })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function deleteFinancialExpense(expenseId) {
  try {
    const { error } = await withDbTimeout(
      callAdminRpc('admin_financial_delete_expense', { p_expense_id: expenseId })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

export async function getFinancialSummary(filters = {}) {
  try {
    const params = {
      p_from: safeText(filters?.from) || null,
      p_to: safeText(filters?.to) || null,
    }
    const { data, error } = await withDbTimeout(callAdminRpc('admin_financial_summary', params))
    return {
      data: data ?? {
        kpis: {},
        monthly: [],
        expenses_by_category: [],
      },
      error,
    }
  } catch (e) {
    return {
      data: { kpis: {}, monthly: [], expenses_by_category: [] },
      error: toServiceError(e),
    }
  }
}

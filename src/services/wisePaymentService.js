import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'

export async function submitWisePaymentReceipt(requestId, receiptUrl) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('submit_wise_payment_receipt', {
        p_request_id: requestId,
        p_receipt_url: receiptUrl,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function listWisePaymentRequestsAdmin(status = 'submitted') {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_list_wise_payment_requests', {
        p_status: status || null,
      })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function approveWisePaymentRequestAdmin(requestId, transactionId = null) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_approve_wise_payment_request', {
        p_request_id: requestId,
        p_transaction_id: transactionId || null,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function rejectWisePaymentRequestAdmin(requestId, note = null) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_reject_wise_payment_request', {
        p_request_id: requestId,
        p_admin_note: note || null,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

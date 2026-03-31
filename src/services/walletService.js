/**
 * Wallet service - Carteira virtual.
 * Saldo pode ser usado para pagar frete, loja e serviços.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

/**
 * Retorna a carteira do usuário (saldo e moeda). Se não existir linha, retorna saldo 0.
 */
export async function getWallet(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wallets')
        .select('balance, currency, updated_at')
        .eq('user_id', userId)
        .maybeSingle()
    )
    if (error) return { data: null, error }
    return {
      data: data
        ? { balance: Number(data.balance) || 0, currency: data.currency || 'JPY', updated_at: data.updated_at }
        : { balance: 0, currency: 'JPY', updated_at: null },
      error: null,
    }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Lista as movimentações da carteira do usuário (extrato).
 */
export async function getWalletTransactions(userId, limit = 50) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wallet_transactions')
        .select('id, amount, balance_after, kind, type, description, reference_type, reference_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Admin: adiciona saldo na carteira do usuário (ajuste manual).
 */
export async function addWalletBalanceAdmin(userId, amount, description = null) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_wallet_credit', {
        p_user_id: userId,
        p_amount: Number(amount),
        p_description: description || null,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: remove saldo da carteira do usuário (ajuste manual).
 */
export async function removeWalletBalanceAdmin(userId, amount, description = null) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_wallet_debit', {
        p_user_id: userId,
        p_amount: Number(amount),
        p_description: description || null,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Criar solicitação de recarga via PIX (retorna request com amount_brl para QR).
 * amountBrl: valor em BRL para o QR (computado pelo frontend com jpyToBrl).
 */
export async function createWalletTopupRequest(userId, amountJpy, amountBrl) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('create_wallet_topup_request', {
        p_user_id: userId,
        p_amount_jpy: Number(amountJpy),
        p_amount_brl: Number(amountBrl),
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Enviar comprovante PIX para recarga de carteira.
 */
export async function submitWalletTopupComprovante(requestId, comprovanteUrl) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('submit_wallet_topup_comprovante', {
        p_request_id: requestId,
        p_comprovante_url: comprovanteUrl,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: listar solicitações de recarga PIX (pendentes ou todas).
 * Passar status = '' para listar todas.
 */
export async function getWalletTopupRequestsAdmin(status = 'pending') {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_list_wallet_topup_requests', {
        p_status: status || null,
      })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Admin: aprovar recarga PIX e creditar carteira.
 */
export async function approveWalletTopupAdmin(requestId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_approve_wallet_topup', { p_request_id: requestId })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: rejeitar recarga PIX.
 */
export async function rejectWalletTopupAdmin(requestId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_reject_wallet_topup', { p_request_id: requestId })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Pagar pedido (frete) com saldo da carteira. Requer usuário autenticado.
 */
export async function payOrderWithWallet(orderId, userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('wallet_pay_order', {
        p_order_id: orderId,
        p_user_id: userId,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

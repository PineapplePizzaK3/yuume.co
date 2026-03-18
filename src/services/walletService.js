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
        ? { balance: Number(data.balance) || 0, currency: data.currency || 'BRL', updated_at: data.updated_at }
        : { balance: 0, currency: 'BRL', updated_at: null },
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

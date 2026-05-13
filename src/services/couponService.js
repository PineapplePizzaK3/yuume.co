/**
 * Coupon service - validação de cupons no checkout.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

const COUPON_SCHEMA_MISSING_COLUMNS = ['owner_user_id', 'origin_type', 'origin_referral_id']

function isMissingCouponSchemaColumnError(error) {
  const raw = String(error?.message || '').toLowerCase()
  if (!raw) return false
  return COUPON_SCHEMA_MISSING_COLUMNS.some((col) => raw.includes(`coupons.${col}`) || raw.includes(col))
}

/**
 * Valida um cupom e retorna o desconto aplicável.
 * @param {string} code - Código do cupom
 * @param {number} subtotalBrl - Subtotal do carrinho em BRL
 * @returns {{ data?: { valid: boolean, discount_brl: number, code: string, description?: string }, error?: { message: string } }}
 */
export async function validateCoupon(code, subtotalBrl) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('validate_coupon', {
        p_code: code ? String(code).trim() : '',
        p_subtotal_brl: Number(subtotalBrl) || 0,
      })
    )
    if (error) {
      if (isMissingCouponSchemaColumnError(error)) {
        return { data: null, error: { message: 'Sistema de cupons em atualização. Tente novamente em instantes.' } }
      }
      return { data: null, error: { message: error.message } }
    }
    const result = data ?? {}
    if (result.valid && result.discount_brl != null) {
      return {
        data: {
          valid: true,
          coupon_id: result.coupon_id,
          code: result.code,
          discount_brl: Number(result.discount_brl),
          discount_type: result.discount_type,
          discount_value: result.discount_value,
          description: result.description,
        },
        error: null,
      }
    }
    return {
      data: null,
      error: { message: result.error || 'Cupom inválido' },
    }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Lista cupons pessoais do usuário (caixa de cupons).
 * @param {string} userId
 */
export async function getMyCoupons(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('coupons')
        .select(`
          id,
          code,
          discount_type,
          discount_value,
          min_order_brl,
          max_uses,
          used_count,
          valid_from,
          valid_until,
          description,
          origin_type
        `)
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: false })
    )
    if (error && isMissingCouponSchemaColumnError(error)) {
      return {
        data: [],
        error: { message: 'Sistema de cupons em atualização. Seus cupons voltarão a aparecer em breve.' },
      }
    }
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

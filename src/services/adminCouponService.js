import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

function isMissingCouponSchemaColumn(error) {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('origin_type') || msg.includes('owner_user_id')
}

export async function listCheckoutCouponsAdmin() {
  try {
    const queryWithReferralColumns = await withDbTimeout(
      supabase
        .from('coupons')
        .select('id, code, discount_type, discount_value, min_order_brl, max_uses, used_count, valid_from, valid_until, description, created_at, origin_type, owner_user_id')
        .order('created_at', { ascending: false })
    )

    if (queryWithReferralColumns.error && isMissingCouponSchemaColumn(queryWithReferralColumns.error)) {
      const legacyQuery = await withDbTimeout(
        supabase
          .from('coupons')
          .select('id, code, discount_type, discount_value, min_order_brl, max_uses, used_count, valid_from, valid_until, description, created_at')
          .order('created_at', { ascending: false })
      )
      if (legacyQuery.error) return { data: [], error: legacyQuery.error }
      return { data: legacyQuery.data ?? [], error: null }
    }

    if (queryWithReferralColumns.error) return { data: [], error: queryWithReferralColumns.error }

    const rows = (queryWithReferralColumns.data ?? []).filter((row) => {
      if (row.owner_user_id) return false
      if (!row.origin_type) return true
      return row.origin_type === 'manual'
    })
    return { data: rows, error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function createCheckoutCouponAdmin(payload) {
  try {
    const insertPayload = {
      code: String(payload?.code || '').trim().toUpperCase(),
      discount_type: payload?.discount_type,
      discount_value: Number(payload?.discount_value) || 0,
      min_order_brl: payload?.min_order_brl == null || payload?.min_order_brl === ''
        ? null
        : Number(payload.min_order_brl),
      max_uses: payload?.max_uses == null || payload?.max_uses === ''
        ? null
        : Math.max(1, Number(payload.max_uses) || 1),
      valid_from: payload?.valid_from || null,
      valid_until: payload?.valid_until || null,
      description: String(payload?.description || '').trim() || null,
      origin_type: 'manual',
      owner_user_id: null,
    }

    const { data, error } = await withDbTimeout(
      supabase
        .from('coupons')
        .insert(insertPayload)
        .select('id, code')
        .single()
    )

    if (error && isMissingCouponSchemaColumn(error)) {
      const { data: legacyData, error: legacyError } = await withDbTimeout(
        supabase
          .from('coupons')
          .insert({
            code: insertPayload.code,
            discount_type: insertPayload.discount_type,
            discount_value: insertPayload.discount_value,
            min_order_brl: insertPayload.min_order_brl,
            max_uses: insertPayload.max_uses,
            valid_from: insertPayload.valid_from,
            valid_until: insertPayload.valid_until,
            description: insertPayload.description,
          })
          .select('id, code')
          .single()
      )
      return { data: legacyData ?? null, error: legacyError || null }
    }

    return { data: data ?? null, error: error || null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

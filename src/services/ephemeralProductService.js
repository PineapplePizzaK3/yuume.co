import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

export async function createEphemeralProductSnapshot(hitPayload) {
  try {
    const payload = {
      storeId: hitPayload?.storeId || hitPayload?.store_id || null,
      productUrl: hitPayload?.productUrl || hitPayload?.external_url || null,
      title: hitPayload?.title || null,
      price: hitPayload?.price ?? 0,
      currency: hitPayload?.currency || 'JPY',
      imageUrl: hitPayload?.imageUrl || null,
      sourcePayload: hitPayload || {},
    }
    const { data, error } = await withDbTimeout(
      supabase.rpc('create_ephemeral_product', {
        p_payload: payload,
        p_ttl_minutes: 120,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function getPublicEphemeralProduct(token) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('get_public_ephemeral_product', {
        p_token: String(token || '').trim(),
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

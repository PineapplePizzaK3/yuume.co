import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { snapshotPayloadFromListing } from '../lib/ephemeralListing'

export async function createEphemeralProductSnapshot(hitPayload) {
  try {
    const fromListing = snapshotPayloadFromListing(hitPayload)
    const payload = {
      storeId: fromListing?.storeId || hitPayload?.storeId || hitPayload?.store_id || null,
      productUrl: fromListing?.productUrl || hitPayload?.productUrl || hitPayload?.external_url || null,
      title: fromListing?.title || hitPayload?.title || null,
      price: fromListing?.price ?? hitPayload?.price ?? 0,
      currency: fromListing?.currency || hitPayload?.currency || 'JPY',
      imageUrl: fromListing?.imageUrl || hitPayload?.imageUrl || null,
      imageUrls: fromListing?.imageUrls
        || (Array.isArray(hitPayload?.imageUrls)
          ? hitPayload.imageUrls.map((url) => String(url || '').trim()).filter(Boolean)
          : []),
      source: hitPayload?.source || fromListing?.source || null,
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

export async function updateEphemeralProductImages(token, imageUrls) {
  try {
    const urls = Array.isArray(imageUrls)
      ? imageUrls.map((url) => String(url || '').trim()).filter(Boolean)
      : []
    const { data, error } = await withDbTimeout(
      supabase.rpc('update_ephemeral_product_images', {
        p_token: String(token || '').trim(),
        p_image_urls: urls,
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

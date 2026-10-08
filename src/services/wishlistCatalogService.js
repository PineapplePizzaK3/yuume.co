import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { supabase } from '../lib/supabase'

const WISHLIST_COLUMNS =
  'id, user_id, catalog_item_id, target_price_jpy, priority, notes, created_at, updated_at'

const CATALOG_EMBED =
  'catalog_item:catalog_items(id, set_id, kind, franchise, number, name_ja, name_en, rarity, in_checklist, set:catalog_sets(id, set_code, name_ja, name_en, status))'

export async function listWishlistItems({ limit = 100 } = {}) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist_items')
        .select(`${WISHLIST_COLUMNS}, ${CATALOG_EMBED}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(Math.min(200, Math.max(1, Number(limit) || 100)))
    )
    if (error) return { data: [], error: toServiceError(error) }
    return { data: data || [], error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function getWishlistItemForCatalog(catalogItemId) {
  if (!catalogItemId) return { data: null, error: null }
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist_items')
        .select(WISHLIST_COLUMNS)
        .eq('catalog_item_id', catalogItemId)
        .maybeSingle()
    )
    if (error) return { data: null, error: toServiceError(error) }
    return { data: data || null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function upsertWishlistItem(catalogItemId, { targetPriceJpy, notes } = {}) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_wishlist_upsert', {
        p_catalog_item_id: catalogItemId,
        p_target_price_jpy: targetPriceJpy == null || targetPriceJpy === '' ? null : Number(targetPriceJpy),
        p_notes: notes == null ? null : String(notes),
      })
    )
    if (error) return { data: null, error: toServiceError(error) }
    return { data: data || null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function removeWishlistItem(catalogItemId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_wishlist_remove', { p_catalog_item_id: catalogItemId })
    )
    if (error) return { data: null, error: toServiceError(error) }
    return { data: data || null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

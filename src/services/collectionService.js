import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { supabase } from '../lib/supabase'

const COLLECTION_COLUMNS =
  'id, user_id, catalog_item_id, custom_snapshot, quantity, condition, grade, notes, source, order_item_id, holding_id, origin_ref, status, acquired_at, created_at, updated_at'

const CATALOG_EMBED =
  'catalog_item:catalog_items(id, set_id, kind, franchise, number, number_int, name_ja, name_en, rarity, attributes, in_checklist, image_url, image_provenance, set:catalog_sets(id, set_code, name_ja, name_en, status, release_date))'

/** Lists the current user's owned collection rows (newest first). No mock mode. */
export async function listOwnedCollectionItems({ limit = 200 } = {}) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('collection_items')
        .select(`${COLLECTION_COLUMNS}, ${CATALOG_EMBED}`)
        .eq('status', 'owned')
        .order('acquired_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(Math.min(500, Math.max(1, Number(limit) || 200)))
    )
    if (error) return { data: [], error: toServiceError(error) }
    return { data: data || [], error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/** Returns the owned row for a catalog item, or null. */
export async function getOwnedCollectionItem(catalogItemId) {
  if (!catalogItemId) return { data: null, error: null }
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('collection_items')
        .select(COLLECTION_COLUMNS)
        .eq('catalog_item_id', catalogItemId)
        .eq('status', 'owned')
        .maybeSingle()
    )
    if (error) return { data: null, error: toServiceError(error) }
    return { data: data || null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Idempotent own / unown.
 * @param {string} catalogItemId
 * @param {boolean} owned
 * @param {{ quantity?: number, source?: string, holdingId?: string }} [options]
 */
export async function setCatalogItemOwned(catalogItemId, owned, { quantity, source, holdingId } = {}) {
  try {
    const params = {
      p_catalog_item_id: catalogItemId,
      p_owned: Boolean(owned),
      p_quantity: quantity == null ? null : Number(quantity),
    }
    if (source != null || holdingId != null) {
      params.p_source = source || null
      params.p_holding_id = holdingId || null
    }
    const { data, error } = await withDbTimeout(supabase.rpc('service_collection_set_owned', params))
    if (error) return { data: null, error: toServiceError(error) }
    return { data: data || null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/** Bulk own / unown for onboarding. Idempotent. */
export async function bulkMarkCatalogItemsOwned(catalogItemIds, owned) {
  try {
    const ids = Array.isArray(catalogItemIds) ? catalogItemIds.filter(Boolean) : []
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_collection_bulk_mark', {
        p_catalog_item_ids: ids,
        p_owned: Boolean(owned),
      })
    )
    if (error) return { data: null, error: toServiceError(error) }
    return { data: data || null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

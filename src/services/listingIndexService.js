import { supabase } from '../lib/supabase'
import { listingIndexRowToHit } from '../lib/listingIndex.js'

export async function searchListingIndex({ query, stores = [], limit = 24 } = {}) {
  const q = String(query || '').trim()
  if (q.length < 2) return { data: [], error: null }
  try {
    const { data, error } = await supabase.rpc('search_listing_index', {
      p_query: q,
      p_stores: Array.isArray(stores) && stores.length ? stores : null,
      p_limit: Math.max(1, Math.min(Number(limit) || 24, 48)),
    })
    if (error) return { data: [], error }
    const hits = (Array.isArray(data) ? data : []).map(listingIndexRowToHit).filter(Boolean)
    return { data: hits, error: null }
  } catch (error) {
    return { data: [], error }
  }
}

export async function getListingIndexByUrl({ storeId, productUrl } = {}) {
  const url = String(productUrl || '').trim()
  if (!url) return { data: null, error: null }
  try {
    const { data, error } = await supabase.rpc('get_listing_index_by_url', {
      p_store_id: String(storeId || '').trim() || null,
      p_url: url,
    })
    if (error) return { data: null, error }
    return { data: listingIndexRowToHit(data), error: null }
  } catch (error) {
    return { data: null, error }
  }
}

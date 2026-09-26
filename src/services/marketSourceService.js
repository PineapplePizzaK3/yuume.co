import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'
import { supabase } from '../lib/supabase'

export const MARKET_SOURCE_TYPES = [
  'api',
  'partner',
  'affiliate',
  'own_data',
  'permitted_automation',
  'manual_sourcing',
  'link_out_only',
  'prohibited_automation',
]

export const MARKET_SOURCE_REVIEW_STATUSES = ['unreviewed', 'in_review', 'cleared', 'rejected']

export const MARKET_SOURCE_CAPABILITY_FLAGS = [
  'enabled',
  'can_search_automated',
  'can_display_price',
  'can_display_images',
  'can_link',
  'can_purchase_sourcing',
  'can_automate_snapshots',
  'legacy_search_allowed',
  'legacy_automation_allowed',
]

export async function adminListMarketSources() {
  try {
    const { data, error } = await withDbTimeout(callAdminRpc('admin_list_market_sources', {}))
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function adminUpdateMarketSource(sourceId, patch) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_market_source_update', {
        p_source_id: sourceId,
        p_patch: patch || {},
      })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/** Public projection (no review notes). Returns [] if the registry is not deployed yet. */
export async function listPublicMarketSources() {
  try {
    const { data, error } = await withDbTimeout(supabase.rpc('service_market_sources_public'))
    if (error) return { data: [], error: toServiceError(error) }
    return { data: Array.isArray(data) ? data : [], error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

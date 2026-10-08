import { buildRecommendations } from '../lib/recommendations'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { supabase } from '../lib/supabase'
import { getCollectorPreferences, updateCollectorPreferences } from './trackedSetService'

/**
 * Loads recommendation candidates from the RPC and ranks them client-side.
 * Returns empty buckets when the user is logged out or the RPC is unavailable.
 */
export async function getCollectorRecommendations({ userId, limit = 12 } = {}) {
  try {
    const { data: candidates, error } = await withDbTimeout(
      supabase.rpc('service_collector_recommendation_candidates', { p_limit: 80 })
    )
    if (error) return { data: emptyBuckets(), error: toServiceError(error) }

    const prefsRes = userId ? await getCollectorPreferences(userId) : { data: {} }
    const ranked = buildRecommendations(Array.isArray(candidates) ? candidates : [], prefsRes.data || {}, {
      limit,
    })
    return { data: ranked, error: null }
  } catch (e) {
    return { data: emptyBuckets(), error: toServiceError(e) }
  }
}

export async function dismissRecommendationItem(userId, catalogItemId) {
  if (!userId || !catalogItemId) return { data: null, error: toServiceError(new Error('Parâmetros inválidos')) }
  try {
    const prefs = await getCollectorPreferences(userId)
    const dismissed = new Set((prefs.data?.dismissed_items || []).map(String))
    dismissed.add(String(catalogItemId))
    return updateCollectorPreferences(userId, { dismissed_items: [...dismissed].slice(0, 200) })
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

function emptyBuckets() {
  return { foundForYou: [], goodTiming: [], finishYourSet: [], related: [] }
}

import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { supabase } from '../lib/supabase'

const PREF_DEFAULT = { followed_franchises: [], followed_sets: [], dismissed_items: [] }

function normalizePrefs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    followed_franchises: Array.isArray(src.followed_franchises) ? src.followed_franchises.map(String) : [],
    followed_sets: Array.isArray(src.followed_sets) ? src.followed_sets.map(String) : [],
    dismissed_items: Array.isArray(src.dismissed_items) ? src.dismissed_items.map(String) : [],
  }
}

export async function listTrackedSetIds() {
  try {
    const { data, error } = await withDbTimeout(
      supabase.from('tracked_sets').select('set_id, created_at').order('created_at', { ascending: false })
    )
    if (error) return { data: [], error: toServiceError(error) }
    return { data: data || [], error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function trackSet(setId, track = true) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_collector_track_set', { p_set_id: setId, p_track: Boolean(track) })
    )
    if (error) return { data: null, error: toServiceError(error) }
    return { data: data || null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function getTrackedSetProgress() {
  try {
    const { data, error } = await withDbTimeout(supabase.rpc('service_collector_set_progress'))
    if (error) return { data: [], error: toServiceError(error) }
    return { data: Array.isArray(data) ? data : [], error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function getMissingItems(setId, { limit = 100, offset = 0 } = {}) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_collector_missing_items', {
        p_set_id: setId,
        p_limit: Number(limit) || 100,
        p_offset: Number(offset) || 0,
      })
    )
    if (error) return { data: [], error: toServiceError(error) }
    return { data: Array.isArray(data) ? data : [], error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function getCollectorPreferences(userId) {
  if (!userId) return { data: normalizePrefs(PREF_DEFAULT), error: null }
  try {
    const { data, error } = await withDbTimeout(
      supabase.from('profiles').select('collector_preferences').eq('id', userId).maybeSingle()
    )
    if (error) return { data: normalizePrefs(PREF_DEFAULT), error: toServiceError(error) }
    return { data: normalizePrefs(data?.collector_preferences), error: null }
  } catch (e) {
    return { data: normalizePrefs(PREF_DEFAULT), error: toServiceError(e) }
  }
}

export async function updateCollectorPreferences(userId, patch) {
  if (!userId) return { data: null, error: toServiceError(new Error('userId obrigatório')) }
  try {
    const current = await getCollectorPreferences(userId)
    const next = normalizePrefs({ ...current.data, ...(patch || {}) })
    const { data, error } = await withDbTimeout(
      supabase
        .from('profiles')
        .update({ collector_preferences: next })
        .eq('id', userId)
        .select('collector_preferences')
        .single()
    )
    if (error) return { data: null, error: toServiceError(error) }
    return { data: normalizePrefs(data?.collector_preferences), error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

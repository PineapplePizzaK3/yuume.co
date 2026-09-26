import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'
import { supabase } from '../lib/supabase'

export const CATALOG_SET_STATUSES = ['PENDING', 'IMPORTED', 'VALIDATING', 'VERIFIED']

const SET_COLUMNS =
  'id, franchise, set_code, name_ja, name_en, release_date, set_kind, status, official_reference_url, official_manifest, checklist_scope, import_source, import_ref, imported_at, validation_report, validated_at, checklist_version, verified_by, verified_at, updated_at'
const ITEM_COLUMNS =
  'id, set_id, kind, franchise, number, number_int, name_ja, name_en, rarity, attributes, external_refs, in_checklist, image_url, image_provenance'

function sanitizeSearchTerm(query) {
  return String(query ?? '')
    .replace(/[,()*%\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/** @param {{ status?: string|string[] }} [options] */
export async function listSets({ status } = {}) {
  try {
    let query = supabase.from('catalog_sets').select(SET_COLUMNS).order('release_date', { ascending: false, nullsFirst: false })
    if (Array.isArray(status)) query = query.in('status', status)
    else if (status) query = query.eq('status', status)
    const { data, error } = await withDbTimeout(query)
    if (error) return { data: [], error: toServiceError(error) }
    return { data: data || [], error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function getSet(setId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.from('catalog_sets').select(SET_COLUMNS).eq('id', setId).maybeSingle()
    )
    if (error) return { data: null, error: toServiceError(error) }
    return { data: data || null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function listSetItems(setId, { includeOutOfChecklist = true } = {}) {
  try {
    const pageSize = 1000
    const rows = []
    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from('catalog_items')
        .select(ITEM_COLUMNS)
        .eq('set_id', setId)
        .order('number_int', { ascending: true, nullsFirst: false })
        .order('number', { ascending: true })
        .range(from, from + pageSize - 1)
      if (!includeOutOfChecklist) query = query.eq('in_checklist', true)
      const { data, error } = await withDbTimeout(query)
      if (error) return { data: rows, error: toServiceError(error) }
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
    return { data: rows, error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function getItem(itemId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('catalog_items')
        .select(`${ITEM_COLUMNS}, set:catalog_sets(id, set_code, name_ja, name_en, status, release_date, franchise)`)
        .eq('id', itemId)
        .maybeSingle()
    )
    if (error) return { data: null, error: toServiceError(error) }
    return { data: data || null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/** Text search over names and numbers. Collector surfaces should keep verifiedOnly = true. */
export async function searchCatalog(query, { verifiedOnly = true, limit = 30 } = {}) {
  const term = sanitizeSearchTerm(query)
  if (term.length < 1) return { data: [], error: null }
  try {
    const setJoin = verifiedOnly
      ? 'set:catalog_sets!inner(id, set_code, name_ja, name_en, status)'
      : 'set:catalog_sets(id, set_code, name_ja, name_en, status)'
    let request = supabase
      .from('catalog_items')
      .select(`${ITEM_COLUMNS}, ${setJoin}`)
      .or(`name_ja.ilike.%${term}%,name_en.ilike.%${term}%,number.eq.${term}`)
      .order('number_int', { ascending: true, nullsFirst: false })
      .limit(Math.min(100, Math.max(1, Number(limit) || 30)))
    if (verifiedOnly) request = request.eq('set.status', 'VERIFIED')
    const { data, error } = await withDbTimeout(request)
    if (error) return { data: [], error: toServiceError(error) }
    return { data: data || [], error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

async function adminCall(fn, params) {
  try {
    const { data, error } = await withDbTimeout(callAdminRpc(fn, params))
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export function adminUpsertCatalogManifest(payload) {
  return adminCall('admin_catalog_upsert_manifest', { p_payload: payload || {} })
}

export function adminImportCatalogItems(setId, items, { source = 'manual_csv', prune = false } = {}) {
  return adminCall('admin_catalog_import_items', {
    p_set_id: setId,
    p_items: items,
    p_source: source,
    p_prune: Boolean(prune),
  })
}

export function adminRecordCatalogValidation(setId, report) {
  return adminCall('admin_catalog_record_validation', { p_set_id: setId, p_report: report })
}

export function adminSaveCatalogReview(setId, review) {
  return adminCall('admin_catalog_save_review', { p_set_id: setId, p_review: review || {} })
}

export function adminSetCatalogStatus(setId, status, note = null) {
  return adminCall('admin_catalog_set_status', { p_set_id: setId, p_status: status, p_note: note })
}

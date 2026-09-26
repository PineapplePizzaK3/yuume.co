import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'
import { supabase } from '../lib/supabase'

export async function adminListCollectorBatches(limit = 200, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_list_batches', {
        p_limit: Number(limit) || 200,
        p_offset: Number(offset) || 0,
      })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function adminUpsertCollectorBatch(payload) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_upsert_batch', { p_payload: payload || {} })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminSetCollectorBatchStatus(batchId, status) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_set_batch_status', {
        p_batch_id: batchId,
        p_status: status,
      })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminListCollectorAllocations(batchId, limit = 200, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_list_allocations', {
        p_batch_id: batchId,
        p_limit: Number(limit) || 200,
        p_offset: Number(offset) || 0,
      })
    )
    return { data: data || { rows: [], total: 0 }, error }
  } catch (e) {
    return { data: { rows: [], total: 0 }, error: toServiceError(e) }
  }
}

export async function adminListCollectorSessions(batchId = null) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_list_sessions', { p_batch_id: batchId || null })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function adminUpsertCollectorSession(payload) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_upsert_session', { p_payload: payload || {} })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminAddCollectorPull(payload) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_add_pull', { p_payload: payload || {} })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminListCollectorPulls(sessionId) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_list_pulls', { p_session_id: sessionId })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function adminDeleteCollectorPull(pullId) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_delete_pull', { p_pull_id: pullId })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminPublishCollectorSession(sessionId) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_publish_session', { p_session_id: sessionId })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminListCollectorGradingQueue(limit = 200, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_list_grading_queue', {
        p_limit: Number(limit) || 200,
        p_offset: Number(offset) || 0,
      })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function adminCompleteCollectorPsaGrading(assetId, payload = {}) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_complete_psa_grading', {
        p_asset_id: assetId,
        p_payload: payload || {},
      })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminCancelCollectorPsaGrading(assetId, reason = '') {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_collector_cancel_psa_grading', {
        p_asset_id: assetId,
        p_reason: reason || null,
      })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminListOpeningTopCardOverrides(collectionKey) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_opening_top_card_overrides', {
        p_collection_key: collectionKey || null,
      })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function adminUpsertOpeningTopCardOverride(payload) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_opening_upsert_top_card_override', { p_payload: payload || {} })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

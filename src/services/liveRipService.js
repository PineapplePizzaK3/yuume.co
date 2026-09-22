import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'
import {
  LIVE_RIPS_BASE_PULLS,
  LIVE_RIPS_PRODUCTS,
  LIVE_RIPS_QUEUE,
  getLiveRipProductById,
  getLiveRipProductsByCategory,
} from '../data/liveRipsMock'

function formatJpyLabel(value) {
  const n = Number(value || 0)
  return `¥${Math.max(0, n).toLocaleString('ja-JP')}`
}

function mapDbProduct(row) {
  if (!row) return null
  const priceJpy = Number(row.price_jpy || 0)
  return {
    id: row.id,
    categoryId: row.category_id || 'uncategorized',
    name: row.name || row.id,
    nameEn: row.name_en || row.name || row.id,
    type: row.type || 'Booster Box',
    language: row.language || 'Japanese',
    image: row.image_url || '',
    source: row.source || 'SNKRDUNK',
    collectionTitle: row.collection_title || row.name || row.id,
    shrinkwrapOption: row.shrinkwrap_option || null,
    snkrdunkApparelId: row.snkrdunk_apparel_id || null,
    popularityRank: Number.isFinite(Number(row.popularity_rank)) ? Number(row.popularity_rank) : null,
    priceJpy,
    priceLabel: row.price_label || formatJpyLabel(priceJpy),
    availableRips: Number.isFinite(Number(row.available_rips)) ? Number(row.available_rips) : 0,
  }
}

export async function listLiveRipProductsByCategory(categoryId = '') {
  try {
    let query = supabase
      .from('live_rip_products')
      .select('*')
      .eq('is_active', true)
      .order('popularity_rank', { ascending: true, nullsFirst: false })

    if (categoryId) query = query.eq('category_id', categoryId)
    const { data, error } = await withDbTimeout(query)
    if (error) throw new Error(error.message || 'Erro ao carregar catálogo de Live Rips')

    const rows = Array.isArray(data) ? data.map(mapDbProduct).filter(Boolean) : []
    if (rows.length > 0) return { data: rows, error: null }

    // Fallback de segurança para ambiente sem migração aplicada.
    return { data: getLiveRipProductsByCategory(categoryId), error: null }
  } catch (e) {
    return { data: getLiveRipProductsByCategory(categoryId), error: toServiceError(e) }
  }
}

export async function reserveLiveRipProduct(productId, customerNote = '') {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_live_rips_reserve', {
        p_product_id: productId,
        p_event_id: null,
        p_customer_note: customerNote || null,
      })
    )
    if (error) return { data: null, error }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function getMyLiveRipReservation() {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_live_rips_my_reservation', { p_event_id: null })
    )
    if (error) throw new Error(error.message || 'Erro ao carregar sua reserva')
    return { data, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function getMyLiveRipPulls() {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_live_rips_my_pulls', { p_event_id: null })
    )
    if (error) throw new Error(error.message || 'Erro ao carregar pulls da sua Rip')
    return { data: Array.isArray(data) ? data : [], error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function getLiveRipQueue() {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_live_rips_public_queue', { p_event_id: null })
    )
    if (error) throw new Error(error.message || 'Erro ao carregar fila da live')
    return {
      data: {
        event: data?.event || null,
        rows: Array.isArray(data?.rows) ? data.rows : [],
      },
      error: null,
    }
  } catch (e) {
    // Fallback para modo protótipo.
    return {
      data: {
        event: null,
        rows: LIVE_RIPS_QUEUE.map((row) => ({
          id: row.ripCode,
          rip_code: row.ripCode,
          customer_name: row.customerName,
          product_id: row.productId,
          product_name: getLiveRipProductById(row.productId)?.name || '',
          product_name_en: getLiveRipProductById(row.productId)?.nameEn || '',
          product_image: getLiveRipProductById(row.productId)?.image || '',
          status: 'reserved',
        })),
      },
      error: toServiceError(e),
    }
  }
}

export async function getLiveRipPulls() {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_live_rips_public_pulls', { p_event_id: null })
    )
    if (error) throw new Error(error.message || 'Erro ao carregar pulls da live')
    return { data: Array.isArray(data) ? data : [], error: null }
  } catch (e) {
    return {
      data: LIVE_RIPS_BASE_PULLS.map((pull) => ({
        id: pull.id,
        card_name: pull.name,
        rarity: pull.rarity,
        image_url: pull.image,
      })),
      error: toServiceError(e),
    }
  }
}

export async function payLiveRipReservationWithWallet(reservationId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('service_live_rips_pay_with_wallet', { p_reservation_id: reservationId })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminListLiveRipReservations(limit = 200, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_list_reservations', {
        p_event_id: null,
        p_limit: limit,
        p_offset: offset,
      })
    )
    return { data: data || { rows: [], total: 0 }, error }
  } catch (e) {
    return { data: { rows: [], total: 0 }, error: toServiceError(e) }
  }
}

export async function adminSetLiveRipReservationStatus(reservationId, status, ripCode = '') {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_set_reservation_status', {
        p_reservation_id: reservationId,
        p_status: status,
        p_rip_code: ripCode || null,
      })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminAddLiveRipPull(payload) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_add_pull', { p_payload: payload || {} })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminSearchLiveRipCards({ query = '', collectionKey = '', limit = 30 } = {}) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_search_cards', {
        p_query: query || null,
        p_collection_key: collectionKey || null,
        p_limit: Math.max(1, Math.min(Number(limit) || 30, 100)),
      })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function adminUpsertLiveRipCard(payload) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_upsert_card', { p_payload: payload || {} })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminListLiveRipEvents(limit = 100, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_list_events', {
        p_limit: limit,
        p_offset: offset,
      })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function adminUpsertLiveRipEvent(payload) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_upsert_event', { p_payload: payload || {} })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminListLiveRipProducts(params = {}) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_list_products', {
        p_category_id: params.categoryId || null,
        p_active_only: !!params.activeOnly,
        p_limit: Number(params.limit) || 500,
        p_offset: Number(params.offset) || 0,
      })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function adminUpsertLiveRipProduct(payload) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_upsert_product', { p_payload: payload || {} })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminAdjustLiveRipStock(productId, delta, reason = '') {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_adjust_stock', {
        p_product_id: productId,
        p_delta: Number(delta) || 0,
        p_reason: reason || null,
      })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function adminFinalizeLiveRipToInventory(reservationId, notes = '') {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_live_rips_finalize_to_inventory', {
        p_reservation_id: reservationId,
        p_notes: notes || null,
      })
    )
    return { data: data || null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

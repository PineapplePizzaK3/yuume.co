/**
 * Inventário do usuário e envios/consolidação.
 * Itens recebidos (user_inventory) e solicitação de envio (shipments).
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

/**
 * Lista itens do inventário do usuário (status stored ou ready_for_shipment).
 */
export async function getMyInventory(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('user_inventory')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['stored', 'ready_for_shipment'])
        .order('created_at', { ascending: false })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Cria solicitação de envio (consolidação) com os itens selecionados.
 */
export async function createShipment(userId, inventoryIds) {
  if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
    return { data: null, error: { message: 'Selecione pelo menos um item.' } }
  }
  try {
    const { data: shipment, error: shipError } = await withDbTimeout(
      supabase
        .from('shipments')
        .insert({ user_id: userId, status: 'requested' })
        .select()
        .single()
    )
    if (shipError || !shipment) {
      return { data: null, error: shipError ?? toServiceError('Erro ao criar envio') }
    }
    const items = inventoryIds.map((invId) => ({
      shipment_id: shipment.id,
      inventory_id: invId,
    }))
    const { error: itemsError } = await withDbTimeout(
      supabase.from('shipment_items').insert(items)
    )
    if (itemsError) {
      await supabase.from('shipments').delete().eq('id', shipment.id)
      return { data: null, error: itemsError }
    }
    return { data: shipment, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: registra pacote na conta do usuário (com dados completos).
 */
export async function registerPackageAdmin(userId, { products_description, items_count, weight_kg, order_id, photo_url, video_url }) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_register_package', {
        p_user_id: userId,
        p_products_description: products_description || '',
        p_items_count: items_count ?? null,
        p_weight_kg: weight_kg ?? null,
        p_order_id: order_id || null,
        p_photo_url: photo_url || null,
        p_video_url: video_url || null,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: adiciona item ao inventário do usuário a partir de um pedido (item recebido).
 */
export async function addInventoryFromOrderAdmin(orderId, { name, notes, weight_kg, photo_url, video_url }) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_add_inventory_from_order', {
        p_order_id: orderId,
        p_name: name || '',
        p_notes: notes || null,
        p_weight_kg: weight_kg ?? null,
        p_photo_url: photo_url || null,
        p_video_url: video_url || null,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Lista envios do usuário.
 */
export async function getMyShipments(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('shipments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

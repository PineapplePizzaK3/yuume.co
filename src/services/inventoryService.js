/**
 * Inventário do usuário e envios/consolidação.
 * Itens recebidos (user_inventory) e solicitação de envio (shipments).
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

/**
 * Lista itens do inventário do usuário (status stored ou ready_for_shipment).
 */
export async function getMyInventory(userId, options = {}) {
  const limit = Math.max(1, Number(options?.limit) || 30)
  const offset = Math.max(0, Number(options?.offset) || 0)
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('user_inventory')
        // Embeds do pedido para classificar a origem do item (loja vs redirecionamento vs personal shopping)
        .select(`
          id,
          order_id,
          name,
          notes,
          weight_kg,
          photo_url,
          video_url,
          status,
          created_at,
          updated_at,
          products_description,
          items_count,
          received_at,
          orders(order_source, order_module)
        `)
        .eq('user_id', userId)
        .in('status', ['stored', 'ready_for_shipment'])
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Cria solicitação de envio (consolidação) com os itens selecionados.
 * @param {string} userId
 * @param {string[]} inventoryIds
 * @param {{ extra_services?: { photos?: boolean, video?: boolean } }} options
 */
export async function createShipment(userId, inventoryIds, options = {}) {
  if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
    return { data: null, error: { message: 'Selecione pelo menos um item.' } }
  }
  const extraServices = options.extra_services && typeof options.extra_services === 'object'
    ? Object.fromEntries(
        Object.entries(options.extra_services).map(([k, v]) => [k, !!v])
      )
    : {}
  try {
    const { data: shipment, error: shipError } = await withDbTimeout(
      supabase
        .from('shipments')
        .insert({ user_id: userId, status: 'requested', extra_services: extraServices })
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

    // Faz o "request" aparecer no painel do admin.
    // O admin só consegue definir frete quando o order.status está em ready_for_shipment/products_paid.
    // Aqui sincronizamos orders + user_inventory com base nos inventoryIds selecionados.
    const { error: quoteErr } = await withDbTimeout(
      supabase.rpc('user_request_shipment_quote_to_admin', {
        p_user_id: userId,
        p_inventory_ids: inventoryIds,
      }),
      60000
    )
    if (quoteErr) {
      // Mantém o shipment criado, mas registra o erro no retorno para o UI reagir.
      return { data: shipment, error: quoteErr }
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
 * Admin: define frete no envio.
 */
export async function setShipmentFreightAdmin(shipmentId, cost, currency = 'JPY') {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('admin_set_shipment_freight', {
        p_shipment_id: shipmentId,
        p_shipping_cost: cost,
        p_currency: currency || 'JPY',
      })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

/**
 * Admin: marca envio como enviado (com rastreio).
 */
export async function setShipmentShippedAdmin(shipmentId, trackingCode = '') {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('admin_set_shipment_shipped', {
        p_shipment_id: shipmentId,
        p_tracking_code: trackingCode || null,
      })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

/**
 * Admin: marca envio como finalizado.
 */
export async function setShipmentCompletedAdmin(shipmentId) {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('admin_set_shipment_completed', { p_shipment_id: shipmentId })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

/**
 * Admin: marca envio como pago (confirmação manual).
 */
export async function setShipmentPaidAdmin(shipmentId) {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('admin_set_shipment_paid', { p_shipment_id: shipmentId })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

/**
 * Admin: dados do painel de envios (shipments, pedidos em fluxo, inventário pronto).
 */
export async function getShippingPanelAdmin(options = {}) {
  const shipmentsLimit = Number(options?.shipmentsLimit) || 200
  const ordersLimit = Number(options?.ordersLimit) || 300
  const inventoryLimit = Number(options?.inventoryLimit) || 300
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_get_shipping_panel', {
        p_limit_shipments: shipmentsLimit,
        p_limit_orders: ordersLimit,
        p_limit_inventory_ready: inventoryLimit,
      })
    )
    if (error) return { data: null, error }
    const panel = data ?? {}
    return {
      data: {
        shipments: Array.isArray(panel.shipments) ? panel.shipments : [],
        orders: Array.isArray(panel.orders) ? panel.orders : [],
        inventoryReady: Array.isArray(panel.inventory_ready) ? panel.inventory_ready : [],
      },
      error: null,
    }
  } catch (e) {
    return {
      data: { shipments: [], orders: [], inventoryReady: [] },
      error: toServiceError(e),
    }
  }
}

/**
 * Usuário cancela solicitação de envio (apenas quando status = requested).
 */
export async function cancelShipment(userId, shipmentId) {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('user_cancel_shipment', { p_shipment_id: shipmentId })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

/**
 * Lista envios do usuário.
 */
export async function getMyShipments(userId, options = {}) {
  const limit = Math.max(1, Number(options?.limit) || 20)
  const offset = Math.max(0, Number(options?.offset) || 0)
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('shipments')
        .select(`
          id,
          user_id,
          status,
          shipping_cost,
          shipping_currency,
          tracking_code,
          extra_services,
          created_at,
          updated_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Detalhes de um envio: lista itens vinculados (shipment_items + user_inventory).
 * RLS garante que o usuário só verá os seus envios.
 */
export async function getShipmentItems(shipmentId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('shipment_items')
        .select(`
          id,
          inventory_id,
          user_inventory (
            id,
            name,
            status,
            items_count,
            weight_kg
          )
        `)
        .eq('shipment_id', shipmentId)
        .order('id', { ascending: true })
    )
    return { data: Array.isArray(data) ? data : [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

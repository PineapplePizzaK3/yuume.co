/**
 * Inventário do usuário e envios/consolidação.
 * Itens recebidos (user_inventory) e solicitação de envio (shipments).
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'

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
          product:products(image_url),
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
 * Quantidade de itens no inventário do usuário (stored + ready_for_shipment por padrão).
 */
export async function getMyInventoryCount(userId, options = {}) {
  const statuses = Array.isArray(options?.statuses) && options.statuses.length > 0
    ? options.statuses.filter(Boolean)
    : ['stored', 'ready_for_shipment']
  try {
    let q = supabase
      .from('user_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (statuses.length > 0) q = q.in('status', statuses)
    const { count, error } = await withDbTimeout(q)
    return { data: Number(count) || 0, error }
  } catch (e) {
    return { data: 0, error: toServiceError(e) }
  }
}

/**
 * Cria solicitação de envio (consolidação) com os itens selecionados.
 * @param {string} userId
 * @param {string[]} inventoryIds
 * @param {{ extra_services?: Record<string, unknown> }} options
 */
export async function createShipment(userId, inventoryIds, options = {}) {
  if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
    return { data: null, error: { message: 'Selecione pelo menos um item.' } }
  }
  const extraServices = options.extra_services && typeof options.extra_services === 'object'
    ? Object.fromEntries(
        Object.entries(options.extra_services)
          .filter(([k]) => !!k)
          .map(([k, v]) => {
            if (typeof v === 'boolean') return [k, v]
            if (typeof v === 'number' && Number.isFinite(v)) return [k, v]
            if (typeof v === 'string') return [k, v]
            if (Array.isArray(v)) return [k, v]
            if (v && typeof v === 'object') return [k, v]
            return [k, null]
          })
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
 * Converte products_description gravada pelo admin (ex.: "2x Item (100); 1x Outro (0)")
 * em linhas editáveis.
 */
export function parseInventoryProductsForEdit(text) {
  const raw = String(text || '').trim()
  if (!raw) return [{ name: '', quantity: '1', price: '' }]
  const parts = raw.split(';').map((s) => s.trim()).filter(Boolean)
  const rows = []
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*x\s+(.+?)\s*\(\s*([-0-9.]+)\s*\)\s*$/i)
    if (m) {
      rows.push({
        name: m[2].trim(),
        quantity: String(Math.max(1, parseInt(m[1], 10) || 1)),
        price: m[3],
      })
      continue
    }
    const m2 = part.match(/^(\d+)\s*x\s+(.+)$/i)
    if (m2) {
      rows.push({
        name: m2[2].trim(),
        quantity: String(Math.max(1, parseInt(m2[1], 10) || 1)),
        price: '',
      })
    }
  }
  if (rows.length === 0) return [{ name: raw, quantity: '1', price: '' }]
  return rows
}

/**
 * Admin: atualiza um pacote/inventário do usuário (nome, produtos, peso, mídias, notas).
 */
export async function updateUserInventoryAdmin(inventoryId, payload) {
  const { name, notes, weight_kg, photo_url, video_url, products } = payload || {}
  const validProducts = Array.isArray(products)
    ? products.filter((p) => String(p?.name || '').trim())
    : []

  let finalName = String(name || '').trim()
  let finalDesc = ''
  let finalItemsCount = 1

  if (validProducts.length > 0) {
    finalName = validProducts[0].name.trim()
    finalDesc = validProducts
      .map((p) => {
        const q = Math.max(1, parseInt(p.quantity, 10) || 1)
        const price = Number.isFinite(Number(p.price)) ? Number(p.price) : 0
        return `${q}x ${p.name.trim()} (${price})`
      })
      .join('; ')
    finalItemsCount = validProducts.reduce(
      (s, p) => s + Math.max(1, parseInt(p.quantity, 10) || 1),
      0
    )
  } else if (finalName) {
    finalDesc = ''
    finalItemsCount = 1
  }

  if (!finalName) {
    return { data: null, error: { message: 'Informe o nome do pacote ou pelo menos um produto.' } }
  }

  let w = null
  if (weight_kg !== '' && weight_kg != null && String(weight_kg).trim() !== '') {
    const parsed = parseFloat(weight_kg)
    if (!Number.isFinite(parsed)) {
      return { data: null, error: { message: 'Peso inválido.' } }
    }
    w = parsed
  }

  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_update_user_inventory', {
        p_inventory_id: inventoryId,
        p_name: finalName,
        p_notes: notes != null && String(notes).trim() !== '' ? String(notes).trim() : null,
        p_weight_kg: w,
        p_photo_url: photo_url != null && String(photo_url).trim() !== '' ? String(photo_url).trim() : null,
        p_video_url: video_url != null && String(video_url).trim() !== '' ? String(video_url).trim() : null,
        p_products_description: finalDesc || null,
        p_items_count: finalItemsCount,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: remove um pacote do inventário do usuário.
 */
export async function deleteUserInventoryAdmin(inventoryId) {
  try {
    const { error } = await withDbTimeout(
      callAdminRpc('admin_delete_user_inventory', { p_inventory_id: inventoryId })
    )
    if (error && /admin_delete_user_inventory|function/i.test(String(error.message || ''))) {
      // Fallback para ambientes sem o RPC aplicado.
      const { error: directError } = await withDbTimeout(
        supabase.from('user_inventory').delete().eq('id', inventoryId)
      )
      return { error: directError ?? null }
    }
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

/**
 * Admin: registra pacote na conta do usuário (com dados completos).
 * Suporta tanto o formato antigo (products_description) quanto o novo (products array).
 */
export async function registerPackageAdmin(userId, payload) {
  const {
    products_description,
    products,
    items_count,
    weight_kg,
    order_id,
    photo_url,
    video_url
  } = payload || {}

  try {
    const rpcPayload = {
      p_user_id: userId,
      p_order_id: order_id || null,
      p_weight_kg: weight_kg ?? null,
      p_photo_url: photo_url || null,
      p_video_url: video_url || null,
    }

    // Novo formato: array de produtos
    if (Array.isArray(products) && products.length > 0) {
      rpcPayload.p_products = products.map((p) => ({
        name: String(p?.name || '').trim(),
        quantity: Math.max(1, parseInt(p?.quantity, 10) || 1),
        price: Number.isFinite(Number(p?.price)) ? Number(p.price) : 0,
      }))
      rpcPayload.p_products_description = products.map(p => 
        `${p.quantity || 1}x ${p.name} (${p.price || 0})`
      ).join('; ')
    } 
    // Formato antigo (compatibilidade)
    else if (products_description) {
      rpcPayload.p_products_description = products_description
    } else {
      rpcPayload.p_products_description = 'Pacote registrado via admin'
    }

    if (items_count != null) rpcPayload.p_items_count = items_count

    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_register_package', rpcPayload)
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
      callAdminRpc('admin_add_inventory_from_order', {
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
 * Admin: define frete no envio (opcional: breakdown JSON no pedido principal vinculado).
 */
export async function setShipmentFreightAdmin(shipmentId, cost, currency = 'JPY', breakdown = null) {
  try {
    const { error } = await withDbTimeout(
      callAdminRpc('admin_set_shipment_freight', {
        p_shipment_id: shipmentId,
        p_shipping_cost: cost,
        p_currency: currency || 'JPY',
        p_breakdown: breakdown && typeof breakdown === 'object' ? breakdown : null,
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
      callAdminRpc('admin_set_shipment_shipped', {
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
      callAdminRpc('admin_set_shipment_completed', { p_shipment_id: shipmentId })
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
      callAdminRpc('admin_set_shipment_paid', { p_shipment_id: shipmentId })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

/**
 * Admin: remove envio da conta do usuário.
 */
export async function deleteShipmentAdmin(shipmentId) {
  try {
    const { error } = await withDbTimeout(
      callAdminRpc('admin_delete_shipment', { p_shipment_id: shipmentId })
    )
    if (error && /admin_delete_shipment|function/i.test(String(error.message || ''))) {
      // Fallback para ambientes onde o RPC ainda não foi aplicado.
      const { error: directError } = await withDbTimeout(
        supabase.from('shipments').delete().eq('id', shipmentId)
      )
      return { error: directError ?? null }
    }
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
      callAdminRpc('admin_get_shipping_panel', {
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
 * @param {{ limit?: number, offset?: number, statusIn?: string[] }} options — se statusIn for informado, filtra por esses status.
 */
export async function getMyShipments(userId, options = {}) {
  const limit = Math.max(1, Number(options?.limit) || 20)
  const offset = Math.max(0, Number(options?.offset) || 0)
  const statusIn = Array.isArray(options?.statusIn) ? options.statusIn.filter(Boolean) : []
  try {
    let q = supabase
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
    if (statusIn.length > 0) {
      q = q.in('status', statusIn)
    }
    const { data, error } = await withDbTimeout(
      q.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
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
            weight_kg,
            products_description
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

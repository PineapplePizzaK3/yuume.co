/**
 * Order service - Pedidos e fluxo:
 * Pedido → Pagamento do pedido → Recebimento (serviços extras) → Cliente pede envio →
 * Consolidamos e definimos frete → Cliente paga frete → Enviamos.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

/** Statuses do pedido */
export const ORDER_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  AWAITING_QUOTE: 'awaiting_quote',
  QUOTED: 'quoted',
  AWAITING_ARRIVAL: 'awaiting_arrival',
  ITEM_RECEIVED: 'item_received',
  STORED: 'stored',
  READY_FOR_SHIPMENT: 'ready_for_shipment',
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  PRODUCTS_PAID: 'products_paid',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
}

export const ORDER_STATUS_LABELS = {
  pending_approval: 'Aguardando aprovação',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  awaiting_quote: 'Aguardando orçamento',
  quoted: 'Orçamento enviado',
  awaiting_arrival: 'Aguardando chegada',
  item_received: 'Pacotes recebidos',
  stored: 'Em armazenamento',
  ready_for_shipment: 'Pronto para envio',
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  products_paid: 'Produtos pagos (frete pendente)',
  shipped: 'Enviado',
  completed: 'Finalizado',
}

/**
 * Busca serviços disponíveis (Redirecionamento com módulos Padrão/Assistido, Personal Shopping).
 */
export async function getServices() {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: true })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Cria pedido - usuário solicita.
 * Redirecionamento:
 * - self_buy (Redirecionamento Padrão): status pending_approval
 * - assisted_buy (Redirecionamento Assistido, pré-pagamento): status awaiting_quote (admin define orçamento)
 * Personal Shopping: status awaiting_quote.
 */
export async function createOrder(userId, { service_id, message, attachment_urls, service_name, order_module }) {
  const isPersonalShopping = service_name === 'Personal Shopping'
  const isRedirecionamento = service_name === 'Redirecionamento'
  const module = order_module || null
  const isAssistedBuy = isRedirecionamento && module === 'assisted_buy'
  const status = (isPersonalShopping || isAssistedBuy) ? ORDER_STATUS.AWAITING_QUOTE : ORDER_STATUS.PENDING_APPROVAL
  const urls = Array.isArray(attachment_urls) ? attachment_urls.filter(Boolean) : []
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('orders')
        .insert({
          user_id: userId,
          created_by: userId,
          service_id: service_id ?? null,
          message: message || null,
          attachment_urls: urls,
          order_module: module,
          status,
        })
        .select()
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Lista pedidos do usuário logado.
 */
export async function getMyOrders(userId, options = {}) {
  const limit = Math.max(1, Number(options?.limit) || 20)
  const offset = Math.max(0, Number(options?.offset) || 0)
  const status = typeof options?.status === 'string' ? options.status : null
  const excludeStatus = typeof options?.excludeStatus === 'string' ? options.excludeStatus : null
  try {
    let query = supabase
      .from('orders')
      .select(`
      *,
      service:services(name),
      order_items(
        id,
        quantity,
        price_at_purchase,
        product:products(name, image_url)
      )
    `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (excludeStatus) query = query.neq('status', excludeStatus)

    const { data, error } = await withDbTimeout(
      query
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Usuário: editar pedido (por enquanto, apenas message).
 */
export async function updateMyOrder(userId, orderId, updates) {
  try {
    const payload = {}
    if (typeof updates?.message === 'string') payload.message = updates.message.trim() || null
    if (typeof updates?.attachment_urls !== 'undefined') payload.attachment_urls = updates.attachment_urls

    const { data, error } = await withDbTimeout(
      supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId)
        .eq('user_id', userId)
        .select()
        .single()
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Usuário: remover pedido.
 */
export async function deleteMyOrder(userId, orderId) {
  try {
    const { error } = await withDbTimeout(
      supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .eq('user_id', userId)
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

/**
 * Busca um pedido por ID (para o dono do pedido).
 */
export async function getOrderById(orderId, userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('orders')
        .select(`
      *,
      service:services(name),
      order_items(
        id,
        quantity,
        price_at_purchase,
        product:products(name, image_url)
      )
    `)
        .eq('id', orderId)
        .eq('user_id', userId)
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: lista todos os pedidos com dados do usuário.
 */
export async function getAllOrdersAdmin(limit = 300, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_orders_with_users', {
        p_limit: limit,
        p_offset: offset,
      })
    )
    const orders = Array.isArray(data) ? data : []
    return { data: orders, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Admin: atualiza status do pedido.
 */
export async function updateOrderStatusAdmin(orderId, status) {
  const valid = Object.values(ORDER_STATUS).includes(status)
  if (!valid) {
    return { data: null, error: { message: 'Status inválido' } }
  }

  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_update_order_status', {
        p_order_id: orderId,
        p_status: status,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: define o custo do frete e marca como aguardando pagamento.
 */
export async function setShippingAndAwaitPaymentAdmin(orderId, shippingCost, currency = 'JPY') {
  const cost = parseFloat(shippingCost)
  if (isNaN(cost) || cost < 0) {
    return { data: null, error: { message: 'Valor do frete inválido' } }
  }

  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_set_shipping_await_payment', {
        p_order_id: orderId,
        p_shipping_cost: cost,
        p_currency: currency || 'JPY',
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: edita dados do pedido.
 */
export async function updateOrderAdmin(orderId, updates) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_update_order', {
        p_order_id: orderId,
        p_payload: updates,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: aprova pedido.
 */
export async function approveOrderAdmin(orderId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_approve_order', { p_order_id: orderId })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: define orçamento (Personal Shopping) e marca como aguardando pagamento.
 */
export async function setQuoteAdmin(orderId, quoteAmount, currency = 'BRL', message = null) {
  const amount = parseFloat(quoteAmount)
  if (isNaN(amount) || amount < 0) {
    return { data: null, error: { message: 'Valor do orçamento inválido' } }
  }
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_set_quote', {
        p_order_id: orderId,
        p_quote_amount: amount,
        p_currency: currency || 'BRL',
        p_message: message ?? null,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: rejeita pedido.
 */
export async function rejectOrderAdmin(orderId, reason = null) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_reject_order', { p_order_id: orderId, p_reason: reason })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: cria pedido na conta do usuário.
 */
export async function createOrderForUserAdmin(userId, { service_id, message } = {}) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_create_order_for_user', {
        p_user_id: userId,
        p_service_id: service_id ?? null,
        p_message: message ?? null,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: remove pedido.
 */
export async function deleteOrderAdmin(orderId) {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('admin_delete_order', {
        p_order_id: orderId,
      })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

/**
 * Usuário solicita serviços extras (fotos, vídeo) para pedido em status item_received.
 */
export async function requestOrderExtraServices(orderId, extraServices) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('request_order_extra_services', {
        p_order_id: orderId,
        p_extra_services: extraServices || {},
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

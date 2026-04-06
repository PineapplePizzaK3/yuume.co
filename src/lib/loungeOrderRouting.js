/**
 * Pedidos que entram na aba Envios do Lounge (fluxo de envio internacional do pedido).
 * Espelha em grande parte o painel admin de "fluxo de envio", do ponto de vista do cliente.
 */

function numPositive(n) {
  const v = Number(n)
  return Number.isFinite(v) && v > 0
}

/**
 * @param {Record<string, unknown> | null | undefined} order
 * @returns {boolean}
 */
export function isOrderInLoungeShippingTab(order) {
  if (!order?.status) return false
  const st = String(order.status)
  if (st === 'completed') return false

  if (['ready_for_shipment', 'products_paid', 'shipped'].includes(st)) return true

  if (st === 'awaiting_payment') {
    if (order.shipping_quote_breakdown && typeof order.shipping_quote_breakdown === 'object') return true
    return numPositive(order.shipping_cost)
  }

  if (st === 'paid') {
    if (numPositive(order.shipping_cost)) return true
    if (order.shipping_quote_breakdown && typeof order.shipping_quote_breakdown === 'object') return true
    if (order.order_source === 'store' && order.ship_immediately) return true
    return false
  }

  return false
}

/**
 * Valor a pagar na aba Envios quando o pedido está aguardando pagamento do frete.
 * Prioriza frete quando já foi orçado (shipping_cost / breakdown), mesmo se quote_amount ainda existir no registro.
 * @param {Record<string, unknown> | null | undefined} order
 * @returns {{ amount: number, currency: string, kind: 'shipping' } | null}
 */
export function getLoungeShippingTabPayableAmount(order) {
  if (!order || order.status !== 'awaiting_payment') return null
  if (!numPositive(order.shipping_cost) && !(order.shipping_quote_breakdown && typeof order.shipping_quote_breakdown === 'object')) {
    return null
  }
  return {
    amount: Number(order.shipping_cost) || 0,
    currency: order.shipping_currency || 'JPY',
    kind: 'shipping',
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} order
 */
export function readUserShippingQuoteBreakdown(order) {
  const raw = order?.shipping_quote_breakdown
  if (!raw || typeof raw !== 'object') return null
  const base = Number(raw.base_shipping)
  const perItem = Number(raw.redirect_fee_per_item)
  const perItemTotal = Number(raw.redirect_fee_total)
  const itemsCount = Number(raw.items_count)
  const bufferPercent = Number(raw.shipping_buffer_percent)
  const bufferAmount = Number(raw.shipping_buffer_amount)
  const finalTotal = Number(raw.final_total)
  return {
    base: Number.isFinite(base) ? base : 0,
    perItem: Number.isFinite(perItem) ? perItem : 0,
    perItemTotal: Number.isFinite(perItemTotal) ? perItemTotal : 0,
    itemsCount: Number.isFinite(itemsCount) ? itemsCount : 0,
    bufferPercent: Number.isFinite(bufferPercent) ? bufferPercent : 0,
    bufferAmount: Number.isFinite(bufferAmount) ? bufferAmount : 0,
    finalTotal: Number.isFinite(finalTotal) ? finalTotal : null,
    currency: String(raw.currency || order?.shipping_currency || 'JPY'),
  }
}

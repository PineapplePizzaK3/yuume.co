/**
 * Padrão de orçamento: lista de produtos com nome, valor e descrição.
 * Armazenado em orders.message como JSON: { quoteProducts: [...], orderDescription?: string }
 */

export const QUOTE_PRODUCTS_KEY = 'quoteProducts'
export const ORDER_DESCRIPTION_KEY = 'orderDescription'

export function parseQuoteMessage(message) {
  if (!message || typeof message !== 'string') return null
  try {
    const parsed = JSON.parse(message)
    const products = parsed?.[QUOTE_PRODUCTS_KEY]
    if (!Array.isArray(products)) return null
    return {
      products,
      orderDescription: typeof parsed?.[ORDER_DESCRIPTION_KEY] === 'string' ? parsed.orderDescription : null,
    }
  } catch {
    return null
  }
}

export function serializeQuoteProducts(products, orderDescription = null) {
  const list = (products ?? []).map((p) => ({
    name: String(p.name ?? '').trim() || null,
    valor: parseFloat(p.valor) || 0,
    quantidade: Math.max(1, parseInt(p.quantidade, 10) || 1),
    descricao: String(p.descricao ?? '').trim() || null,
  }))
  const obj = { [QUOTE_PRODUCTS_KEY]: list }
  if (orderDescription?.trim()) obj[ORDER_DESCRIPTION_KEY] = orderDescription.trim()
  return JSON.stringify(obj)
}

/**
 * Taxa de redirecionamento por item (JPY) — tabela interna do orçamento de envio.
 * 1 item ¥1.000 · 2–4 itens ¥750/item · 5+ itens ¥500/item
 * @param {number} itemsCount — quantidade total de unidades (soma das quantidades dos itens)
 */
export function getDefaultRedirectFeePerItem(itemsCount) {
  const n = Math.floor(Number(itemsCount) || 0)
  if (n <= 1) return 1000
  if (n <= 4) return 750
  return 500
}

/**
 * Taxas de serviço — Personal Shopping e Grupo de Compras (alinhado ao site e ao RPC create_store_order).
 */
export const SERVICE_FEE_JPY_PER_ITEM = 200
export const GRUPO_COMPRAS_FEE_PERCENT = 20
export const PERSONAL_SHOPPING_FEE_PERCENT = 25

/**
 * Taxa extra em BRL para itens de Grupo de Compras: % sobre subtotal dos produtos do grupo + ¥200 por unidade.
 * @param {number} grupoSubtotalBrl
 * @param {number} grupoUnitsQty soma das quantidades (unidades) dos itens do grupo
 * @param {number} brlPerJpy cotação BRL por 1 JPY (ex.: 0,033)
 */
export function computeGrupoComprasFeeBrl(grupoSubtotalBrl, grupoUnitsQty, brlPerJpy) {
  const sub = Number(grupoSubtotalBrl) || 0
  const qty = Math.max(0, Math.floor(Number(grupoUnitsQty) || 0))
  const fx = Number(brlPerJpy) > 0 ? Number(brlPerJpy) : 0.033
  if (sub <= 0 || qty <= 0) return 0
  return sub * (GRUPO_COMPRAS_FEE_PERCENT / 100) + SERVICE_FEE_JPY_PER_ITEM * fx * qty
}

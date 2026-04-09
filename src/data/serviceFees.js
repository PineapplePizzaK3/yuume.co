/**
 * Taxas de serviço — Personal Shopping e Compras Programadas (alinhado ao site e ao RPC create_store_order).
 */
export const SERVICE_FEE_JPY_PER_ITEM = 250
/** Taxa fixa por unidade nas Compras Programadas (USD); BRL só para exibição (× usd_brl). */
export const GRUPO_COMPRAS_FEE_PER_UNIT_USD = 1.9
export const GRUPO_COMPRAS_FEE_PERCENT = 20
export const PERSONAL_SHOPPING_FEE_PERCENT = 25
export const REDIR_ASSISTIDO_FEE_PERCENT = 15

/**
 * Pré-pagamento antecipado (assistido): taxa de serviço sobre o valor declarado dos produtos + débito total na carteira.
 * @param {number} productsJpy valor total dos produtos em JPY (inteiro)
 * @param {number} [feePercent] default REDIR_ASSISTIDO_FEE_PERCENT
 * @returns {{ productsJpy: number, feeJpy: number, totalDebitJpy: number } | null}
 */
export function computeAssistedEarlyPrepayDebitJpy(productsJpy, feePercent = REDIR_ASSISTIDO_FEE_PERCENT) {
  const p = Math.max(0, Math.floor(Number(productsJpy) || 0))
  if (p < 1) return null
  const pct = Number(feePercent)
  const fee = Math.round(p * (Number.isFinite(pct) && pct >= 0 ? pct : REDIR_ASSISTIDO_FEE_PERCENT) / 100)
  return { productsJpy: p, feeJpy: fee, totalDebitJpy: p + fee }
}

/** Texto único da escada de taxa por item (Padrão e Assistido usam a mesma tabela). */
export const REDIRECIONAMENTO_ITEM_FEE_SUMMARY =
  '1 item: ¥1.000 · 2 a 4 itens: ¥750 por item · 5 ou mais itens: ¥500 por item'

/**
 * Redirecionamento Padrão por quantidade de itens:
 * 1 item → ¥1000
 * 2-4 itens → ¥750 por item
 * 5+ itens → ¥500 por item
 */
export function computeRedirecionamentoPadraoFeeJpy(totalItems) {
  const qty = Math.max(0, Math.floor(Number(totalItems) || 0))
  if (qty <= 0) return 0
  if (qty === 1) return 1000
  if (qty <= 4) return 750 * qty
  return 500 * qty
}

/**
 * Taxa extra em BRL para itens de Compras Programadas: % sobre subtotal dos produtos do grupo + ¥250 por unidade.
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

/**
 * Taxa do grupo: % sobre subtotal USD + taxa fixa USD/unidade → valor em BRL (somente display).
 */
export function computeGrupoComprasFeeDisplayBrl(grupoSubtotalUsd, grupoUnitsQty, usdBrl) {
  const sub = Number(grupoSubtotalUsd) || 0
  const qty = Math.max(0, Math.floor(Number(grupoUnitsQty) || 0))
  const r = Number(usdBrl) > 0 ? Number(usdBrl) : 0
  if (sub <= 0 || qty <= 0 || r <= 0) return 0
  const feeUsd = sub * (GRUPO_COMPRAS_FEE_PERCENT / 100) + GRUPO_COMPRAS_FEE_PER_UNIT_USD * qty
  return feeUsd * r
}

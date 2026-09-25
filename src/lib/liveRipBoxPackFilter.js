/**
 * Live Rips: apenas caixas que contêm packs (booster boxes).
 * Exclui packs soltos e caixas especiais sem pack no título.
 * Usa só nome/coleção — o campo `type` do scrape costuma ser genérico demais.
 */

export function isLiveRipBoxWithPacksProduct(product) {
  if (!product) return false
  const text = [
    product.name,
    product.nameEn,
    product.collectionTitle,
    product.title,
  ]
    .filter(Boolean)
    .join(' ')

  const hasBox = /ボックス|booster\s*box/i.test(text)
  const hasPack = /パック|(?:^|[^a-z])packs?(?:[^a-z]|$)/i.test(text)
  return hasBox && hasPack
}

export function filterLiveRipBoxWithPacksProducts(products) {
  return (Array.isArray(products) ? products : []).filter(isLiveRipBoxWithPacksProduct)
}

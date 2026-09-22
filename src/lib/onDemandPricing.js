/** Preço On-Demand = preço original × multiplicador (padrão 1.15). */

export const ON_DEMAND_PRICE_MULTIPLIER_DEFAULT = 1.15

export function resolveOnDemandPriceMultiplier(settingsOrValue) {
  const raw =
    settingsOrValue && typeof settingsOrValue === 'object' && !Array.isArray(settingsOrValue)
      ? settingsOrValue?.on_demand_price_multiplier?.amount ?? settingsOrValue?.amount
      : settingsOrValue
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return ON_DEMAND_PRICE_MULTIPLIER_DEFAULT
  return n
}

export function applyOnDemandPriceJpy(basePriceJpy, multiplier = ON_DEMAND_PRICE_MULTIPLIER_DEFAULT) {
  const base = Math.max(0, Number(basePriceJpy) || 0)
  const m = resolveOnDemandPriceMultiplier(multiplier)
  return Math.round(base * m)
}

export function formatOnDemandPriceLabel(priceJpy, locale = 'pt-BR') {
  const yen = Math.max(0, Math.round(Number(priceJpy) || 0))
  return `¥${yen.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')}`
}

export const SELL_BACK_MARKET_PERCENT = 85

export function sellBackRate() {
  return SELL_BACK_MARKET_PERCENT / 100
}

export function computeSellBackOfferJpy(marketValueJpy) {
  const value = Number(marketValueJpy || 0)
  if (!(value > 0)) return 0
  return Math.floor(value * sellBackRate())
}

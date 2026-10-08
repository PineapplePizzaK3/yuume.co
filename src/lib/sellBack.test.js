import { describe, expect, it } from 'vitest'
import { computeSellBackOfferJpy, SELL_BACK_MARKET_PERCENT } from './sellBack.js'

describe('computeSellBackOfferJpy', () => {
  it('offers 85% of market value', () => {
    expect(SELL_BACK_MARKET_PERCENT).toBe(85)
    expect(computeSellBackOfferJpy(1000)).toBe(850)
    expect(computeSellBackOfferJpy(999)).toBe(849)
  })

  it('returns 0 without a market value', () => {
    expect(computeSellBackOfferJpy(0)).toBe(0)
    expect(computeSellBackOfferJpy(null)).toBe(0)
  })
})

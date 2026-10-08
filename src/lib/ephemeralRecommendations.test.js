import { describe, expect, it } from 'vitest'
import {
  buildEphemeralRecommendationQuery,
  rankEphemeralRecommendations,
} from './ephemeralRecommendations.js'

describe('buildEphemeralRecommendationQuery', () => {
  it('drops condition tags and keeps the product words', () => {
    const query = buildEphemeralRecommendationQuery(
      '【美品】ポケモンカード ピカチュウ 025/165 SV2a 送料無料'
    )
    expect(query).toContain('ピカチュウ')
    expect(query).toContain('ポケモンカード')
    expect(query).toContain('SV2a')
    expect(query).not.toContain('美品')
    expect(query).not.toContain('送料無料')
  })

  it('returns an empty query when the title has no searchable words', () => {
    expect(buildEphemeralRecommendationQuery('【中古】')).toBe('')
    expect(buildEphemeralRecommendationQuery('')).toBe('')
  })
})

describe('rankEphemeralRecommendations', () => {
  const source = {
    title: 'ポケモンカード ピカチュウ SV2a',
    productUrl: 'https://jp.mercari.com/item/m111',
    priceJpy: 3000,
  }

  it('drops the current listing, sold rows, and unrelated titles', () => {
    const { items } = rankEphemeralRecommendations(
      [
        { title: 'ポケモンカード ピカチュウ SV2a', productUrl: 'https://jp.mercari.com/item/m111?ref=1', storeId: 'mercari', price: 3100 },
        { title: 'ポケモンカード ピカチュウ SV2a', productUrl: 'https://rakuma.rakuten.co.jp/item/1', storeId: 'rakuma', price: 2800, tags: ['sold'] },
        { title: 'シャンプー ボトル', productUrl: 'https://www.amazon.co.jp/dp/B000000000', storeId: 'amazon', price: 500 },
        { title: 'ポケモンカード ピカチュウ', productUrl: 'https://paypayfleamarket.yahoo.co.jp/item/z1', storeId: 'yahoo_flea', price: 2600 },
      ],
      source
    )
    expect(items.map((item) => item.storeId)).toEqual(['yahoo_flea'])
  })

  it('shows a different marketplace before repeating the best store', () => {
    const { items, storeCount } = rankEphemeralRecommendations(
      [
        { title: 'ピカチュウ SV2a', productUrl: 'https://jp.mercari.com/item/m1', storeId: 'mercari', price: 3000 },
        { title: 'ピカチュウ SV2a', productUrl: 'https://jp.mercari.com/item/m2', storeId: 'mercari', price: 2900 },
        { title: 'ピカチュウ SV2a', productUrl: 'https://jp.mercari.com/item/m3', storeId: 'mercari', price: 2800 },
        { title: 'ピカチュウ SV2a', productUrl: 'https://auctions.yahoo.co.jp/jp/auction/a1', storeId: 'yahoo', price: 8000 },
        { title: 'ピカチュウ SV2a', productUrl: 'https://www.amazon.co.jp/dp/B00EXAMPLE', storeId: 'amazon', price: 3200 },
      ],
      source,
      { limit: 4, perStore: 2 }
    )
    expect(items.slice(0, 3).map((item) => item.storeId)).toEqual(['mercari', 'amazon', 'yahoo'])
    expect(items.filter((item) => item.storeId === 'mercari')).toHaveLength(2)
    expect(storeCount).toBe(3)
  })
})

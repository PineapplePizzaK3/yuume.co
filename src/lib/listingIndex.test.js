import { describe, expect, it } from 'vitest'
import { listingIndexRowToHit, mergeLiveHitsWithIndex, mergeVisibleHitsWithLiveRefresh, prepareIndexSearchHits, evaluateIndexSufficiency } from './listingIndex.js'

describe('mergeLiveHitsWithIndex', () => {
  it('keeps the live hit when the same URL is also in the index', () => {
    const live = [{ productUrl: 'https://item.fril.jp/abc?ref=1', title: 'live', storeId: 'rakuma' }]
    const index = [{ productUrl: 'https://item.fril.jp/abc', title: 'stale', storeId: 'rakuma' }]
    const merged = mergeLiveHitsWithIndex(live, index)
    expect(merged).toHaveLength(1)
    expect(merged[0].title).toBe('live')
  })

  it('appends index-only listings after live hits', () => {
    const live = [{ productUrl: 'https://jp.mercari.com/item/m1', title: 'A', storeId: 'mercari' }]
    const index = [{ productUrl: 'https://item.fril.jp/xyz', title: 'B', storeId: 'rakuma' }]
    expect(mergeLiveHitsWithIndex(live, index).map((hit) => hit.title)).toEqual(['A', 'B'])
  })
})

describe('listingIndexRowToHit', () => {
  it('maps a stored row into a catalog hit', () => {
    const hit = listingIndexRowToHit({
      store_id: 'rakuma',
      external_url: 'https://item.fril.jp/abc',
      title: 'ピカチュウ',
      price_jpy: 1200,
      currency: 'JPY',
      image_url: 'https://img.fril.jp/img/1/l/1.jpg',
      image_urls: ['https://img.fril.jp/img/1/l/1.jpg'],
    })
    expect(hit.source).toBe('index')
    expect(hit.productUrl).toBe('https://item.fril.jp/abc')
    expect(hit.price).toBe(1200)
  })
})

describe('prepareIndexSearchHits', () => {
  it('drops sold rows and tags the preview as batch 0', () => {
    const prepared = prepareIndexSearchHits(
      [
        { productUrl: 'https://item.fril.jp/a', title: 'ピカチュウ', price: 1000, storeId: 'rakuma' },
        { productUrl: 'https://item.fril.jp/b', title: 'ピカチュウ', price: 900, storeId: 'rakuma', tags: ['sold'] },
      ],
      { onSaleOnly: true, sort: 'price_asc' },
    )
    expect(prepared).toHaveLength(1)
    expect(prepared[0].loadedBatch).toBe(0)
    expect(prepared[0].productUrl).toBe('https://item.fril.jp/a')
  })
})

describe('evaluateIndexSufficiency', () => {
  it('treats a half-page of hits as enough to return without waiting', () => {
    const hits = Array.from({ length: 12 }, (_, i) => ({
      productUrl: `https://jp.mercari.com/item/m${i}`,
      fetchedAt: new Date().toISOString(),
    }))
    const verdict = evaluateIndexSufficiency(hits, 24)
    expect(verdict.sufficient).toBe(true)
    expect(verdict.indexFresh).toBe(true)
    expect(verdict.hasMore).toBe(true)
  })

  it('rejects a thin stale index', () => {
    const hits = Array.from({ length: 3 }, (_, i) => ({
      productUrl: `https://jp.mercari.com/item/m${i}`,
      fetchedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    }))
    expect(evaluateIndexSufficiency(hits, 24).sufficient).toBe(false)
  })
})

describe('mergeVisibleHitsWithLiveRefresh', () => {
  it('keeps the visible order and updates matching URLs in place', () => {
    const visible = [
      { productUrl: 'https://jp.mercari.com/item/m1', title: 'old', loadedBatch: 0 },
      { productUrl: 'https://jp.mercari.com/item/m2', title: 'keep', loadedBatch: 0 },
    ]
    const live = [
      { productUrl: 'https://jp.mercari.com/item/m3', title: 'new' },
      { productUrl: 'https://jp.mercari.com/item/m1', title: 'fresh' },
    ]
    expect(mergeVisibleHitsWithLiveRefresh(visible, live).map((hit) => hit.title)).toEqual(['fresh', 'keep', 'new'])
    expect(mergeVisibleHitsWithLiveRefresh(visible, live)[0].loadedBatch).toBe(0)
  })
})

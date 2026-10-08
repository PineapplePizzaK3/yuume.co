import { describe, expect, it } from 'vitest'
import {
  appendCatalogHits,
  applyCatalogFilters,
  catalogFiltersAreDefault,
  catalogFiltersNarrowHitCount,
  catalogSearchMayHaveMore,
  parseCatalogFiltersFromSearchParams,
  sanitizeCatalogFilters,
  sortCatalogHits,
  tagCatalogHitBatch,
  writeCatalogFiltersToSearchParams,
} from './catalogSearchFilters.js'

describe('sanitizeCatalogFilters', () => {
  it('uses on-sale and relevance as defaults', () => {
    const f = sanitizeCatalogFilters({})
    expect(f.onSaleOnly).toBe(true)
    expect(f.sort).toBe('relevance')
    expect(f.saleType).toBe('any')
    expect(catalogFiltersAreDefault(f)).toBe(true)
  })

  it('swaps inverted price bounds', () => {
    const f = sanitizeCatalogFilters({ priceMin: 8000, priceMax: 2000 })
    expect(f.priceMin).toBe(2000)
    expect(f.priceMax).toBe(8000)
  })
})

describe('applyCatalogFilters', () => {
  const hits = [
    { title: 'ピカチュウ 新品 送料込み', price: 2500, tags: [] },
    { title: 'ピカチュウ PSA10', price: 12000, tags: [] },
    { title: 'ピカチュウ 中古', price: 900, tags: ['sold'] },
    { title: 'ピカチュウ オークション', price: 3000, tags: ['auction'] },
  ]

  it('drops sold rows, excluded words, auctions and prices outside the range', () => {
    const kept = applyCatalogFilters(hits, {
      priceMin: 1000,
      priceMax: 5000,
      onSaleOnly: true,
      excludeKeywords: 'PSA',
      saleType: 'fixed',
    })
    expect(kept.map((h) => h.title)).toEqual(['ピカチュウ 新品 送料込み'])
  })

  it('keeps only auction rows when asked', () => {
    const kept = applyCatalogFilters(hits, { saleType: 'auction', onSaleOnly: false })
    expect(kept).toHaveLength(1)
    expect(kept[0].tags).toContain('auction')
  })

  it('drops a used title when only new is selected', () => {
    const kept = applyCatalogFilters(
      [{ title: 'ピカチュウ 中古', price: 2000 }],
      { conditions: ['new'] },
    )
    expect(kept).toHaveLength(0)
  })

  it('keeps TCG titles and drops unrelated ones when category is set', () => {
    const kept = applyCatalogFilters(
      [
        { title: 'ピカチュウ ポケモンカード', price: 2000 },
        { title: 'Nike Dunk Low', price: 18000 },
      ],
      { category: 'tcg', onSaleOnly: false },
    )
    expect(kept.map((h) => h.title)).toEqual(['ピカチュウ ポケモンカード'])
  })

  it('requires the brand token in the title', () => {
    const kept = applyCatalogFilters(
      [
        { title: 'Nike Dunk Low', price: 18000 },
        { title: 'Adidas Samba', price: 12000 },
      ],
      { brand: 'Nike', onSaleOnly: false },
    )
    expect(kept).toHaveLength(1)
    expect(kept[0].title).toContain('Nike')
  })
})

describe('sortCatalogHits', () => {
  it('orders by price and keeps unknown prices last', () => {
    const rows = [
      { title: 'b', price: 3000 },
      { title: 'a', price: 1000 },
      { title: 'z', price: null },
    ]
    expect(sortCatalogHits(rows, 'price_asc').map((r) => r.title)).toEqual(['a', 'b', 'z'])
    expect(sortCatalogHits(rows, 'price_desc').map((r) => r.title)).toEqual(['b', 'a', 'z'])
  })
})

describe('catalogSearchMayHaveMore', () => {
  it('treats a short filtered first page as not exhausted', () => {
    expect(catalogFiltersNarrowHitCount({ conditions: ['new'] })).toBe(true)
    expect(catalogFiltersNarrowHitCount({})).toBe(false)
    expect(
      catalogSearchMayHaveMore({
        serverHasMore: false,
        returnedCount: 5,
        append: false,
        filters: { conditions: ['new'] },
      }),
    ).toBe(true)
    expect(
      catalogSearchMayHaveMore({
        serverHasMore: false,
        returnedCount: 24,
        append: false,
        filters: {},
      }),
    ).toBe(false)
  })

  it('keeps paging after a filtered batch, and stops on an empty follow-up', () => {
    expect(
      catalogSearchMayHaveMore({
        serverHasMore: false,
        returnedCount: 4,
        newItemCount: 4,
        append: true,
        filters: { priceMax: 3000 },
      }),
    ).toBe(true)
    expect(
      catalogSearchMayHaveMore({
        serverHasMore: true,
        returnedCount: 8,
        matchedCount: 8,
        newItemCount: 0,
        append: true,
        filters: { conditions: ['new'] },
      }),
    ).toBe(false)
    expect(
      catalogSearchMayHaveMore({
        serverHasMore: false,
        returnedCount: 0,
        newItemCount: 0,
        append: true,
        filters: { priceMax: 3000 },
      }),
    ).toBe(false)
  })
})

describe('appendCatalogHits', () => {
  it('keeps the first page order and only sorts the new batch', () => {
    const first = tagCatalogHitBatch(
      [
        { productUrl: '/a', title: 'a', price: 1000 },
        { productUrl: '/c', title: 'c', price: 9000 },
      ],
      0,
    )
    const incoming = [
      { productUrl: '/b', title: 'b', price: 500 },
      { productUrl: '/a', title: 'a-dup', price: 1000 },
      { productUrl: '/d', title: 'd', price: 800 },
    ]
    const { results, addedCount } = appendCatalogHits(first, incoming, {
      sort: 'price_asc',
      loadedBatch: 1,
    })
    expect(addedCount).toBe(2)
    expect(results.map((row) => row.productUrl)).toEqual(['/a', '/c', '/b', '/d'])
    expect(results.map((row) => row.loadedBatch)).toEqual([0, 0, 1, 1])
  })
})

describe('filter URL params', () => {
  it('round-trips non-default filters and omits defaults', () => {
    const written = writeCatalogFiltersToSearchParams(new URLSearchParams('catalogQuery=pikachu'), {
      priceMin: 1000,
      sort: 'price_asc',
      onSaleOnly: false,
      conditions: ['new', 'good'],
      excludeKeywords: 'PSA オリパ',
      sellerPaysShipping: true,
      saleType: 'auction',
    })
    expect(written.get('catalogQuery')).toBe('pikachu')
    expect(written.get('min')).toBe('1000')
    expect(written.get('sort')).toBe('price_asc')
    expect(written.get('onsale')).toBe('0')
    expect(written.get('cond')).toBe('new,good')
    expect(written.get('ex')).toBe('PSA オリパ')
    expect(written.get('ship')).toBe('1')
    expect(written.get('sale')).toBe('auction')
    expect(parseCatalogFiltersFromSearchParams(written)).toMatchObject({
      priceMin: 1000,
      sort: 'price_asc',
      onSaleOnly: false,
      conditions: ['new', 'good'],
      sellerPaysShipping: true,
      saleType: 'auction',
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  EPHEMERAL_LISTING_SOURCE,
  listingFromCatalogHit,
  listingFromEphemeralRow,
  listingFromIndexRow,
  snapshotPayloadFromListing,
} from './ephemeralListing.js'

describe('ephemeral listing view model', () => {
  it('maps a catalog hit into the detail shape', () => {
    const listing = listingFromCatalogHit({
      storeId: 'mercari',
      productUrl: 'https://jp.mercari.com/item/m1',
      title: 'ピカチュウ',
      price: 2500,
      imageUrl: 'https://example.com/a.jpg',
      imageUrls: ['https://example.com/b.jpg'],
    })
    expect(listing.source).toBe(EPHEMERAL_LISTING_SOURCE.CATALOG_HIT)
    expect(listing.token).toBeNull()
    expect(listing.price_jpy).toBe(2500)
    expect(listing.image_urls[0]).toBe('https://example.com/a.jpg')
  })

  it('drops Rakuma recommended-tile photos that use another item id', () => {
    const listing = listingFromCatalogHit({
      storeId: 'rakuma',
      productUrl: 'https://item.fril.jp/abcdef123',
      title: 'ピカチュウ',
      price: 2500,
      imageUrl: 'https://img.fril.jp/img/111/l/1.jpg',
      imageUrls: [
        'https://img.fril.jp/img/111/l/1.jpg',
        'https://img.fril.jp/img/999/l/related.jpg',
      ],
    })
    expect(listing.image_urls).toEqual(['https://img.fril.jp/img/111/l/1.jpg'])
  })

  it('maps an index row with the reserved source', () => {
    const listing = listingFromIndexRow({
      store_id: 'rakuma',
      external_url: 'https://item.fril.jp/abcdef123',
      title: 'ピカチュウ',
      price_jpy: 1800,
      image_url: 'https://img.fril.jp/img/111/l/1.jpg',
    })
    expect(listing.source).toBe(EPHEMERAL_LISTING_SOURCE.INDEX)
    expect(listing.store_id).toBe('rakuma')
    expect(listing.price_jpy).toBe(1800)
  })

  it('maps a stored snapshot without changing the public fields', () => {
    const listing = listingFromEphemeralRow({
      token: 'abc',
      store_id: 'mercari',
      external_url: 'https://jp.mercari.com/item/m1',
      title: 'ピカチュウ',
      price_jpy: 2500,
      image_url: 'https://example.com/a.jpg',
      image_urls: ['https://example.com/a.jpg'],
      expires_at: '2026-10-01T00:00:00.000Z',
    })
    expect(listing.source).toBe(EPHEMERAL_LISTING_SOURCE.EPHEMERAL_ROW)
    expect(listing.token).toBe('abc')
    expect(listing.external_url).toBe('https://jp.mercari.com/item/m1')
  })

  it('builds a create payload ready for find-or-create', () => {
    const payload = snapshotPayloadFromListing({
      store_id: 'mercari',
      external_url: 'https://jp.mercari.com/item/m1?ref=1#x',
      title: 'ピカチュウ',
      price_jpy: 2500,
      image_url: 'https://example.com/a.jpg',
      image_urls: ['https://example.com/a.jpg'],
    })
    expect(payload.storeId).toBe('mercari')
    expect(payload.productUrl).toBe('https://jp.mercari.com/item/m1')
    expect(payload.price).toBe(2500)
  })
})

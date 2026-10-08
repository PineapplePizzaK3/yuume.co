import { describe, expect, it } from 'vitest'
import { filterOwnedListingImages, filterTrustedGalleryImages, hasEnoughOwnedListingPhotos, listingPhotoOwner } from './listingImages.js'

describe('filterOwnedListingImages', () => {
  it('drops Rakuma photos that belong to another item id (recommended tiles)', () => {
    const productUrl = 'https://item.fril.jp/abcdef123'
    const cover = 'https://img.fril.jp/img/111/l/1.jpg'
    const kept = filterOwnedListingImages(
      productUrl,
      [
        cover,
        'https://img.fril.jp/img/111/l/2.jpg',
        'https://img.fril.jp/img/999/l/related.jpg',
        'https://img.fril.jp/img/888/m/also.jpg',
      ],
      cover,
    )
    expect(kept).toEqual([
      'https://img.fril.jp/img/111/l/1.jpg',
      'https://img.fril.jp/img/111/l/2.jpg',
    ])
  })

  it('keeps only the largest size of the same Rakuma shot', () => {
    const productUrl = 'https://item.fril.jp/abcdef123'
    const cover = 'https://img.fril.jp/img/111/m/1.jpg'
    expect(
      filterOwnedListingImages(
        productUrl,
        [cover, 'https://img.fril.jp/img/111/l/1.jpg', 'https://img.fril.jp/img/111/l/2.jpg'],
        cover,
      ),
    ).toEqual([
      'https://img.fril.jp/img/111/l/1.jpg',
      'https://img.fril.jp/img/111/l/2.jpg',
    ])
    expect(listingPhotoOwner(productUrl, cover)).toEqual({ kind: 'rakuma', id: '111' })
  })

  it('keeps only Mercari photos that include the item id', () => {
    const productUrl = 'https://jp.mercari.com/item/m62663091028'
    const cover = 'https://static.mercdn.net/item/detail/orig/photos/m62663091028_1.jpg'
    const kept = filterOwnedListingImages(
      productUrl,
      [
        cover,
        'https://static.mercdn.net/item/detail/orig/photos/m62663091028_2.jpg',
        'https://static.mercdn.net/item/detail/orig/photos/m11111111111_1.jpg',
      ],
      cover,
    )
    expect(kept).toHaveLength(2)
    expect(kept.every((url) => url.includes('m62663091028'))).toBe(true)
  })

  it('falls back to the cover when extras cannot be proven', () => {
    const productUrl = 'https://auctions.yahoo.co.jp/jp/auction/abc123'
    const cover = 'https://auc-pctr.c.yimg.jp/i/images.auctions.yahoo.co.jp/image/foo.jpg'
    expect(
      filterOwnedListingImages(productUrl, [cover, 'https://auc-pctr.c.yimg.jp/i/other.jpg'], cover),
    ).toEqual([cover])
  })

  it('keeps Amazon extras only from a trusted gallery scrape', () => {
    const productUrl = 'https://www.amazon.co.jp/dp/B0TESTASIN'
    const cover = 'https://m.media-amazon.com/images/I/cover.jpg'
    const extra = 'https://m.media-amazon.com/images/I/extra.jpg'
    expect(filterOwnedListingImages(productUrl, [cover, extra], cover)).toEqual([cover])
    expect(filterTrustedGalleryImages(productUrl, [cover, extra], cover)).toEqual([cover, extra])
  })

  it('treats two owned Mercari photos as enough to skip a gallery scrape', () => {
    const productUrl = 'https://jp.mercari.com/item/m12345'
    const cover = 'https://static.mercdn.net/item/detail/orig/photos/m12345_1.jpg'
    const extra = 'https://static.mercdn.net/item/detail/orig/photos/m12345_2.jpg'
    expect(hasEnoughOwnedListingPhotos(productUrl, [cover, extra], cover)).toBe(true)
    expect(hasEnoughOwnedListingPhotos(productUrl, [cover], cover)).toBe(false)
  })
})

import { canonicalListingUrl } from './ephemeralRecommendations.js'
import { filterOwnedListingImages } from './listingImages.js'

/** How the detail page was filled. `index` is reserved for a future local catalog. */
export const EPHEMERAL_LISTING_SOURCE = {
  CATALOG_HIT: 'catalog_hit',
  EPHEMERAL_ROW: 'ephemeral_row',
  INDEX: 'index',
}

function uniqueImageUrls(values) {
  const out = []
  const seen = new Set()
  for (const value of Array.isArray(values) ? values : []) {
    const url = String(value || '').trim()
    if (!url || !/^https?:\/\//i.test(url)) continue
    if (/(null|undefined|about:blank)$/i.test(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

function asPrice(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Stable listing the detail page renders.
 * Today: search hit or DB snapshot. Later: hydrate from our index with the same fields.
 */
export function listingFromCatalogHit(hit, { source = EPHEMERAL_LISTING_SOURCE.CATALOG_HIT } = {}) {
  if (!hit || typeof hit !== 'object') return null
  const externalUrl = String(hit.productUrl || hit.external_url || '').trim()
  const title = String(hit.title || '').trim()
  if (!externalUrl || !title) return null
  const rawImages = uniqueImageUrls([
    hit.imageUrl,
    hit.image_url,
    ...(Array.isArray(hit.imageUrls) ? hit.imageUrls : []),
    ...(Array.isArray(hit.image_urls) ? hit.image_urls : []),
  ])
  const cover = String(hit.imageUrl || hit.image_url || rawImages[0] || '')
  const images = filterOwnedListingImages(externalUrl, rawImages, cover)
  return {
    source,
    token: String(hit.token || '').trim() || null,
    store_id: hit.storeId || hit.store_id || null,
    external_url: externalUrl,
    title,
    price_jpy: asPrice(hit.price ?? hit.price_jpy),
    price_usd: hit.price_usd ?? null,
    unit_sale_brl: hit.unit_sale_brl ?? null,
    currency: hit.currency || 'JPY',
    image_url: images[0] || '',
    image_urls: images,
    expires_at: hit.expires_at || null,
    is_available: hit.is_available !== false,
  }
}

export function listingFromIndexRow(row) {
  return listingFromCatalogHit(
    {
      ...row,
      productUrl: row?.external_url || row?.productUrl,
      imageUrl: row?.image_url || row?.imageUrl,
      imageUrls: row?.image_urls || row?.imageUrls,
      price: row?.price_jpy ?? row?.price,
      storeId: row?.store_id || row?.storeId,
    },
    { source: EPHEMERAL_LISTING_SOURCE.INDEX },
  )
}

export function listingFromEphemeralRow(row) {
  return listingFromCatalogHit(
    {
      ...row,
      productUrl: row?.external_url,
      imageUrl: row?.image_url,
      imageUrls: row?.image_urls,
      price: row?.price_jpy,
    },
    { source: EPHEMERAL_LISTING_SOURCE.EPHEMERAL_ROW },
  )
}

export function snapshotPayloadFromListing(listing) {
  const view = listingFromCatalogHit(listing) || listingFromCatalogHit({
    productUrl: listing?.external_url,
    title: listing?.title,
    price: listing?.price_jpy,
    currency: listing?.currency,
    imageUrl: listing?.image_url,
    imageUrls: listing?.image_urls,
    storeId: listing?.store_id,
  })
  if (!view) return null
  return {
    storeId: view.store_id,
    productUrl: canonicalListingUrl(view.external_url) || view.external_url,
    title: view.title,
    price: view.price_jpy,
    currency: view.currency,
    imageUrl: view.image_url || null,
    imageUrls: view.image_urls,
    source: listing?.source || view.source || 'catalog_hit',
  }
}

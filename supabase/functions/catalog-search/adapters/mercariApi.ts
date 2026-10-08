/**
 * Busca via API pública do app web Mercari JP (DPoP).
 * Referência: https://github.com/honofung1/mercapi-gem
 */
import { generateKeyPair, exportJWK, SignJWT } from 'npm:jose@5'
import type { UnifiedSearchHit } from '../types.ts'
import { mercariConditionIds, mercariSortFields, type CatalogSearchFilters } from '../filters.ts'
import { buildHit, mercariTagsFromRow, pickProductImages } from '../normalize.ts'

const MERCARI_API_BASE = 'https://api.mercari.jp'
const MERCARI_SEARCH_PATH = '/v2/entities:search'
const MERCARI_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

type MercariSearchItem = {
  id?: string
  name?: string
  price?: number | string
  thumbnails?: unknown[]
  photo_paths?: unknown[]
  photos?: Array<string | { imageUrl?: string; uri?: string; url?: string }>
  status?: string
  itemType?: string
  auction?: unknown
}

type MercariSearchResponse = {
  items?: MercariSearchItem[]
  meta?: { numFound?: number; nextPageToken?: string }
}

async function createDpopSigner() {
  const { privateKey, publicKey } = await generateKeyPair('ES256')
  const jwk = await exportJWK(publicKey)
  const publicJwk = { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }
  const sessionUuid = crypto.randomUUID()

  return async (url: string, method: string) =>
    await new SignJWT({
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(),
      htu: url,
      htm: method.toUpperCase(),
      uuid: sessionUuid,
    })
      .setProtectedHeader({ typ: 'dpop+jwt', alg: 'ES256', jwk: publicJwk })
      .sign(privateKey)
}

function buildSearchBody(
  keyword: string,
  pageSize: number,
  pageToken = '',
  filters?: CatalogSearchFilters,
) {
  const sort = filters ? mercariSortFields(filters) : { sort: 'SORT_SCORE', order: 'ORDER_DESC' }
  const conditionIds = filters ? mercariConditionIds(filters) : []
  const itemTypes: string[] = []
  if (filters?.saleType === 'auction') itemTypes.push('ITEM_TYPE_MERCARI_AUCTION')
  else if (filters?.saleType === 'fixed') itemTypes.push('ITEM_TYPE_MERCARI')
  return {
    userId: '',
    pageSize: Math.min(120, Math.max(6, pageSize)),
    pageToken: pageToken || '',
    searchSessionId: crypto.randomUUID().replace(/-/g, '').slice(0, 32),
    indexRouting: 'INDEX_ROUTING_UNSPECIFIED',
    thumbnailTypes: [],
    searchCondition: {
      keyword,
      sort: sort.sort,
      order: sort.order,
      status: filters && filters.onSaleOnly === false ? [] : ['STATUS_ON_SALE'],
      sizeId: [],
      categoryId: [],
      brandId: [],
      sellerId: [],
      priceMin: filters?.priceMin || 0,
      priceMax: filters?.priceMax || 0,
      itemConditionId: conditionIds,
      shippingPayerId: filters?.sellerPaysShipping ? [2] : [],
      shippingFromArea: [],
      shippingMethod: [],
      colorId: [],
      hasCoupon: false,
      attributes: [],
      itemTypes,
      skuIds: [],
      excludeKeyword: filters?.excludeKeywords || '',
    },
    defaultDatasets: ['DATASET_TYPE_MERCARI', 'DATASET_TYPE_BEYOND'],
    withAuction: filters?.saleType !== 'fixed',
    serviceFrom: 'suruga',
  }
}

function parseMercariPrice(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function extractMercariAuctionPrices(row: MercariSearchItem): {
  currentBidPrice: number | null
  buyoutPrice: number | null
} {
  const auc = row?.auction
  if (!auc || typeof auc !== 'object') {
    return { currentBidPrice: null, buyoutPrice: null }
  }
  const a = auc as Record<string, unknown>
  const currentBidPrice =
    parseMercariPrice(a.highestBid) ??
    parseMercariPrice(a.currentBid) ??
    parseMercariPrice(a.bidPrice) ??
    parseMercariPrice(a.price) ??
    null
  const buyoutPrice =
    parseMercariPrice(a.buyoutPrice) ??
    parseMercariPrice(a.instantPrice) ??
    parseMercariPrice(a.fixedPrice) ??
    null
  return { currentBidPrice, buyoutPrice }
}

function mercariItemUrl(id: string): string {
  const clean = String(id || '').trim()
  if (!clean) return ''
  const path = clean.startsWith('m') ? clean : `m${clean}`
  return `https://jp.mercari.com/item/${path}`
}

function extractMercariImages(row: MercariSearchItem): string[] {
  const candidateList: Array<string | null | undefined> = []
  const thumbs = Array.isArray(row.thumbnails) ? row.thumbnails : []
  for (const t of thumbs) {
    if (typeof t === 'string') {
      candidateList.push(t)
      continue
    }
    if (t && typeof t === 'object') {
      const o = t as Record<string, unknown>
      candidateList.push(
        typeof o.url === 'string' ? o.url : null,
        typeof o.imageUrl === 'string' ? o.imageUrl : null,
        typeof o.uri === 'string' ? o.uri : null,
      )
    }
  }

  const photoPaths = Array.isArray(row.photo_paths) ? row.photo_paths : []
  for (const p of photoPaths) {
    if (typeof p !== 'string') continue
    const clean = p.trim()
    if (!clean) continue
    if (/^https?:\/\//i.test(clean)) {
      candidateList.push(clean)
      continue
    }
    const normalized = clean.replace(/^\//, '')
    if (/^photos\/m\d+_\d+\./i.test(normalized)) {
      candidateList.push(`https://static.mercdn.net/item/detail/orig/${normalized}`)
    } else {
      candidateList.push(clean)
    }
  }
  const photos = Array.isArray(row.photos) ? row.photos : []
  for (const p of photos) {
    if (typeof p === 'string') {
      candidateList.push(p)
      continue
    }
    if (!p || typeof p !== 'object') continue
    candidateList.push(p.imageUrl, p.uri, p.url)
  }

  return pickProductImages(candidateList, 'https://jp.mercari.com')
}

export async function fetchMercariItemPhotos(itemId: string): Promise<string[]> {
  const id = String(itemId || '').match(/m\d+/i)?.[0]
  if (!id) return []
  const sign = await createDpopSigner()
  const url = `${MERCARI_API_BASE}/items/get?id=${encodeURIComponent(id)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': MERCARI_USER_AGENT,
      'X-Platform': 'web',
      Accept: 'application/json',
      DPoP: await sign(url, 'GET'),
    },
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) return []
  const json = await res.json().catch(() => null)
  if (!json || typeof json !== 'object') return []

  // Response shapes vary: {photos}, {data:{photos}}, {data:{item:{photos}}}
  const root = json as Record<string, unknown>
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>
  const item = (data.item && typeof data.item === 'object' ? data.item : data) as MercariSearchItem

  const candidateList: Array<string | null | undefined> = []
  const pushPhotos = (row: MercariSearchItem | null | undefined) => {
    if (!row) return
    const photos = Array.isArray(row.photos) ? row.photos : []
    for (const p of photos) {
      if (typeof p === 'string') candidateList.push(p)
      else if (p && typeof p === 'object') candidateList.push(p.imageUrl, p.uri, p.url)
    }
    const photoPaths = Array.isArray(row.photo_paths) ? row.photo_paths : []
    for (const p of photoPaths) {
      if (typeof p !== 'string') continue
      const clean = p.trim()
      if (!clean) continue
      if (/^https?:\/\//i.test(clean)) candidateList.push(clean)
      else {
        const normalized = clean.replace(/^\//, '')
        if (/^photos\/m\d+_\d+\./i.test(normalized)) {
          candidateList.push(`https://static.mercdn.net/item/detail/orig/${normalized}`)
        } else if (new RegExp(`^${id}_\\d+\\.`, 'i').test(normalized)) {
          candidateList.push(`https://static.mercdn.net/item/detail/orig/photos/${normalized}`)
        }
      }
    }
    const thumbs = Array.isArray(row.thumbnails) ? row.thumbnails : []
    for (const t of thumbs) {
      if (typeof t === 'string') candidateList.push(t)
      else if (t && typeof t === 'object') {
        const o = t as Record<string, unknown>
        candidateList.push(
          typeof o.url === 'string' ? o.url : null,
          typeof o.imageUrl === 'string' ? o.imageUrl : null,
          typeof o.uri === 'string' ? o.uri : null,
        )
      }
    }
  }

  pushPhotos(item)
  if (item !== data) pushPhotos(data as MercariSearchItem)

  const rewritten = candidateList.map((url) => {
    if (typeof url !== 'string') return url
    const photo =
      url.match(new RegExp(`(photos\\/${id}_\\d+\\.(?:jpg|jpeg|png|webp))`, 'i'))?.[1] ||
      url.match(/(photos\/m\d+_\d+\.(?:jpg|jpeg|png|webp))/i)?.[1]
    if (photo && photo.toLowerCase().includes(id.toLowerCase())) {
      return `https://static.mercdn.net/item/detail/orig/${photo}`
    }
    return url
  })
  const owned = rewritten.filter((url) => typeof url === 'string' && url.includes(id))
  const picked = pickProductImages(owned.length ? owned : rewritten, 'https://jp.mercari.com')
  return picked.filter((url) => url.includes(id) && !/\/c!\//i.test(url) && !/\/thumb\//i.test(url))
}

export type MercariPageResult = {
  hits: UnifiedSearchHit[]
  nextPageToken?: string
}

export async function searchMercariApi(
  query: string,
  pageSize: number,
  options: { pageToken?: string; filters?: CatalogSearchFilters } = {},
): Promise<MercariPageResult> {
  const keyword = String(query || '').trim()
  if (!keyword) return { hits: [] }

  const sign = await createDpopSigner()
  const url = `${MERCARI_API_BASE}${MERCARI_SEARCH_PATH}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': MERCARI_USER_AGENT,
      'X-Platform': 'web',
      DPoP: await sign(url, 'POST'),
    },
    body: JSON.stringify(buildSearchBody(keyword, pageSize, options.pageToken, options.filters)),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Mercari API HTTP ${res.status}${errText ? `: ${errText.slice(0, 120)}` : ''}`)
  }

  const json = (await res.json()) as MercariSearchResponse
  const items = Array.isArray(json?.items) ? json.items : []
  const nextPageToken = String(json?.meta?.nextPageToken || '').trim() || undefined

  const hits: UnifiedSearchHit[] = []
  for (let i = 0; i < items.length && hits.length < pageSize; i += 1) {
    const row = items[i]
    const id = String(row?.id || '').trim()
    const name = String(row?.name || '').trim()
    const productUrl = mercariItemUrl(id)
    if (!id || !name || !productUrl) continue

    const imageUrls = extractMercariImages(row)
    const tags = mercariTagsFromRow(row)
    const auctionPrices = extractMercariAuctionPrices(row)
    if (tags.includes('auction') && auctionPrices.currentBidPrice == null) {
      auctionPrices.currentBidPrice = parseMercariPrice(row.price)
    }
    hits.push(
      buildHit({
        id: `mercari-api-${i}-${id}`,
        title: name,
        price: parseMercariPrice(row.price),
        currency: 'JPY',
        imageUrl: imageUrls[0] || null,
        imageUrls,
        productUrl,
        storeId: 'mercari',
        storeName: 'Mercari',
        source: 'mixed',
        tags: tags.length ? tags : undefined,
        auctionCurrentBidPrice: auctionPrices.currentBidPrice,
        auctionBuyoutPrice: auctionPrices.buyoutPrice,
      }),
    )
  }

  return { hits, nextPageToken }
}

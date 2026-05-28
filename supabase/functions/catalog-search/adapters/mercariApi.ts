/**
 * Busca via API pública do app web Mercari JP (DPoP).
 * Referência: https://github.com/honofung1/mercapi-gem
 */
import { generateKeyPair, exportJWK, SignJWT } from 'npm:jose@5'
import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, pickBestImage } from '../normalize.ts'

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
  photos?: Array<{ imageUrl?: string; uri?: string; url?: string }>
  status?: string
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

function buildSearchBody(keyword: string, pageSize: number) {
  return {
    userId: '',
    pageSize: Math.min(120, Math.max(6, pageSize)),
    pageToken: '',
    searchSessionId: crypto.randomUUID().replace(/-/g, '').slice(0, 32),
    indexRouting: 'INDEX_ROUTING_UNSPECIFIED',
    thumbnailTypes: [],
    searchCondition: {
      keyword,
      sort: 'SORT_SCORE',
      order: 'ORDER_DESC',
      status: ['STATUS_ON_SALE'],
      sizeId: [],
      categoryId: [],
      brandId: [],
      sellerId: [],
      priceMin: 0,
      priceMax: 0,
      itemConditionId: [],
      shippingPayerId: [],
      shippingFromArea: [],
      shippingMethod: [],
      colorId: [],
      hasCoupon: false,
      attributes: [],
      itemTypes: [],
      skuIds: [],
      excludeKeyword: '',
    },
    defaultDatasets: [],
    serviceFrom: 'suruga',
  }
}

function parseMercariPrice(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function mercariItemUrl(id: string): string {
  const clean = String(id || '').trim()
  if (!clean) return ''
  const path = clean.startsWith('m') ? clean : `m${clean}`
  return `https://jp.mercari.com/item/${path}`
}

function extractMercariThumbnail(row: MercariSearchItem): string | null {
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
    if (typeof p === 'string') candidateList.push(p)
  }
  const photos = Array.isArray(row.photos) ? row.photos : []
  for (const p of photos) {
    if (!p || typeof p !== 'object') continue
    candidateList.push(p.imageUrl, p.uri, p.url)
  }

  return pickBestImage(candidateList, 'https://jp.mercari.com')
}

export async function searchMercariApi(query: string, pageSize: number): Promise<UnifiedSearchHit[]> {
  const keyword = String(query || '').trim()
  if (!keyword) return []

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
    body: JSON.stringify(buildSearchBody(keyword, pageSize)),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Mercari API HTTP ${res.status}${errText ? `: ${errText.slice(0, 120)}` : ''}`)
  }

  const json = (await res.json()) as MercariSearchResponse
  const items = Array.isArray(json?.items) ? json.items : []

  const hits: UnifiedSearchHit[] = []
  for (let i = 0; i < items.length && hits.length < pageSize; i += 1) {
    const row = items[i]
    const id = String(row?.id || '').trim()
    const name = String(row?.name || '').trim()
    const productUrl = mercariItemUrl(id)
    if (!id || !name || !productUrl) continue

    const thumb = extractMercariThumbnail(row)
    hits.push(
      buildHit({
        id: `mercari-api-${i}-${id}`,
        title: name,
        price: parseMercariPrice(row.price),
        currency: 'JPY',
        imageUrl: thumb,
        productUrl,
        storeId: 'mercari',
        storeName: 'Mercari',
        source: 'mixed',
      }),
    )
  }

  return hits
}

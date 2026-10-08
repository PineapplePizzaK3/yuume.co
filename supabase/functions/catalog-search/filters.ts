import type { StoreId, UnifiedSearchHit } from './types.ts'

export type CatalogSort = 'relevance' | 'newest' | 'price_asc' | 'price_desc'
export type CatalogCondition = 'new' | 'good' | 'used'
export type CatalogSaleType = 'any' | 'fixed' | 'auction'
export type CatalogCategory = 'any' | 'tcg' | 'sneakers' | 'figures' | 'apparel'

export interface CatalogSearchFilters {
  priceMin: number | null
  priceMax: number | null
  sort: CatalogSort
  onSaleOnly: boolean
  conditions: CatalogCondition[]
  excludeKeywords: string
  sellerPaysShipping: boolean
  saleType: CatalogSaleType
  category: CatalogCategory
  brand: string
}

const SORTS: CatalogSort[] = ['relevance', 'newest', 'price_asc', 'price_desc']
const CONDITIONS: CatalogCondition[] = ['new', 'good', 'used']
const SALE_TYPES: CatalogSaleType[] = ['any', 'fixed', 'auction']
const CATEGORIES: CatalogCategory[] = ['any', 'tcg', 'sneakers', 'figures', 'apparel']

export const DEFAULT_FILTERS: CatalogSearchFilters = {
  priceMin: null,
  priceMax: null,
  sort: 'relevance',
  onSaleOnly: true,
  conditions: [],
  excludeKeywords: '',
  sellerPaysShipping: false,
  saleType: 'any',
  category: 'any',
  brand: '',
}

function asPositiveInt(value: unknown): number | null {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, 99_999_999)
}

export function sanitizeFilters(raw: unknown): CatalogSearchFilters {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  let priceMin = asPositiveInt(source.priceMin)
  let priceMax = asPositiveInt(source.priceMax)
  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    const swap = priceMin
    priceMin = priceMax
    priceMax = swap
  }
  const conditions = (Array.isArray(source.conditions) ? source.conditions : [])
    .map((item) => String(item || '').trim())
    .filter((item): item is CatalogCondition => CONDITIONS.includes(item as CatalogCondition))
  const unique = [...new Set(conditions)]
  return {
    priceMin,
    priceMax,
    sort: SORTS.includes(source.sort as CatalogSort) ? (source.sort as CatalogSort) : DEFAULT_FILTERS.sort,
    onSaleOnly: source.onSaleOnly !== false && source.onSaleOnly !== '0' && source.onSaleOnly !== 0,
    conditions: unique,
    excludeKeywords: String(source.excludeKeywords || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    sellerPaysShipping: Boolean(source.sellerPaysShipping && source.sellerPaysShipping !== '0'),
    saleType: SALE_TYPES.includes(source.saleType as CatalogSaleType)
      ? (source.saleType as CatalogSaleType)
      : DEFAULT_FILTERS.saleType,
    category: CATEGORIES.includes(source.category as CatalogCategory)
      ? (source.category as CatalogCategory)
      : DEFAULT_FILTERS.category,
    brand: String(source.brand || '').replace(/\s+/g, ' ').trim().slice(0, 40),
  }
}

export function splitExcludeKeywords(text: string): string[] {
  return String(text || '')
    .split(/[\s,，、]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 2)
}

const NEW_HINT = /新品|未使用|未開封|\bnew\b|bnib/i
const USED_HINT = /中古|ジャンク|傷|汚れ|used|worn/i
const GOOD_HINT = /美品|未使用に近い|目立った傷や汚れなし/i
const BUYER_SHIP_HINT = /着払い|送料別/i

const CATEGORY_HINTS: Record<Exclude<CatalogCategory, 'any'>, RegExp> = {
  tcg: /ポケモン|pokemon|ポケカ|ピカチュウ|遊戯王|yugioh|ワンピースカード|one\s*piece|オリパ|psa\s*\d|カード|\bcards?\b/i,
  sneakers: /nike|adidas|jordan|dunk|sneaker|スニーカー|靴|yeezy/i,
  figures: /フィギュア|figure|nendoroid|ねんどろいど|figma|scale|statue|プラモデル/i,
  apparel: /パーカー|tシャツ|hoodie|apparel|jacket|シャツ|服/i,
}

export function liveSearchQuery(query: string, filters: CatalogSearchFilters): string {
  const brand = String(filters?.brand || '').trim()
  return brand ? `${query} ${brand}`.trim() : query
}

function inferConditionBand(title: string): CatalogCondition | null {
  if (NEW_HINT.test(title) && !USED_HINT.test(title)) return 'new'
  if (GOOD_HINT.test(title)) return 'good'
  if (USED_HINT.test(title) && !NEW_HINT.test(title)) return 'used'
  return null
}

export function hitMatchesFilters(item: UnifiedSearchHit, filters: CatalogSearchFilters): boolean {
  const title = String(item?.title || '')
  const price = Number(item?.price)
  const hasPrice = Number.isFinite(price) && price > 0
  const tags = Array.isArray(item?.tags) ? item.tags : []
  const isAuction = tags.includes('auction')
  const isGone = tags.includes('sold') || tags.includes('unavailable')

  if (filters.priceMin != null && hasPrice && price < filters.priceMin) return false
  if (filters.priceMax != null && hasPrice && price > filters.priceMax) return false
  if (filters.onSaleOnly && isGone) return false

  for (const word of splitExcludeKeywords(filters.excludeKeywords)) {
    if (title.toLowerCase().includes(word)) return false
  }

  if (filters.saleType === 'auction' && !isAuction) return false
  if (filters.saleType === 'fixed' && isAuction) return false
  if (filters.sellerPaysShipping && BUYER_SHIP_HINT.test(title)) return false

  if (filters.conditions.length > 0) {
    const band = inferConditionBand(title)
    if (band && !filters.conditions.includes(band)) return false
  }

  if (filters.category && filters.category !== 'any') {
    const hint = CATEGORY_HINTS[filters.category]
    if (hint && !hint.test(title)) return false
  }

  const brand = String(filters.brand || '').trim().toLowerCase()
  if (brand && !title.toLowerCase().includes(brand)) return false

  return true
}

export function applyHitFilters(hits: UnifiedSearchHit[], filters: CatalogSearchFilters): UnifiedSearchHit[] {
  return hits.filter((hit) => hitMatchesFilters(hit, filters))
}

export function filtersNarrowHitCount(filters: CatalogSearchFilters): boolean {
  return (
    filters.priceMin != null ||
    filters.priceMax != null ||
    filters.conditions.length > 0 ||
    Boolean(filters.excludeKeywords) ||
    filters.sellerPaysShipping ||
    filters.saleType !== 'any' ||
    (filters.category && filters.category !== 'any') ||
    Boolean(filters.brand)
  )
}

export function batchMayHaveMorePages(
  result: { error?: string; hits: unknown[]; nextCursor?: string },
  perStoreBatch: number,
  filters: CatalogSearchFilters,
): boolean {
  if (result.error) return false
  if (result.nextCursor) return true
  if (result.hits.length >= perStoreBatch) return true
  if (filtersNarrowHitCount(filters) && result.hits.length > 0) return true
  return false
}

export function sortHitsByPrice(hits: UnifiedSearchHit[], sort: CatalogSort): UnifiedSearchHit[] {
  if (sort !== 'price_asc' && sort !== 'price_desc') return hits
  const dir = sort === 'price_asc' ? 1 : -1
  return [...hits].sort((a, b) => {
    const pa = Number(a?.price)
    const pb = Number(b?.price)
    const ha = Number.isFinite(pa) && pa > 0
    const hb = Number.isFinite(pb) && pb > 0
    if (ha && hb) return (pa - pb) * dir
    if (ha) return -1
    if (hb) return 1
    return 0
  })
}

export function compactFiltersForCache(filters: CatalogSearchFilters): Record<string, unknown> {
  return {
    min: filters.priceMin,
    max: filters.priceMax,
    sort: filters.sort,
    on: filters.onSaleOnly,
    cond: filters.conditions,
    ex: filters.excludeKeywords,
    ship: filters.sellerPaysShipping,
    sale: filters.saleType,
    cat: filters.category,
    brand: filters.brand,
  }
}

function withParams(url: string, params: Record<string, string | number | null | undefined>): string {
  const parsed = new URL(url)
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue
    parsed.searchParams.set(key, String(value))
  }
  return parsed.toString()
}

function excludeQuerySuffix(filters: CatalogSearchFilters): string {
  const words = splitExcludeKeywords(filters.excludeKeywords)
  if (!words.length) return ''
  return ` ${words.map((word) => `-${word}`).join(' ')}`
}

export function amazonSearchUrl(query: string, storePage: number, filters: CatalogSearchFilters): string {
  const k = `${query}${excludeQuerySuffix(filters)}`.trim()
  const sortMap: Record<CatalogSort, string> = {
    relevance: 'relevancerank',
    newest: 'date-desc-rank',
    price_asc: 'price-asc-rank',
    price_desc: 'price-desc-rank',
  }
  const params: Record<string, string | number | null | undefined> = {
    k,
    s: sortMap[filters.sort],
    'low-price': filters.priceMin,
    'high-price': filters.priceMax,
  }
  if (storePage > 1) params.page = storePage
  if (filters.conditions.length === 1 && filters.conditions[0] === 'new') {
    params.rh = 'p_n_condition-type:new'
  }
  return withParams('https://www.amazon.co.jp/s', params)
}

export function rakumaSearchUrl(query: string, storePage: number, filters: CatalogSearchFilters): string {
  const params: Record<string, string | number | null | undefined> = {
    query,
    min: filters.priceMin,
    max: filters.priceMax,
  }
  if (storePage > 1) params.page = storePage
  if (filters.sort === 'newest') {
    params.sort = 'created_at'
    params.order = 'desc'
  } else if (filters.sort === 'price_asc') {
    params.sort = 'selling_price'
    params.order = 'asc'
  } else if (filters.sort === 'price_desc') {
    params.sort = 'selling_price'
    params.order = 'desc'
  }
  if (filters.onSaleOnly) params.transaction = 'selling'
  if (filters.sellerPaysShipping) params.carriage = 0
  return withParams('https://fril.jp/s', params)
}

export function mercariHtmlSearchUrl(query: string, storePage: number, filters: CatalogSearchFilters): string {
  const sortMap: Record<CatalogSort, string> = {
    relevance: 'score',
    newest: 'created_time',
    price_asc: 'price',
    price_desc: 'price',
  }
  const params: Record<string, string | number | null | undefined> = {
    keyword: query,
    price_min: filters.priceMin,
    price_max: filters.priceMax,
    sort: sortMap[filters.sort],
    order: filters.sort === 'price_asc' ? 'asc' : 'desc',
    exclude_keyword: filters.excludeKeywords || null,
  }
  if (storePage > 1) params.page = storePage
  if (filters.onSaleOnly) params.status = 'on_sale'
  if (filters.sellerPaysShipping) params.shipping_payer_id = 2
  if (filters.saleType === 'auction') params.item_type = 'mercari_auction'
  if (filters.saleType === 'fixed') params.item_type = 'mercari'
  const url = withParams('https://jp.mercari.com/search', params)
  const ids = mercariConditionIds(filters)
  if (!ids.length) return url
  const extra = ids.map((id) => `item_condition_id=${id}`).join('&')
  return `${url}&${extra}`
}

export function yahooSearchUrl(query: string, storePage: number, filters: CatalogSearchFilters): string {
  const params: Record<string, string | number | null | undefined> = {
    p: query,
    aucminprice: filters.priceMin,
    aucmaxprice: filters.priceMax,
    ve: filters.excludeKeywords || null,
  }
  if (storePage > 1) params.b = (storePage - 1) * 50 + 1
  if (filters.sort === 'newest') params.s1 = 'new'
  else if (filters.sort === 'price_asc') {
    params.s1 = 'cbids'
    params.o1 = 'a'
  } else if (filters.sort === 'price_desc') {
    params.s1 = 'cbids'
    params.o1 = 'd'
  }
  if (filters.sellerPaysShipping) params.shipping = 1
  if (filters.saleType === 'fixed') params.fixed = 1
  if (filters.conditions.includes('new') && !filters.conditions.includes('used') && !filters.conditions.includes('good')) {
    params.new = 1
  }
  if (filters.conditions.includes('used') && !filters.conditions.includes('new')) {
    params.istatus = 2
  }
  return withParams('https://auctions.yahoo.co.jp/search/search', params)
}

export function yahooFleaSearchUrl(query: string, storePage: number, filters: CatalogSearchFilters): string {
  const params: Record<string, string | number | null | undefined> = {
    minPrice: filters.priceMin,
    maxPrice: filters.priceMax,
  }
  if (storePage > 1) params.page = storePage
  if (filters.onSaleOnly) params.open = 1
  if (filters.sort === 'price_asc') params.sort = 'price'
  else if (filters.sort === 'price_desc') params.sort = '-price'
  else if (filters.sort === 'newest') params.sort = 'created'
  if (filters.sellerPaysShipping) params.postage = 0
  return withParams(`https://paypayfleamarket.yahoo.co.jp/search/${encodeURIComponent(query)}`, params)
}

export function snkrdunkSearchUrl(query: string, storePage: number, filters: CatalogSearchFilters): string {
  const params: Record<string, string | number | null | undefined> = {
    query: `${query}${excludeQuerySuffix(filters)}`.trim(),
  }
  if (storePage > 1) params.page = storePage
  if (filters.conditions.length === 1 && filters.conditions[0] === 'used') params.used = 1
  return withParams('https://snkrdunk.com/search', params)
}

export function mercariConditionIds(filters: CatalogSearchFilters): number[] {
  if (!filters.conditions.length) return []
  const ids: number[] = []
  if (filters.conditions.includes('new')) ids.push(1)
  if (filters.conditions.includes('good')) ids.push(2, 3)
  if (filters.conditions.includes('used')) ids.push(4, 5, 6)
  return [...new Set(ids)]
}

export function mercariSortFields(filters: CatalogSearchFilters): { sort: string; order: string } {
  if (filters.sort === 'newest') return { sort: 'SORT_CREATED_TIME', order: 'ORDER_DESC' }
  if (filters.sort === 'price_asc') return { sort: 'SORT_PRICE', order: 'ORDER_ASC' }
  if (filters.sort === 'price_desc') return { sort: 'SORT_PRICE', order: 'ORDER_DESC' }
  return { sort: 'SORT_SCORE', order: 'ORDER_DESC' }
}

export function buildStoreSearchUrl(
  storeId: StoreId,
  query: string,
  storePage: number,
  filters: CatalogSearchFilters,
): string {
  if (storeId === 'amazon') return amazonSearchUrl(query, storePage, filters)
  if (storeId === 'rakuma') return rakumaSearchUrl(query, storePage, filters)
  if (storeId === 'mercari') return mercariHtmlSearchUrl(query, storePage, filters)
  if (storeId === 'yahoo') return yahooSearchUrl(query, storePage, filters)
  if (storeId === 'yahoo_flea') return yahooFleaSearchUrl(query, storePage, filters)
  return snkrdunkSearchUrl(query, storePage, filters)
}

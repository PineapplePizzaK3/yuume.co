export const CATALOG_SORTS = ['relevance', 'newest', 'price_asc', 'price_desc']
export const CATALOG_CONDITIONS = ['new', 'good', 'used']
export const CATALOG_SALE_TYPES = ['any', 'fixed', 'auction']
export const CATALOG_CATEGORIES = ['any', 'tcg', 'sneakers', 'figures', 'apparel']

export const DEFAULT_CATALOG_FILTERS = {
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

function asPositiveInt(value) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, 99_999_999)
}

function uniqueConditions(list) {
  const allowed = new Set(CATALOG_CONDITIONS)
  const out = []
  for (const item of Array.isArray(list) ? list : []) {
    const id = String(item || '').trim()
    if (!allowed.has(id) || out.includes(id)) continue
    out.push(id)
  }
  return out
}

export function sanitizeCatalogFilters(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  let priceMin = asPositiveInt(source.priceMin)
  let priceMax = asPositiveInt(source.priceMax)
  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    const swap = priceMin
    priceMin = priceMax
    priceMax = swap
  }
  const sort = CATALOG_SORTS.includes(source.sort) ? source.sort : DEFAULT_CATALOG_FILTERS.sort
  const saleType = CATALOG_SALE_TYPES.includes(source.saleType)
    ? source.saleType
    : DEFAULT_CATALOG_FILTERS.saleType
  const category = CATALOG_CATEGORIES.includes(source.category)
    ? source.category
    : DEFAULT_CATALOG_FILTERS.category
  return {
    priceMin,
    priceMax,
    sort,
    onSaleOnly: source.onSaleOnly !== false && source.onSaleOnly !== '0' && source.onSaleOnly !== 0,
    conditions: uniqueConditions(source.conditions),
    excludeKeywords: String(source.excludeKeywords || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    sellerPaysShipping: Boolean(source.sellerPaysShipping && source.sellerPaysShipping !== '0'),
    saleType,
    category,
    brand: String(source.brand || '').replace(/\s+/g, ' ').trim().slice(0, 40),
  }
}

export function catalogFiltersKey(filters) {
  return JSON.stringify(sanitizeCatalogFilters(filters))
}

export function catalogFiltersAreDefault(filters) {
  const f = sanitizeCatalogFilters(filters)
  return (
    f.priceMin == null
    && f.priceMax == null
    && f.sort === DEFAULT_CATALOG_FILTERS.sort
    && f.onSaleOnly === DEFAULT_CATALOG_FILTERS.onSaleOnly
    && f.conditions.length === 0
    && !f.excludeKeywords
    && f.sellerPaysShipping === false
    && f.saleType === DEFAULT_CATALOG_FILTERS.saleType
    && f.category === DEFAULT_CATALOG_FILTERS.category
    && !f.brand
  )
}

/** Price/condition/sale filters shrink each marketplace page, so a short batch is not "the end". */
export function catalogFiltersNarrowHitCount(filters) {
  const f = sanitizeCatalogFilters(filters)
  return (
    f.priceMin != null
    || f.priceMax != null
    || f.conditions.length > 0
    || Boolean(f.excludeKeywords)
    || f.sellerPaysShipping
    || f.saleType !== 'any'
    || (f.category && f.category !== 'any')
    || Boolean(f.brand)
  )
}

export function catalogSearchMayHaveMore({
  serverHasMore = false,
  returnedCount = 0,
  matchedCount = null,
  newItemCount = null,
  append = false,
  filters = DEFAULT_CATALOG_FILTERS,
} = {}) {
  const server = Boolean(serverHasMore)
  const returned = Number(returnedCount) || 0
  const matched = matchedCount == null ? returned : Number(matchedCount) || 0
  const added = newItemCount == null ? matched : Number(newItemCount) || 0
  const narrow = catalogFiltersNarrowHitCount(filters)

  if (append) {
    if (added > 0) return server || narrow
    if (matched > 0) return false
    return server && returned > 0
  }
  return server || (narrow && returned > 0)
}

export function parseCatalogFiltersFromSearchParams(searchParams) {
  const params = searchParams && typeof searchParams.get === 'function'
    ? searchParams
    : new URLSearchParams(String(searchParams || ''))
  const cond = String(params.get('cond') || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const onSaleRaw = params.get('onsale')
  return sanitizeCatalogFilters({
    priceMin: params.get('min'),
    priceMax: params.get('max'),
    sort: params.get('sort') || DEFAULT_CATALOG_FILTERS.sort,
    onSaleOnly: onSaleRaw == null ? true : onSaleRaw !== '0',
    conditions: cond,
    excludeKeywords: params.get('ex') || '',
    sellerPaysShipping: params.get('ship') === '1',
    saleType: params.get('sale') || DEFAULT_CATALOG_FILTERS.saleType,
    category: params.get('cat') || DEFAULT_CATALOG_FILTERS.category,
    brand: params.get('brand') || '',
  })
}

export function writeCatalogFiltersToSearchParams(searchParams, filters) {
  const next = searchParams instanceof URLSearchParams
    ? new URLSearchParams(searchParams)
    : new URLSearchParams(String(searchParams || ''))
  const f = sanitizeCatalogFilters(filters)
  const setOrDelete = (key, value) => {
    if (value == null || value === '') next.delete(key)
    else next.set(key, String(value))
  }
  setOrDelete('min', f.priceMin)
  setOrDelete('max', f.priceMax)
  setOrDelete('sort', f.sort === DEFAULT_CATALOG_FILTERS.sort ? '' : f.sort)
  if (f.onSaleOnly) next.delete('onsale')
  else next.set('onsale', '0')
  setOrDelete('cond', f.conditions.length ? f.conditions.join(',') : '')
  setOrDelete('ex', f.excludeKeywords)
  setOrDelete('ship', f.sellerPaysShipping ? '1' : '')
  setOrDelete('sale', f.saleType === DEFAULT_CATALOG_FILTERS.saleType ? '' : f.saleType)
  setOrDelete('cat', f.category === DEFAULT_CATALOG_FILTERS.category ? '' : f.category)
  setOrDelete('brand', f.brand)
  return next
}

export function splitExcludeKeywords(text) {
  return String(text || '')
    .split(/[\s,，、]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 2)
}

const NEW_HINT = /新品|未使用|未開封|\bnew\b|bnib/i
const USED_HINT = /中古|ジャンク|傷|汚れ|used|worn/i
const GOOD_HINT = /美品|未使用に近い|目立った傷や汚れなし/i
const BUYER_SHIP_HINT = /着払い|送料別/i
const SELLER_SHIP_HINT = /送料無料|送料込|送料込み/i
const CATEGORY_HINTS = {
  tcg: /ポケモン|pokemon|ポケカ|ピカチュウ|遊戯王|yugioh|ワンピースカード|one\s*piece|オリパ|psa\s*\d|カード|\bcards?\b/i,
  sneakers: /nike|adidas|jordan|dunk|sneaker|スニーカー|靴|yeezy/i,
  figures: /フィギュア|figure|nendoroid|ねんどろいど|figma|scale|statue|プラモデル/i,
  apparel: /パーカー|tシャツ|hoodie|apparel|jacket|シャツ|服/i,
}

function itemTags(item) {
  return Array.isArray(item?.tags) ? item.tags : []
}

function inferConditionBand(title) {
  const text = String(title || '')
  if (NEW_HINT.test(text) && !USED_HINT.test(text)) return 'new'
  if (GOOD_HINT.test(text)) return 'good'
  if (USED_HINT.test(text) && !NEW_HINT.test(text)) return 'used'
  return null
}

export function hitMatchesCatalogFilters(item, filters) {
  const f = sanitizeCatalogFilters(filters)
  const title = String(item?.title || '')
  const price = Number(item?.price)
  const hasPrice = Number.isFinite(price) && price > 0
  const tags = itemTags(item)
  const isAuction = tags.includes('auction')
  const isGone = tags.includes('sold') || tags.includes('unavailable')

  if (f.priceMin != null && hasPrice && price < f.priceMin) return false
  if (f.priceMax != null && hasPrice && price > f.priceMax) return false
  if (f.onSaleOnly && isGone) return false

  for (const word of splitExcludeKeywords(f.excludeKeywords)) {
    if (title.toLowerCase().includes(word)) return false
  }

  if (f.saleType === 'auction' && !isAuction) return false
  if (f.saleType === 'fixed' && isAuction) return false

  if (f.sellerPaysShipping) {
    if (BUYER_SHIP_HINT.test(title)) return false
    if (title && SELLER_SHIP_HINT.test(title) === false && BUYER_SHIP_HINT.test(title) === false) {
      // Unknown: keep. Native marketplace params already narrowed Mercari/Rakuma/Yahoo.
    }
  }

  if (f.conditions.length > 0) {
    const band = inferConditionBand(title)
    if (band && !f.conditions.includes(band)) return false
  }

  if (f.category && f.category !== 'any') {
    const hint = CATEGORY_HINTS[f.category]
    if (hint && !hint.test(title)) return false
  }

  const brand = String(f.brand || '').trim().toLowerCase()
  if (brand && !title.toLowerCase().includes(brand)) return false

  return true
}

export function applyCatalogFilters(hits, filters) {
  return (Array.isArray(hits) ? hits : []).filter((item) => hitMatchesCatalogFilters(item, filters))
}

export function sortCatalogHits(hits, sort) {
  const list = Array.isArray(hits) ? [...hits] : []
  if (sort === 'price_asc' || sort === 'price_desc') {
    const dir = sort === 'price_asc' ? 1 : -1
    list.sort((a, b) => {
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
  return list
}

export function tagCatalogHitBatch(hits, loadedBatch = 0) {
  return (Array.isArray(hits) ? hits : []).map((item) => ({ ...item, loadedBatch }))
}

/** Keep already-visible order; sort only the new batch and append unique URLs. */
export function appendCatalogHits(existing, incoming, { sort, loadedBatch = 1 } = {}) {
  const prev = Array.isArray(existing) ? existing : []
  const seen = new Set(prev.map((item) => item?.productUrl).filter(Boolean))
  const fresh = []
  for (const item of sortCatalogHits(incoming, sort)) {
    const url = item?.productUrl
    if (!url || seen.has(url)) continue
    seen.add(url)
    fresh.push({ ...item, loadedBatch })
  }
  return {
    results: [...prev, ...fresh],
    addedCount: fresh.length,
  }
}

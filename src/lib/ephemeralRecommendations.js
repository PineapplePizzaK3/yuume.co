/** Similar listings for a temporary product page, ranked across marketplaces. */

const NOISE = new Set([
  '送料無料',
  '送料込',
  '送料込み',
  '中古',
  '美品',
  '新品',
  '未使用',
  '未開封',
  '即決',
  '匿名',
  '匿名配送',
  'ジャンク',
  'used',
  'new',
  'free',
  'shipping',
  'ほぼ新品',
  '箱なし',
  '本体のみ',
  'まとめ',
  'セット',
])

const BRACKETS = /【[^】]*】|［[^］]*］|\[[^\]]*\]|（[^）]{0,16}）|\([^)]{0,20}\)/g

function cleanToken(value) {
  return String(value || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}/]+$/gu, '')
}

export function buildEphemeralRecommendationQuery(title) {
  const stripped = String(title || '').replace(BRACKETS, ' ')
  const tokens = stripped
    .split(/[\s・、。,，!！?？|／]+/)
    .map(cleanToken)
    .filter((token) => token.length > 1)
    .filter((token) => !NOISE.has(token) && !NOISE.has(token.toLowerCase()))

  if (!tokens.length) {
    const fallback = stripped.replace(/\s+/g, ' ').trim()
    return fallback.length >= 2 ? fallback.slice(0, 48) : ''
  }

  const ranked = tokens.map((token, index) => {
    let score = Math.min(token.length, 12) / 12 - index * 0.04
    if (/[A-Za-z]/.test(token) && /\d/.test(token)) score += 5
    else if (/[A-Za-z]{3,}/.test(token)) score += 3
    if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(token)) score += 2
    return { token, score, index }
  })
  ranked.sort((a, b) => b.score - a.score || a.index - b.index)

  const picked = []
  let length = 0
  for (const row of ranked) {
    if (picked.length >= 6) break
    const token = row.token.length > 40 ? row.token.slice(0, 40) : row.token
    if (length + token.length > 64 && picked.length > 0) break
    picked.push({ ...row, token })
    length += token.length + 1
  }
  picked.sort((a, b) => a.index - b.index)
  return picked.map((row) => row.token).join(' ')
}

export function canonicalListingUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    parsed.hash = ''
    parsed.search = ''
    return parsed.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return raw.toLowerCase()
  }
}

function priceCloseness(sourcePrice, hitPrice) {
  const base = Number(sourcePrice)
  const price = Number(hitPrice)
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(price) || price <= 0) return 0.25
  const ratio = price / base
  if (ratio >= 0.6 && ratio <= 1.6) return 1
  if (ratio >= 0.35 && ratio <= 2.5) return 0.45
  return 0
}

function titleOverlap(query, title) {
  const tokens = String(query || '').split(/\s+/).filter(Boolean)
  if (!tokens.length) return 0
  const haystack = String(title || '').toLowerCase()
  let hits = 0
  for (const token of tokens) {
    if (haystack.includes(token.toLowerCase())) hits += 1
  }
  return hits / tokens.length
}

function isUnavailable(hit) {
  const tags = Array.isArray(hit?.tags) ? hit.tags : []
  return tags.includes('sold') || tags.includes('unavailable')
}

/**
 * Picks similar listings and spreads them across marketplaces before repeating a store.
 */
export function rankEphemeralRecommendations(hits, source = {}, { limit = 8, perStore = 2 } = {}) {
  const query = buildEphemeralRecommendationQuery(source.title)
  const currentUrl = canonicalListingUrl(source.productUrl || source.external_url)
  const seen = new Set()
  const ranked = []

  for (const hit of Array.isArray(hits) ? hits : []) {
    const productUrl = String(hit?.productUrl || hit?.external_url || '').trim()
    const urlKey = canonicalListingUrl(productUrl)
    if (!urlKey || urlKey === currentUrl || seen.has(urlKey)) continue
    if (!String(hit?.title || '').trim()) continue
    if (isUnavailable(hit)) continue
    const overlap = titleOverlap(query, hit.title)
    if (query && overlap <= 0) continue
    seen.add(urlKey)
    ranked.push({
      ...hit,
      productUrl,
      _score: overlap * 0.75 + priceCloseness(source.priceJpy ?? source.price, hit.price) * 0.25,
    })
  }

  ranked.sort((a, b) => b._score - a._score || String(a.title).localeCompare(String(b.title)))

  const picked = []
  const pickedUrls = new Set()
  const counts = new Map()
  const take = (allowRepeat) => {
    for (const hit of ranked) {
      if (picked.length >= limit) break
      if (pickedUrls.has(hit.productUrl)) continue
      const store = String(hit.storeId || 'unknown')
      const count = counts.get(store) || 0
      if (!allowRepeat && count > 0) continue
      if (allowRepeat && count >= perStore) continue
      picked.push(hit)
      pickedUrls.add(hit.productUrl)
      counts.set(store, count + 1)
    }
  }
  take(false)
  take(true)

  return {
    query,
    storeCount: new Set(picked.map((hit) => String(hit.storeId || 'unknown'))).size,
    items: picked.map(({ _score, ...hit }) => hit),
  }
}

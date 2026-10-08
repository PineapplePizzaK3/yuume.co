/**
 * Shared Japan-market query builder (dependency-free).
 * Used by Find-in-Japan UI and (later) snapshot / catalog-search collector context.
 */

const EXCLUSION_TERMS = ['PSA', 'BGS', 'CGC', 'まとめ', 'オリパ', '空箱', 'スリーブのみ']

export function buildMarketQuery({ nameJa, number, setCode } = {}) {
  const parts = []
  const name = String(nameJa || '').trim()
  const num = String(number || '').trim()
  const set = String(setCode || '').trim()
  if (name) parts.push(name)
  if (num) parts.push(num.includes('/') ? num : num)
  if (set) parts.push(set)
  const positive = parts.join(' ').replace(/\s+/g, ' ').trim()
  const exclusions = EXCLUSION_TERMS.map((term) => `-${term}`).join(' ')
  return {
    query: [positive, exclusions].filter(Boolean).join(' ').trim(),
    positive,
    exclusions: EXCLUSION_TERMS.slice(),
  }
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '')
}

/**
 * @returns {'exact'|'likely'|'loose'}
 */
export function classifyMatch(hit, item = {}) {
  const title = normalize(hit?.title || hit?.name || '')
  if (!title) return 'loose'
  const name = normalize(item.name_ja || item.nameJa)
  const number = normalize(item.number)
  const setCode = normalize(item.set_code || item.setCode)
  const hasName = name && title.includes(name)
  const hasNumber = number && title.includes(number)
  const hasSet = setCode && title.includes(setCode)
  if (hasName && (hasNumber || hasSet)) return 'exact'
  if (hasName || (hasNumber && hasSet)) return 'likely'
  return 'loose'
}

export function buildLinkOutUrl(template, query) {
  if (!template || !String(template).includes('{query}')) return null
  return String(template).replaceAll('{query}', encodeURIComponent(query || ''))
}

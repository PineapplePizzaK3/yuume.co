import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { LIVE_RIPS_SNKRDUNK_PRODUCTS } from '../../src/data/liveRipsSnkrdunkCatalog.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const outputPath = path.join(projectRoot, 'src', 'data', 'collectionTopCards.js')
const setCodeOverridesPath = path.join(__dirname, 'collection-set-codes.json')

const SEARCH_ENDPOINT = 'https://snkrdunk.com/en/v1/search'
const USER_AGENT = 'Mozilla/5.0 (compatible; LiveRipsTopCardsBot/1.0)'
const TOP_N = 12
const PER_PAGE = 120
const MAX_PAGES = 4
const MAX_RETRIES = 3
const REQUEST_DELAY_MS = 280
const RETRY_BASE_DELAY_MS = 700

const RARITY_PATTERNS = [
  'MANGA',
  'ALT ART',
  'SECRET RARE',
  'ULTRA RARE',
  'SPECIAL ART RARE',
  'HYPER RARE',
  'SAR',
  'UR',
  'SEC',
  'CSR',
  'CHR',
  'SR',
  'AR',
  'RRR',
  'RR',
  'PR',
  'P',
  'R',
  'U',
  'C',
]

// Sealed products (box/pack/case) — keep singles that only mention "Pack" inside collection parentheses.
const SEALED_PRODUCT_PATTERN =
  /(?:^|\s)(?:box|case|carton|ブースター|ボックス|カートン)\s*$/i

// Error / misprint listings inflate prices and are not part of the set pull pool.
const ERROR_CARD_PATTERN =
  /\b(?:printing\s+error|text\s+error|error\s+ver\.?|error\s+version|misprint|miscut|error\s+card)\b|エラー|ミスプリント/i

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeCollectionKey(productId) {
  return String(productId || '')
    .trim()
    .replace(/-no-shrink$/i, '')
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeSetCode(code) {
  const raw = String(code || '')
    .trim()
    .toUpperCase()
  if (!raw) return ''
  return raw.replace(/\s+/g, '')
}

function normalizeMatchToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[「」『』"'“”‘’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function parseCardNumber(name = '') {
  const text = String(name || '')
  const bracketMatch = text.match(/\[([^\]]+)\]/)
  if (bracketMatch) {
    const parts = bracketMatch[1].split(/\s+/).filter(Boolean)
    const bySlash = parts.find((part) => /\d+\s*\/\s*\d+/.test(part))
    if (bySlash) return bySlash.replace(/\s+/g, '')
    const byCode = parts.find((part) => /^[A-Z0-9]{1,6}-?\d{1,4}[A-Z]?$/i.test(part))
    if (byCode) return byCode.toUpperCase()
  }

  const slashMatch = text.match(/\b(\d{1,3}\s*\/\s*\d{2,3})\b/)
  if (slashMatch) return slashMatch[1].replace(/\s+/g, '')
  return ''
}

function parseRarity(name = '') {
  const upper = String(name || '').toUpperCase()
  for (const rarity of RARITY_PATTERNS) {
    const pattern = new RegExp(`(?:\\b|\\(|\\[)${escapeRegex(rarity)}(?:\\b|\\)|\\])`, 'i')
    if (pattern.test(upper)) return rarity
  }
  return ''
}

function resolveSetCodeFromText(text) {
  const source = String(text || '')
  if (!source) return ''
  const patterns = [
    /\b(SV\d{1,3}[A-Z]?)\b/i,
    /\b(M\d[A-Z]?)\b/i,
    /\b(OP[-\s]?\d{1,2})\b/i,
    /\b(EB[-\s]?\d{1,2})\b/i,
    /\b(FB\d{2})\b/i,
    /\b(UA[-\s]?\d{2}[A-Z]{0,2})\b/i,
    /\b(GD\d{2,3})\b/i,
    /\b(DM\d{2}[-\s]?RP\d+[A-Z]?)\b/i,
    /\b(ROTA|PHNI|DUNE|LEDE|INFO|RAGE|ALIN|SUDA|CYAC)\b/i,
  ]
  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (match?.[1]) return normalizeSetCode(match[1]).replace(/\s+/g, '-')
  }
  return ''
}

function extractQuotedNames(text) {
  const source = String(text || '')
  const names = []
  const patterns = [
    /「([^」]{2,80})」/g,
    /『([^』]{2,80})』/g,
    /"([^"]{2,80})"/g,
    /“([^”]{2,80})”/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = normalizeText(match[1])
      if (value) names.push(value)
    }
  }
  return names
}

function extractCollectionLabels(product) {
  const labels = []
  const parts = [product?.nameEn, product?.name, product?.collectionTitle]
  for (const part of parts) {
    labels.push(...extractQuotedNames(part))
  }

  // Fallback: strip common sealed-product boilerplate and keep the remaining title.
  if (!labels.length) {
    for (const part of parts) {
      const cleaned = normalizeText(part)
        .replace(/^Pokemon Card Game\s+/i, '')
        .replace(/^Pokémon Card Game\s+/i, '')
        .replace(/^ONE PIECE Card Game\s+/i, '')
        .replace(/^Yu-Gi-Oh!? Card Game\s+/i, '')
        .replace(/ボックス.*$/u, '')
        .replace(/\s*Box\s*$/i, '')
        .replace(/【\s*シュリンクなし\s*】/gi, '')
        .trim()
      if (cleaned.length >= 4) labels.push(cleaned)
    }
  }

  return [...new Set(labels.map((item) => normalizeText(item)).filter(Boolean))]
}

function resolveSetCode(product, override = {}, cards = []) {
  if (override?.setCode) return normalizeSetCode(override.setCode)
  const parts = [product?.name, product?.nameEn, product?.collectionTitle].filter(Boolean)
  for (const part of parts) {
    const inferred = resolveSetCodeFromText(part)
    if (inferred) return inferred
  }
  for (const card of cards) {
    const fromName = resolveSetCodeFromText(card?.name || '')
    if (fromName) return fromName
    const fromNumber = resolveSetCodeFromText(card?.cardNumber || '')
    if (fromNumber) return fromNumber
  }
  return ''
}

function getCategorySeed(categoryId = '') {
  const id = String(categoryId || '')
  if (id.includes('pokemon')) return 'Pokemon'
  if (id.includes('one-piece')) return 'One Piece'
  if (id.includes('yugioh')) return 'Yu-Gi-Oh'
  if (id.includes('weis')) return 'Weiss Schwarz'
  if (id.includes('dragon-ball')) return 'Dragon Ball'
  if (id.includes('union-arena')) return 'Union Arena'
  if (id.includes('gundam')) return 'Gundam'
  if (id.includes('duelmasters')) return 'Duel Masters'
  return ''
}

function buildKeywordCandidates(product, setCode, labels = [], override = {}) {
  const categorySeed = getCategorySeed(product?.categoryId)
  const overrideKeywords = Array.isArray(override?.keywords)
    ? override.keywords.map((item) => normalizeText(item)).filter(Boolean)
    : []
  const variants = [
    ...overrideKeywords,
    ...labels,
    setCode,
    setCode ? setCode.replace(/-/g, '') : '',
    setCode ? `${categorySeed} ${setCode}`.trim() : '',
  ]
    .map((item) => normalizeText(item))
    .filter(Boolean)
  return [...new Set(variants)]
}

function buildCollectionGroups(products = []) {
  const grouped = new Map()
  for (const product of products) {
    const key = normalizeText(product?.collectionTitle || product?.name || product?.id)
    if (!key) continue
    const bucket = grouped.get(key) || []
    bucket.push(product)
    grouped.set(key, bucket)
  }

  return [...grouped.values()].map((items) => {
    const withShrink = items.find((row) => row?.shrinkwrapOption === 'with') || null
    const primary = withShrink || items[0]
    return {
      collectionKey: normalizeCollectionKey(primary?.id),
      primary,
      products: items,
    }
  })
}

async function loadSetCodeOverrides() {
  try {
    const raw = await readFile(setCodeOverridesPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

async function loadPreviousTopCardsMap() {
  try {
    const url = `${pathToFileURL(outputPath).href}?t=${Date.now()}`
    const mod = await import(url)
    const map = mod?.COLLECTION_TOP_CARDS
    if (!map || typeof map !== 'object' || Array.isArray(map)) return {}
    return map
  } catch {
    return {}
  }
}

async function fetchSearchPage(keyword, page) {
  const url = `${SEARCH_ENDPOINT}?keyword=${encodeURIComponent(keyword)}&perPage=${PER_PAGE}&page=${page}`
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      referer: 'https://snkrdunk.com/en/search',
      origin: 'https://snkrdunk.com',
    },
  })
  if (!response.ok) {
    throw new Error(`SNKRDUNK search failed (${response.status})`)
  }
  return response.json()
}

async function fetchSearchPageWithRetry(keyword, page) {
  let attempt = 0
  while (attempt < MAX_RETRIES) {
    attempt += 1
    try {
      return await fetchSearchPage(keyword, page)
    } catch (error) {
      if (attempt >= MAX_RETRIES) throw error
      await sleep(RETRY_BASE_DELAY_MS * attempt)
    }
  }
  return { streetwears: [] }
}

function matchesCollection(itemName, setCode, labels = [], extraKeywords = []) {
  const name = String(itemName || '')
  const nameNorm = normalizeMatchToken(name)

  const tokens = [...labels, ...extraKeywords]
    .map((token) => normalizeMatchToken(token))
    .filter((token) => token.length >= 3)

  if (tokens.some((token) => nameNorm.includes(token))) return true

  if (setCode) {
    const setNorm = normalizeMatchToken(setCode)
    if (setNorm && nameNorm.includes(setNorm)) return true
  }

  return false
}

function isErrorCard(name) {
  return ERROR_CARD_PATTERN.test(String(name || ''))
}

function looksLikeSingleCard(name) {
  const text = String(name || '')
  if (!text) return false
  // Singles almost always include a bracketed card number.
  if (!/\[[^\]]+\]/.test(text)) return false
  if (SEALED_PRODUCT_PATTERN.test(text)) return false
  if (isErrorCard(text)) return false
  return true
}

function toCardRow(item, setCode) {
  const name = normalizeText(item?.name)
  const price = Number(item?.minPrice || 0)
  if (!name || !(price > 0)) return null
  const snkrdunkId = String(item?.id || '').trim()
  if (!snkrdunkId) return null
  const url = `https://snkrdunk.com/en/apparels/${snkrdunkId}`
  const cardNumber = parseCardNumber(name)
  return {
    snkrdunkId,
    name,
    nameEn: name,
    rarity: parseRarity(name),
    cardNumber,
    setCode,
    imageUrl: String(item?.thumbnailUrl || '').trim(),
    priceJpy: price,
    url,
  }
}

function dedupeCards(rows) {
  const byKey = new Map()
  for (const row of rows) {
    const key = [
      normalizeText(row.cardNumber || '').toUpperCase(),
      normalizeText(row.rarity || '').toUpperCase(),
      normalizeText(row.name).toUpperCase(),
    ].join('|')
    const existing = byKey.get(key)
    if (!existing || Number(row.priceJpy) < Number(existing.priceJpy)) {
      byKey.set(key, row)
    }
  }
  return [...byKey.values()]
}

async function fetchTopCardsForCollection({ product, setCode, labels, overrideKeywords }) {
  const keywords = buildKeywordCandidates(product, setCode, labels, { keywords: overrideKeywords })
  const cards = []

  for (const keyword of keywords) {
    let emptyPagesInRow = 0
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const payload = await fetchSearchPageWithRetry(keyword, page)
      const items = Array.isArray(payload?.streetwears) ? payload.streetwears : []
      if (!items.length) {
        emptyPagesInRow += 1
        if (emptyPagesInRow >= 2) break
        continue
      }
      emptyPagesInRow = 0
      for (const item of items) {
        const itemName = normalizeText(item?.name)
        if (!item?.isTradingCard || !itemName) continue
        if (!looksLikeSingleCard(itemName)) continue
        if (!matchesCollection(itemName, setCode, labels, overrideKeywords)) continue
        const row = toCardRow(item, setCode)
        if (row) cards.push(row)
      }
      // Early stop once we already have a strong ranked pool.
      if (dedupeCards(cards).length >= TOP_N * 3) {
        await sleep(REQUEST_DELAY_MS)
        break
      }
      await sleep(REQUEST_DELAY_MS)
    }
    if (dedupeCards(cards).length >= TOP_N) break
  }

  return dedupeCards(cards)
    .sort((a, b) => Number(b.priceJpy) - Number(a.priceJpy))
    .slice(0, TOP_N)
}

function buildOutputText(topCardsMap, generatedAt) {
  const source = {
    name: 'SNKRDUNK',
    url: 'https://snkrdunk.com',
  }
  const lines = []
  lines.push('// Auto-generated by scripts/on-demand/build-collection-top-cards.mjs')
  lines.push(`export const COLLECTION_TOP_CARDS_SOURCE = ${JSON.stringify(source, null, 2)}`)
  lines.push('')
  lines.push(`export const COLLECTION_TOP_CARDS_UPDATED_AT = ${JSON.stringify(generatedAt)}`)
  lines.push('')
  lines.push(`export const COLLECTION_TOP_CARDS = ${JSON.stringify(topCardsMap, null, 2)}`)
  lines.push('')
  return `${lines.join('\n')}\n`
}

async function main() {
  const fullRefresh = process.argv.includes('--full')
  const now = new Date().toISOString()
  const setCodeOverrides = await loadSetCodeOverrides()
  const previousTopCards = await loadPreviousTopCardsMap()

  let groups = buildCollectionGroups(LIVE_RIPS_SNKRDUNK_PRODUCTS)
  const limitArg = process.argv.find((arg) => String(arg).startsWith('--limit='))
  if (limitArg) {
    const limit = Math.max(1, Number(String(limitArg).split('=')[1]) || 5)
    groups = groups.slice(0, limit)
  }
  const output = {}
  const unresolved = []
  const empty = []
  const failed = []
  let processed = 0

  for (const group of groups) {
    const collectionKey = group.collectionKey
    const override = setCodeOverrides[collectionKey] || {}
    const labels = extractCollectionLabels(group.primary)
    const setCodeHint = resolveSetCode(group.primary, override)
    const previous = previousTopCards[collectionKey]

    if (!labels.length && !setCodeHint && !(Array.isArray(override?.keywords) && override.keywords.length)) {
      unresolved.push(collectionKey)
      if (previous) output[collectionKey] = previous
      continue
    }

    if (!fullRefresh && previous?.cards?.length) {
      output[collectionKey] = previous
      continue
    }

    processed += 1
    process.stdout.write(
      `[${processed}/${groups.length}] ${collectionKey} (${labels[0] || setCodeHint || 'no-label'})\n`
    )

    try {
      const cards = await fetchTopCardsForCollection({
        product: group.primary,
        setCode: setCodeHint,
        labels,
        overrideKeywords: Array.isArray(override?.keywords) ? override.keywords : [],
      })
      const setCode = resolveSetCode(group.primary, override, cards)

      if (!cards.length) {
        empty.push(collectionKey)
        if (previous) {
          output[collectionKey] = previous
        } else {
          output[collectionKey] = {
            productId: group.primary?.id || collectionKey,
            setCode: setCode || setCodeHint || '',
            labels,
            updatedAt: now,
            source: 'SNKRDUNK',
            cards: [],
          }
        }
      } else {
        output[collectionKey] = {
          productId: group.primary?.id || collectionKey,
          setCode: setCode || setCodeHint || '',
          labels,
          updatedAt: now,
          source: 'SNKRDUNK',
          cards,
        }
      }
    } catch (error) {
      failed.push(`${collectionKey}: ${error?.message || 'unknown error'}`)
      if (previous) {
        output[collectionKey] = previous
      }
    }
  }

  for (const [collectionKey, value] of Object.entries(previousTopCards)) {
    if (!output[collectionKey]) {
      output[collectionKey] = value
    }
  }

  const withCards = Object.values(output).filter((row) => Array.isArray(row?.cards) && row.cards.length > 0).length
  const text = buildOutputText(output, now)
  await writeFile(outputPath, text, 'utf8')

  console.log(`Top cards generated at ${outputPath}`)
  console.log(`Collections: ${Object.keys(output).length} | With cards: ${withCards}`)
  if (unresolved.length) {
    console.warn(`Unresolved labels (${unresolved.length}): ${unresolved.slice(0, 40).join(', ')}${unresolved.length > 40 ? '...' : ''}`)
  }
  if (empty.length) {
    console.warn(`Empty results (${empty.length}): ${empty.slice(0, 40).join(', ')}${empty.length > 40 ? '...' : ''}`)
  }
  if (failed.length) {
    console.warn(`Failed collections (${failed.length}):`)
    failed.forEach((row) => console.warn(`- ${row}`))
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})

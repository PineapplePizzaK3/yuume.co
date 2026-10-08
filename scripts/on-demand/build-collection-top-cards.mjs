import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { LIVE_RIPS_SNKRDUNK_PRODUCTS } from '../../src/data/liveRipsSnkrdunkCatalog.js'
import {
  extractCollectionLabels,
  filterTopCardsForCollection,
  looksLikeSingleCard,
  matchesCollection,
  mergeCollectionTopCards,
  normalizeText,
  parseCardNumber,
  parseRarity,
} from '../../src/lib/collectionTopCardsMatch.js'
import { exitIfAutomationDisabled } from '../lib/marketSourceKillSwitch.mjs'

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeCollectionKey(productId) {
  return String(productId || '')
    .trim()
    .replace(/-no-shrink$/i, '')
}

function normalizeSetCode(code) {
  const raw = String(code || '')
    .trim()
    .toUpperCase()
  if (!raw) return ''
  return raw.replace(/\s+/g, '')
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

function productAllowsEnglish(product) {
  return /\bEN\b|英語版|\benglish\b/i.test(`${product?.nameEn || ''} ${product?.name || ''} ${product?.id || ''}`)
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
    .filter((item) => item.length >= 3 && item.length <= 64)
  return [...new Set(variants)].sort((a, b) => a.length - b.length || a.localeCompare(b))
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

async function fetchTopCardsForCollection({ product, setCode, labels, overrideKeywords, allowEnglish }) {
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
        if (!allowEnglish && /\[EN\]/i.test(itemName)) continue
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

function isCollectionStale(entry, staleHours) {
  if (!(staleHours > 0)) return false
  const updated = Date.parse(entry?.updatedAt || '')
  if (!Number.isFinite(updated)) return true
  return Date.now() - updated >= staleHours * 60 * 60 * 1000
}

function parseStaleHours() {
  const arg = process.argv.find((item) => String(item).startsWith('--stale-hours='))
  if (!arg) return 0
  return Math.max(0, Number(String(arg).split('=')[1]) || 0)
}

function parseCsvArg(name) {
  const arg = process.argv.find((item) => String(item).startsWith(`--${name}=`))
  if (!arg) return null
  return new Set(
    String(arg)
      .slice(name.length + 3)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  )
}

function buildCollectionRecord({ productId, setCode, labels, cards, updatedAt }) {
  return {
    productId,
    setCode: setCode || '',
    labels,
    updatedAt,
    source: 'SNKRDUNK',
    cards: Array.isArray(cards) ? cards : [],
  }
}

async function main() {
  const fullRefresh = process.argv.includes('--full')
  const refilterOnly = process.argv.includes('--refilter-only')
  const fillShort = process.argv.includes('--fill') || fullRefresh
  const staleHours = parseStaleHours()
  const idFilter = parseCsvArg('ids')
  if (!refilterOnly) {
    await exitIfAutomationDisabled('snkrdunk', 'collection-top-cards')
  }
  const now = new Date().toISOString()
  const setCodeOverrides = await loadSetCodeOverrides()
  const previousTopCards = await loadPreviousTopCardsMap()

  let groups = buildCollectionGroups(LIVE_RIPS_SNKRDUNK_PRODUCTS)
  if (idFilter?.size) {
    groups = groups.filter((group) => idFilter.has(group.collectionKey))
  }
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
    const overrideKeywords = Array.isArray(override?.keywords) ? override.keywords : []
    const labels = extractCollectionLabels(group.primary)
    const allowEnglish = productAllowsEnglish(group.primary)
    const previous = previousTopCards[collectionKey]
    const previousCards = filterTopCardsForCollection(previous?.cards || [], {
      setCode: previous?.setCode || '',
      labels: labels.length ? labels : previous?.labels || [],
      extraKeywords: overrideKeywords,
      allowEnglish,
    })
    const setCodeHint = resolveSetCode(group.primary, override, previousCards)

    if (!labels.length && !setCodeHint && !overrideKeywords.length) {
      unresolved.push(collectionKey)
      output[collectionKey] = buildCollectionRecord({
        productId: group.primary?.id || collectionKey,
        setCode: setCodeHint,
        labels,
        cards: previousCards,
        updatedAt: previous?.updatedAt || now,
      })
      continue
    }

    const needsFetch =
      !refilterOnly &&
      (fullRefresh ||
        idFilter?.has(collectionKey) ||
        previousCards.length === 0 ||
        isCollectionStale(previous, staleHours) ||
        (fillShort && previousCards.length < TOP_N))

    if (!needsFetch) {
      output[collectionKey] = buildCollectionRecord({
        productId: group.primary?.id || previous?.productId || collectionKey,
        setCode: setCodeHint || previous?.setCode || '',
        labels,
        cards: previousCards.slice(0, TOP_N),
        updatedAt: previous?.updatedAt || now,
      })
      continue
    }

    processed += 1
    process.stdout.write(
      `[${processed}/${groups.length}] ${collectionKey} (${labels[0] || setCodeHint || 'no-label'})\n`
    )

    try {
      const fetched = await fetchTopCardsForCollection({
        product: group.primary,
        setCode: setCodeHint,
        labels,
        overrideKeywords,
        allowEnglish,
      })
      const cards = dedupeCards(mergeCollectionTopCards(previousCards, fetched))
        .sort((a, b) => Number(b.priceJpy) - Number(a.priceJpy))
        .slice(0, TOP_N)
      const setCode = resolveSetCode(group.primary, override, cards)

      if (!cards.length) empty.push(collectionKey)
      output[collectionKey] = buildCollectionRecord({
        productId: group.primary?.id || collectionKey,
        setCode: setCode || setCodeHint || '',
        labels,
        cards,
        updatedAt: now,
      })
    } catch (error) {
      failed.push(`${collectionKey}: ${error?.message || 'unknown error'}`)
      if (!previousCards.length) empty.push(collectionKey)
      output[collectionKey] = buildCollectionRecord({
        productId: group.primary?.id || collectionKey,
        setCode: setCodeHint || previous?.setCode || '',
        labels,
        cards: previousCards.slice(0, TOP_N),
        updatedAt: previous?.updatedAt || now,
      })
    }

    if (processed > 0 && processed % 15 === 0) {
      await writeFile(outputPath, buildOutputText({ ...previousTopCards, ...output }, now), 'utf8')
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

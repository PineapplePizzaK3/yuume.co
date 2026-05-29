import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage } from '../normalize.ts'
import {
  collectImageCandidates,
  FETCH_TIMEOUT_MS,
  fetchText,
  fetchViaJina,
  isSnkrdunkProductUrl,
  JINA_TIMEOUT_MS,
  parseJinaHits,
  STORE_DEADLINE_MS,
} from './common.ts'

const STORE_ID = 'snkrdunk'
const STORE_NAME = 'SNKRDUNK'
const BASE = 'https://snkrdunk.com'
const QUERY_STOPWORDS = new Set([
  'de',
  'do',
  'da',
  'dos',
  'das',
  'para',
  'com',
  'sem',
  'em',
  'tenis',
  'tênis',
  'sapato',
  'calcado',
  'calçado',
  'sneaker',
  'sneakers',
  'shoe',
  'shoes',
  'masculino',
  'feminino',
  'original',
  'authentic',
  'legit',
])

type SnkrdunkServerProduct = {
  title: string
  link: string
  imageUrl: string
  salePrice: number | null
}

function decodeHtmlEntities(text: string): string {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
}

function cleanText(text: string | null | undefined): string {
  return decodeHtmlEntities(String(text ?? '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function unescapeEmbeddedJson(text: string): string {
  return String(text || '').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

function parseAriaLabel(label: string): { title: string; priceRaw: string | null } {
  const decoded = cleanText(label)
  const match = decoded.match(/^(.+?)\s*-\s*(?:¥|￥)\s*([\d,]+(?:\.\d+)?)\s*$/)
  if (match) return { title: match[1].trim(), priceRaw: match[2] }
  return { title: decoded, priceRaw: null }
}

function snkrdunkTagsFromContext(text: string): Array<'sold' | 'unavailable'> {
  if (/売り切れ|売切れ|sold\s*out|在庫なし/i.test(text)) return ['sold']
  if (/取引終了|公開停止|利用できません|unavailable/i.test(text)) return ['unavailable']
  return []
}

function sourceRank(s: UnifiedSearchHit['source']): number {
  return s === 'html' ? 2 : s === 'mixed' ? 3 : 1
}

function dedupeByUrl(hits: UnifiedSearchHit[]): UnifiedSearchHit[] {
  const m = new Map<string, UnifiedSearchHit>()
  for (const h of hits) {
    const prev = m.get(h.productUrl)
    if (!prev || sourceRank(h.source) > sourceRank(prev.source)) m.set(h.productUrl, h)
  }
  return [...m.values()]
}

function normalizeSearchKeyword(value: string): string {
  return String(value || '').trim().toLowerCase()
}

function normalizeForMatch(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function hasCjk(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)
}

function queryTokensForRelevance(query: string): string[] {
  const cleaned = normalizeForMatch(query).replace(/[^a-z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\s]/g, ' ')
  const rawTokens = cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const tokens: string[] = []
  for (const token of rawTokens) {
    if (QUERY_STOPWORDS.has(token)) continue
    if (token.length >= 2 || hasCjk(token)) tokens.push(token)
  }
  return [...new Set(tokens)]
}

function scoreSnkrdunkRelevance(title: string, query: string): number {
  const tokens = queryTokensForRelevance(query)
  if (tokens.length === 0) return 0

  const normalizedTitle = normalizeForMatch(title)
  if (!normalizedTitle) return -1

  let matched = 0
  let score = 0
  for (const token of tokens) {
    if (!normalizedTitle.includes(token)) continue
    matched += 1
    score += 10 + Math.min(6, token.length)
    if (normalizedTitle.startsWith(token)) score += 3
  }

  if (matched === 0) return -1
  if (tokens.length >= 3 && matched < 2) return -1

  const phrase = tokens.join(' ')
  if (phrase.length >= 4 && normalizedTitle.includes(phrase)) score += 18
  score += Math.round((matched / tokens.length) * 20)
  return score
}

function rankSnkrdunkHits(hits: UnifiedSearchHit[], query: string, pageSize: number): UnifiedSearchHit[] {
  return [...hits]
    .map((hit) => ({ hit, score: scoreSnkrdunkRelevance(hit.title, query) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, pageSize)
    .map(({ hit, score }) => ({ ...hit, score }))
}

function readEmbeddedSearchQuery(html: string): string | null {
  const anchor = html.indexOf('serverSearchData')
  if (anchor < 0) return null
  const head = html.slice(Math.max(0, anchor - 160), anchor + 40)
  const match =
    head.match(/searchParams\\":\{\\"query\\":\\"([^\\"]*)\\"/) ||
    head.match(/searchParams\\\\":\{\\\\"query\\\\":\\\\"([^\\"]*)\\\\"/)
  if (!match) return null
  return unescapeEmbeddedJson(match[1]).trim()
}

function parseServerSearchProducts(html: string, pageSize: number): SnkrdunkServerProduct[] {
  const anchor = html.indexOf('serverSearchData')
  if (anchor < 0) return []

  const productsKey = '\\"products\\":'
  const start = html.indexOf(productsKey, anchor)
  if (start < 0) return []

  const body = html.slice(start + productsKey.length, start + productsKey.length + 400000)
  const unescaped = unescapeEmbeddedJson(body)

  const productRe =
    /\{"displayCardPattern":"[^"]*","title":"((?:\\.|[^"])*)","link":"(https:\/\/snkrdunk\.com\/[^"]+)","imageUrl":"([^"]*)","hasNewMark":(?:true|false),"salePrice":(\d+)/g

  const out: SnkrdunkServerProduct[] = []
  for (const match of unescaped.matchAll(productRe)) {
    const link = match[2]
    if (!isSnkrdunkProductUrl(link)) continue
    out.push({
      title: unescapeEmbeddedJson(match[1]),
      link,
      imageUrl: unescapeEmbeddedJson(match[3]),
      salePrice: Number(match[4]),
    })
    if (out.length >= pageSize * 2) break
  }
  return out
}

function serverProductsToHits(products: SnkrdunkServerProduct[], query: string): UnifiedSearchHit[] {
  const hits: UnifiedSearchHit[] = []
  for (const row of products) {
    const title = cleanText(row.title)
    if (!title || title.length < 3) continue

    const slug = row.link.split('/').pop() || 'item'
    hits.push(
      buildHit({
        id: `${STORE_ID}-api-${slug}`,
        title,
        price: row.salePrice != null && Number.isFinite(row.salePrice) ? row.salePrice : null,
        currency: 'JPY',
        imageUrl: pickBestImage([row.imageUrl], BASE),
        productUrl: row.link,
        storeId: STORE_ID,
        storeName: STORE_NAME,
        source: 'mixed',
        tags: snkrdunkTagsFromContext(title),
      }),
    )
  }
  return rankSnkrdunkHits(hits, query, products.length || 1)
}

function extractSnkrdunkFromServerSearchData(
  html: string,
  pageSize: number,
  query: string,
): UnifiedSearchHit[] {
  const embeddedQuery = readEmbeddedSearchQuery(html)
  if (!embeddedQuery || normalizeSearchKeyword(embeddedQuery) !== normalizeSearchKeyword(query)) {
    return []
  }

  const products = parseServerSearchProducts(html, pageSize)
  if (products.length === 0) return []

  return serverProductsToHits(products, query).slice(0, pageSize)
}

function extractSnkrdunkHitsFromHtml(html: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const tileRe =
    /<a href="(https:\/\/snkrdunk\.com\/(?:products|apparels)\/[^"]+)"[^>]*class="[^"]*productTile[^"]*"[^>]*aria-label="([^"]+)"/gi

  const hits: UnifiedSearchHit[] = []
  const seen = new Set<string>()

  for (const match of html.matchAll(tileRe)) {
    const productUrl = match[1]
    if (!isSnkrdunkProductUrl(productUrl) || seen.has(productUrl)) continue
    seen.add(productUrl)

    const anchor = match[0]
    const { title, priceRaw } = parseAriaLabel(match[2])
    if (!title || title.length < 3) continue

    const idx = match.index ?? 0
    const context = html.slice(Math.max(0, idx - 400), Math.min(html.length, idx + anchor.length + 1200))

    const rawPrice =
      priceRaw ||
      anchor.match(/productPrice[^>]*>\s*([\d,]+)/i)?.[1] ||
      context.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1] ||
      null

    const imageUrl = pickBestImage(
      [
        anchor.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1],
        ...collectImageCandidates(anchor),
        ...collectImageCandidates(context),
      ],
      BASE,
    )

    const slug = productUrl.split('/').pop() || 'item'
    const tags = snkrdunkTagsFromContext(anchor + ' ' + context)
    hits.push(
      buildHit({
        id: `${STORE_ID}-${slug}`,
        title,
        price: parsePrice(rawPrice),
        currency: 'JPY',
        imageUrl,
        productUrl,
        storeId: STORE_ID,
        storeName: STORE_NAME,
        source: 'html',
        tags: tags.length ? tags : undefined,
      }),
    )
    if (hits.length >= pageSize) break
  }

  return rankSnkrdunkHits(hits, query, pageSize)
}

function extractSnkrdunkHitsFromJina(jinaText: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const parsed = parseJinaHits(jinaText, BASE, 'JPY').filter((h) => isSnkrdunkProductUrl(h.productUrl))
  const built = parsed.map((h, idx) =>
    buildHit({
      id: `${STORE_ID}-jina-${idx}-${h.productUrl}`,
      title: h.title,
      price: h.price,
      currency: h.currency,
      imageUrl: null,
      productUrl: h.productUrl,
      storeId: STORE_ID,
      storeName: STORE_NAME,
      source: 'jina',
      tags: snkrdunkTagsFromContext(h.title),
    }),
  )
  return rankSnkrdunkHits(built, query, pageSize)
}

export async function searchSnkrdunk(query: string, pageSize: number, storePage = 1): Promise<UnifiedSearchHit[]> {
  const keyword = String(query || '').trim()
  if (!keyword) return []

  const startedAt = Date.now()
  const budgetMs = STORE_DEADLINE_MS - 300
  const pageParam = storePage > 1 ? `&page=${storePage}` : ''
  const searchUrl = `${BASE}/search?query=${encodeURIComponent(keyword)}${pageParam}`

  const html = await fetchText(searchUrl, FETCH_TIMEOUT_MS, { Referer: `${BASE}/` }).catch(() => '')

  const fromServer = extractSnkrdunkFromServerSearchData(html, pageSize, keyword)
  if (fromServer.length > 0) return fromServer

  const fromHtml = extractSnkrdunkHitsFromHtml(html, pageSize, keyword)
  if (fromHtml.length >= Math.min(pageSize, 4)) return fromHtml.slice(0, pageSize)

  const remaining = budgetMs - (Date.now() - startedAt)
  if (remaining < 2500) return fromHtml.slice(0, pageSize)

  const jinaText = await fetchViaJina(searchUrl, Math.min(JINA_TIMEOUT_MS, remaining)).catch(() => '')
  const merged = dedupeByUrl([...fromHtml, ...extractSnkrdunkHitsFromJina(jinaText, pageSize, keyword)])
  return merged.slice(0, pageSize)
}

import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage, mercariTagsFromText } from '../normalize.ts'
import { searchMercariApi } from './mercariApi.ts'
import {
  collectImageCandidates,
  extractMercariHitsFromHtmlRegex,
  extractMercariHitsFromNextData,
  FETCH_TIMEOUT_MS,
  fetchText,
  fetchViaJina,
  isMercariProductUrl,
  JINA_TIMEOUT_MS,
  matchesQuery,
  parseJinaHits,
  STORE_DEADLINE_MS,
} from './common.ts'

const STORE_ID = 'mercari'
const STORE_NAME = 'Mercari'

function sourceRank(s: UnifiedSearchHit['source']): number {
  if (s === 'mixed') return 3
  if (s === 'html') return 2
  return 1
}

function dedupeByUrl(hits: UnifiedSearchHit[]): UnifiedSearchHit[] {
  const m = new Map<string, UnifiedSearchHit>()
  for (const h of hits) {
    const prev = m.get(h.productUrl)
    if (!prev || sourceRank(h.source) > sourceRank(prev.source)) m.set(h.productUrl, h)
  }
  return [...m.values()]
}

function hitsFromLiBlocks(html: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const blockMatches = Array.from(html.matchAll(/<li[\s\S]*?<\/li>/gi)).slice(0, pageSize * 4)
  const strictHits: UnifiedSearchHit[] = []
  const looseHits: UnifiedSearchHit[] = []

  for (let i = 0; i < blockMatches.length; i += 1) {
    const block = blockMatches[i]?.[0] || ''
    if (!/\/item\/m[A-Za-z0-9_-]+/.test(block)) continue
    const href = block.match(/<a[^>]+href=["']([^"']*\/item\/m[A-Za-z0-9_-]+[^"']*)["']/i)?.[1]
    const productUrl = href ? new URL(href, 'https://jp.mercari.com').toString() : null
    const idFromPath = productUrl?.match(/\/item\/(m[0-9]+)/i)?.[1]
    const title =
      block.match(/aria-label=["']([^"']{3,180})["']/i)?.[1] ||
      block.match(/<span[^>]*>([^<]{3,180})<\/span>/i)?.[1] ||
      (idFromPath ? `Item ${idFromPath}` : null)
    const rawPrice =
      block.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1] ||
      block.match(/"price"\s*:\s*"?([\d.,]+)"?/i)?.[1] ||
      block.match(/([\d,]+(?:\.\d+)?)\s*円/)?.[1] ||
      null
    const imageUrl = pickBestImage(
      [block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], ...collectImageCandidates(block)],
      'https://jp.mercari.com',
    )
    if (!title || !productUrl) continue
    if (!isMercariProductUrl(productUrl)) continue
    const blockTags = mercariTagsFromText(block)
    const built = buildHit({
      id: `${STORE_ID}-li-${i}-${productUrl}`,
      title,
      price: parsePrice(rawPrice),
      currency: 'JPY',
      imageUrl,
      productUrl,
      storeId: STORE_ID,
      storeName: STORE_NAME,
      source: 'html',
      tags: blockTags.length ? blockTags : undefined,
    })
    if (matchesQuery(title, query)) strictHits.push(built)
    else looseHits.push(built)
  }

  if (strictHits.length > 0) return strictHits.slice(0, pageSize)
  if (looseHits.length > 0) return looseHits.slice(0, pageSize)
  return []
}

function collectFromHtml(html: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const collected: UnifiedSearchHit[] = []

  const embedded = extractMercariHitsFromNextData(html, pageSize, query)
  for (let idx = 0; idx < embedded.length; idx += 1) {
    const hit = embedded[idx]
    collected.push(
      buildHit({
        id: `${STORE_ID}-next-${idx}-${hit.productUrl}`,
        title: hit.title,
        price: hit.price,
        currency: 'JPY',
        imageUrl: hit.imageUrl,
        productUrl: hit.productUrl,
        storeId: STORE_ID,
        storeName: STORE_NAME,
        source: 'mixed',
        tags: hit.tags,
      }),
    )
  }

  const regexHits = extractMercariHitsFromHtmlRegex(html, pageSize)
  for (let idx = 0; idx < regexHits.length; idx += 1) {
    const hit = regexHits[idx]
    collected.push(
      buildHit({
        id: `${STORE_ID}-rx-${idx}-${hit.productUrl}`,
        title: hit.title,
        price: hit.price,
        currency: 'JPY',
        imageUrl: hit.imageUrl,
        productUrl: hit.productUrl,
        storeId: STORE_ID,
        storeName: STORE_NAME,
        source: 'html',
      }),
    )
  }

  collected.push(...hitsFromLiBlocks(html, pageSize, query))
  return dedupeByUrl(collected)
}

function collectFromJina(jinaText: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const jinaParsed = parseJinaHits(jinaText, 'https://jp.mercari.com', 'JPY').filter((hit) =>
    isMercariProductUrl(hit.productUrl),
  )
  const strictJ = jinaParsed.filter((hit) => matchesQuery(hit.title, query))
  const jinaUse = strictJ.length > 0 ? strictJ : jinaParsed
  const collected: UnifiedSearchHit[] = []
  for (let idx = 0; idx < jinaUse.length; idx += 1) {
    const hit = jinaUse[idx]
    collected.push(
      buildHit({
        id: `${STORE_ID}-jina-${idx}-${hit.productUrl}`,
        title: hit.title,
        price: hit.price,
        currency: hit.currency,
        imageUrl: null,
        productUrl: hit.productUrl,
        storeId: STORE_ID,
        storeName: STORE_NAME,
        source: 'jina',
      }),
    )
  }
  return collected.slice(0, pageSize)
}

export type MercariPageResult = {
  hits: UnifiedSearchHit[]
  nextPageToken?: string
}

export async function searchMercariPage(
  query: string,
  pageSize: number,
  options: { storePage?: number; pageToken?: string } = {},
): Promise<MercariPageResult> {
  const storePage = Math.max(1, Number(options.storePage) || 1)
  const pageToken = String(options.pageToken || '').trim()

  if (!pageToken) {
    try {
      const apiPage = await searchMercariApi(query, pageSize, {})
      if (apiPage.hits.length > 0) return apiPage
    } catch {
      // fallback HTML abaixo
    }
  } else {
    try {
      return await searchMercariApi(query, pageSize, { pageToken })
    } catch {
      return { hits: [] }
    }
  }

  const htmlHits = await searchMercariHtml(query, pageSize, storePage)
  return { hits: htmlHits }
}

async function searchMercariHtml(query: string, pageSize: number, storePage = 1): Promise<UnifiedSearchHit[]> {

  const startedAt = Date.now()
  const budgetMs = STORE_DEADLINE_MS - 300
  const encoded = encodeURIComponent(query)
  const pageParam = storePage > 1 ? `&page=${storePage}` : ''
  const searchUrl = `https://jp.mercari.com/search?keyword=${encoded}${pageParam}`
  const html = await fetchText(searchUrl, FETCH_TIMEOUT_MS, { Referer: 'https://jp.mercari.com/' }).catch(() => '')

  const fromHtml = collectFromHtml(html, pageSize, query)
  if (fromHtml.length >= Math.min(pageSize, 4)) {
    return fromHtml.slice(0, pageSize)
  }

  const remaining = budgetMs - (Date.now() - startedAt)
  if (remaining < 2500) {
    return fromHtml.slice(0, pageSize)
  }

  const jinaText = await fetchViaJina(searchUrl, Math.min(JINA_TIMEOUT_MS, remaining)).catch(() => '')
  const merged = dedupeByUrl([...fromHtml, ...collectFromJina(jinaText, pageSize, query)])
  return merged.slice(0, pageSize)
}

/** @deprecated Use searchMercariPage */
export async function searchMercari(query: string, pageSize: number, storePage = 1): Promise<UnifiedSearchHit[]> {
  const page = await searchMercariPage(query, pageSize, { storePage })
  return page.hits
}

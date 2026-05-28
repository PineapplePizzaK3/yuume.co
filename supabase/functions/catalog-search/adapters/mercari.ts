import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage } from '../normalize.ts'
import { searchMercariApi } from './mercariApi.ts'
import {
  collectImageCandidates,
  extractMercariHitsFromHtmlRegex,
  extractMercariHitsFromNextData,
  FETCH_TIMEOUT_MS,
  fetchText,
  fetchViaJina,
  isMercariProductUrl,
  matchesQuery,
  parseJinaHits,
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
      'https://jp.mercari.com'
    )
    if (!title || !productUrl) continue
    if (!isMercariProductUrl(productUrl)) continue
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
    })
    if (matchesQuery(title, query)) strictHits.push(built)
    else looseHits.push(built)
  }

  if (strictHits.length > 0) return strictHits.slice(0, pageSize)
  if (looseHits.length > 0) return looseHits.slice(0, pageSize)
  return []
}

export async function searchMercari(query: string, pageSize: number): Promise<UnifiedSearchHit[]> {
  try {
    const apiHits = await searchMercariApi(query, pageSize)
    if (apiHits.length > 0) return apiHits
  } catch {
    // fallback HTML/Jina abaixo
  }

  const encoded = encodeURIComponent(query)
  const searchUrl = `https://jp.mercari.com/search?keyword=${encoded}`

  const [html, jinaText] = await Promise.all([
    fetchText(searchUrl, FETCH_TIMEOUT_MS, { Referer: 'https://jp.mercari.com/' }).catch(() => ''),
    fetchViaJina(searchUrl).catch(() => ''),
  ])

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
      })
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
      })
    )
  }

  collected.push(...hitsFromLiBlocks(html, pageSize, query))

  const jinaParsed = parseJinaHits(jinaText, 'https://jp.mercari.com', 'JPY').filter((hit) =>
    isMercariProductUrl(hit.productUrl)
  )
  const strictJ = jinaParsed.filter((hit) => matchesQuery(hit.title, query))
  const jinaUse = strictJ.length > 0 ? strictJ : jinaParsed
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
      })
    )
  }

  const merged = dedupeByUrl(collected)
  return merged.slice(0, pageSize)
}

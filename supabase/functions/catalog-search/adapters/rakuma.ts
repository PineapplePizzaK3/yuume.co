import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage } from '../normalize.ts'
import {
  collectImageCandidates,
  extractRakumaHitsFromHtmlRegex,
  FETCH_TIMEOUT_MS,
  fetchText,
  fetchViaJina,
  isRakumaProductUrl,
  matchesQuery,
  parseJinaHits,
} from './common.ts'

const STORE_ID = 'rakuma'
const STORE_NAME = 'Rakuma'

function extractFrilPrice(block: string): string | null {
  return (
    block.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1] ||
    block.match(/([\d,]+(?:\.\d+)?)\s*円/)?.[1] ||
    block.match(/"price"\s*:\s*"?([\d.,]+)"?/i)?.[1] ||
    block.match(/data-price=["']([\d.,]+)["']/i)?.[1] ||
    null
  )
}

function sourceRank(s: UnifiedSearchHit['source']): number {
  return s === 'html' ? 2 : 1
}

function dedupeByUrl(hits: UnifiedSearchHit[]): UnifiedSearchHit[] {
  const m = new Map<string, UnifiedSearchHit>()
  for (const h of hits) {
    const prev = m.get(h.productUrl)
    if (!prev || sourceRank(h.source) > sourceRank(prev.source)) m.set(h.productUrl, h)
  }
  return [...m.values()]
}

function hitsFromArticles(html: string, pageSize: number, query: string): UnifiedSearchHit[] {
  const blockMatches = Array.from(html.matchAll(/<article[\s\S]*?<\/article>/gi)).slice(0, pageSize * 2)
  const strictHits: UnifiedSearchHit[] = []
  const looseHits: UnifiedSearchHit[] = []

  for (let i = 0; i < blockMatches.length; i += 1) {
    const block = blockMatches[i]?.[0] || ''
    const href = block.match(/<a[^>]+href=["']([^"']+\/item\/[^"']+)["']/i)?.[1]
    const productUrl = href ? new URL(href, 'https://fril.jp').toString() : null
    const idFromPath = productUrl?.match(/\/item\/([a-z0-9_-]+)/i)?.[1]
    const title =
      block.match(/alt=["']([^"']{3,180})["']/i)?.[1] ||
      block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]?.replace(/<[^>]+>/g, ' ').trim() ||
      (idFromPath ? `Item ${idFromPath}` : null)
    const rawPrice = extractFrilPrice(block)
    const imageUrl = pickBestImage(
      [block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], ...collectImageCandidates(block)],
      'https://fril.jp'
    )

    if (!title || !productUrl) continue
    if (!isRakumaProductUrl(productUrl)) continue
    const built = buildHit({
      id: `${STORE_ID}-ar-${i}-${productUrl}`,
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

export async function searchRakuma(query: string, pageSize: number): Promise<UnifiedSearchHit[]> {
  const encoded = encodeURIComponent(query)
  const searchUrl = `https://fril.jp/s?query=${encoded}`

  const [html, jinaText] = await Promise.all([
    fetchText(searchUrl, FETCH_TIMEOUT_MS, { Referer: 'https://fril.jp/' }).catch(() => ''),
    fetchViaJina(searchUrl).catch(() => ''),
  ])

  const collected: UnifiedSearchHit[] = []

  collected.push(...hitsFromArticles(html, pageSize, query))

  const regexHits = extractRakumaHitsFromHtmlRegex(html, pageSize)
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

  const jinaParsed = parseJinaHits(jinaText, 'https://fril.jp', 'JPY').filter((hit) =>
    isRakumaProductUrl(hit.productUrl)
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

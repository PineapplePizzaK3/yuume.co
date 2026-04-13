import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage } from '../normalize.ts'
import {
  collectImageCandidates,
  extractMercariHitsFromNextData,
  fetchText,
  fetchViaJina,
  isMercariProductUrl,
  matchesQuery,
  parseJinaHits,
} from './common.ts'

const STORE_ID = 'mercari'
const STORE_NAME = 'Mercari'

export async function searchMercari(query: string, pageSize: number): Promise<UnifiedSearchHit[]> {
  const encoded = encodeURIComponent(query)
  const searchUrl = `https://jp.mercari.com/search?keyword=${encoded}`

  try {
    const html = await fetchText(searchUrl)
    const embedded = extractMercariHitsFromNextData(html, pageSize, query)
    if (embedded.length > 0) {
      return embedded.slice(0, pageSize).map((hit, idx) =>
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

    const blockMatches = Array.from(html.matchAll(/<li[\s\S]*?<\/li>/gi)).slice(0, pageSize * 4)
    const strictHits: UnifiedSearchHit[] = []
    const looseHits: UnifiedSearchHit[] = []

    for (let i = 0; i < blockMatches.length && hits.length < pageSize; i += 1) {
      const block = blockMatches[i]?.[0] || ''
      if (!/\/item\/m[A-Za-z0-9_-]+/.test(block)) continue
      const href = block.match(/<a[^>]+href=["']([^"']*\/item\/m[A-Za-z0-9_-]+[^"']*)["']/i)?.[1]
      const title =
        block.match(/aria-label=["']([^"']{3,180})["']/i)?.[1] ||
        block.match(/<span[^>]*>([^<]{3,180})<\/span>/i)?.[1]
      const rawPrice =
        block.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1] ||
        block.match(/"price"\s*:\s*"?([\d.,]+)"?/i)?.[1] ||
        block.match(/([\d,]+(?:\.\d+)?)\s*円/)?.[1] ||
        null
      const imageUrl = pickBestImage(
        [block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], ...collectImageCandidates(block)],
        'https://jp.mercari.com'
      )
      const productUrl = href ? new URL(href, 'https://jp.mercari.com').toString() : null

      if (!title || !productUrl) continue
      if (!isMercariProductUrl(productUrl)) continue
      const built = buildHit({
        id: `${STORE_ID}-${i}-${productUrl}`,
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
  } catch {
    // fallback below
  }

  const jinaText = await fetchViaJina(searchUrl)
  const parsed = parseJinaHits(jinaText, 'https://jp.mercari.com', 'JPY').filter((hit) =>
    isMercariProductUrl(hit.productUrl)
  )
  const strictFallback = parsed.filter((hit) => matchesQuery(hit.title, query))
  const fallbackHits = strictFallback.length > 0 ? strictFallback : parsed
  return fallbackHits.slice(0, pageSize).map((hit, idx) =>
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

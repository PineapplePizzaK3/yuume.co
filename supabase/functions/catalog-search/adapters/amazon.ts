import type { UnifiedSearchHit } from '../types.ts'
import { buildHit, parsePrice, pickBestImage } from '../normalize.ts'
import { collectImageCandidates, fetchText, fetchViaJina, parseJinaHits } from './common.ts'

const STORE_ID = 'amazon'
const STORE_NAME = 'Amazon JP'

export async function searchAmazon(query: string, pageSize: number): Promise<UnifiedSearchHit[]> {
  const encoded = encodeURIComponent(query)
  const searchUrl = `https://www.amazon.co.jp/s?k=${encoded}`

  try {
    const html = await fetchText(searchUrl, 7000)
    const blockMatches = Array.from(
      html.matchAll(/<div[^>]+data-component-type=["']s-search-result["'][\s\S]*?<\/div>\s*<\/div>/gi)
    ).slice(0, pageSize * 2)

    const hits: UnifiedSearchHit[] = []
    for (let i = 0; i < blockMatches.length && hits.length < pageSize; i += 1) {
      const block = blockMatches[i]?.[0] || ''
      const href = block.match(/<a[^>]+class=["'][^"']*a-link-normal[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1]
      const title =
        block.match(/<h2[^>]*>\s*<a[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g, ' ').trim() ||
        block.match(/aria-label=["']([^"']+)["']/i)?.[1]
      const rawPrice = block.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[1] || null
      const imageCandidates = [
        block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1],
        ...collectImageCandidates(block),
      ]
      const imageUrl = pickBestImage(imageCandidates, 'https://www.amazon.co.jp')
      const productUrl = href ? new URL(href, 'https://www.amazon.co.jp').toString() : null

      if (!title || !productUrl) continue
      hits.push(
        buildHit({
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
      )
    }

    if (hits.length > 0) return hits
  } catch {
    // fallback below
  }

  const jinaText = await fetchViaJina(searchUrl, 7000)
  const fallbackHits = parseJinaHits(jinaText, 'https://www.amazon.co.jp', 'JPY')
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

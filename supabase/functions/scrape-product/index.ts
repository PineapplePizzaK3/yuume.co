// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ScrapeSource = 'adapter' | 'meta' | 'jsonld' | 'page' | 'jina' | 'headless'
type ScrapeFailureCode =
  | 'invalid_request'
  | 'network'
  | 'http_error'
  | 'parse_error'
  | 'not_found'

type ExtractResult = {
  name?: string
  price?: number
  currency?: string
  imageUrl?: string
  imageUrls?: string[]
}

type ScrapePayload = {
  name: string
  price: number | null
  currency: string
  imageUrl: string | null
  imageUrls: string[]
  confidence: number
  source: ScrapeSource
  warnings: string[]
  diagnostics: {
    host: string
    layersTried: string[]
    lowConfidence: boolean
    requiresReview: boolean
    usedHeadlessFallback: boolean
  }
}

type AdapterResult = ExtractResult & { adapterName: string }

const SCRAPE_TIMEOUT_MS = 12000
const JINA_TIMEOUT_MS = 9000
const LOW_CONFIDENCE_THRESHOLD = 0.66
const HEADLESS_ENABLED = String(Deno.env.get('SCRAPE_ENABLE_HEADLESS') || '').toLowerCase() === 'true'
  || Deno.env.get('SCRAPE_ENABLE_HEADLESS') === '1'
const HEADLESS_ENDPOINT = String(Deno.env.get('SCRAPE_HEADLESS_ENDPOINT') || '').trim()

function jsonResponse(obj: object, status = 200) {
  return new Response(JSON.stringify(obj), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function safeReturn(obj: object) {
  try {
    return jsonResponse(obj)
  } catch {
    return new Response(JSON.stringify(obj), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
}

function parsePrice(value: unknown): number | undefined {
  if (value == null) return undefined
  let text = String(value).trim()
  if (!text) return undefined
  text = text.replace(/[^\d.,-]/g, '')
  if (!text) return undefined
  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? '.' : ','
    const thousandsSep = decimalSep === '.' ? ',' : '.'
    text = text.replace(new RegExp(`\\${thousandsSep}`, 'g'), '')
    if (decimalSep === ',') text = text.replace(/,/g, '.')
  } else if (lastComma !== -1) {
    const parts = text.split(',')
    const tail = parts[parts.length - 1] ?? ''
    text = tail.length <= 2 ? `${parts.slice(0, -1).join('')}.${tail}` : parts.join('')
  } else if (lastDot !== -1) {
    const parts = text.split('.')
    const tail = parts[parts.length - 1] ?? ''
    if (tail.length > 2) text = parts.join('')
  }
  const parsed = Number(text)
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1e9 ? parsed : undefined
}

function decodeJsEscaped(input: string): string {
  return String(input || '')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
}

function normalizeImageCandidate(url: string | undefined, pageUrl: URL): string | undefined {
  if (!url) return undefined
  const clean = decodeJsEscaped(String(url).trim())
  if (!clean) return undefined
  try {
    return new URL(clean, pageUrl.origin).toString()
  } catch {
    return undefined
  }
}

function isBadImageUrl(url: string | undefined): boolean {
  if (!url) return true
  const u = url.toLowerCase()
  if (u.startsWith('data:')) return true
  if (u.includes('transparent') || u.includes('spacer') || u.includes('pixel')) return true
  if (u.includes('sprite') || u.includes('icon') || u.includes('placeholder') || u.includes('loading')) return true
  if (u.includes('/logo') || u.includes('shopify-bag') || u.includes('payment-icon')) return true
  if (u.includes('nav-logo') || u.includes('amazon-logo') || u.includes('amazon-ui')) return true
  if (u.endsWith('.svg')) return true
  return false
}

function scoreImageCandidates(candidates: string[], pageUrl: URL): Array<{ url: string; score: number }> {
  const uniq = Array.from(new Set(candidates.map((c) => normalizeImageCandidate(c, pageUrl)).filter(Boolean) as string[]))
  return uniq
    .filter((u) => !isBadImageUrl(u))
    .map((url) => {
      let score = 0
      const lower = url.toLowerCase()
      if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower)) score += 2
      if (/(_sl\d+_|_ac_sl\d+_)/i.test(lower)) score += 3
      if (/(images-na\.ssl-images-amazon|m\.media-amazon|rakuma|fril|mercari|yimg)/i.test(lower)) score += 2
      if (/(cdn\.shopify\.com|\/cdn\/shop\/files\/|\/products\/)/i.test(lower)) score += 3
      if (/(\/files\/|\/products\/)/i.test(lower)) score += 1
      if (/(small|thumb|thumbnail)/i.test(lower)) score -= 2
      return { url, score }
    })
    .sort((a, b) => b.score - a.score)
}

function pickBestImageUrl(candidates: string[], pageUrl: URL): string | undefined {
  return scoreImageCandidates(candidates, pageUrl)[0]?.url
}

function pickTopImageUrls(candidates: string[], pageUrl: URL, limit = 8): string[] {
  return scoreImageCandidates(candidates, pageUrl)
    .slice(0, Math.max(1, limit))
    .map((x) => x.url)
}

function parseShopifyPrice(value: unknown): number | undefined {
  if (value == null) return undefined
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return undefined
    if (Number.isInteger(value) && value >= 10000) {
      const maybeCents = value / 100
      if (Number.isFinite(maybeCents) && maybeCents > 0) return maybeCents
    }
    return value
  }
  const raw = String(value).trim()
  if (!raw) return undefined
  const parsed = parsePrice(raw)
  if (parsed == null) return undefined
  if (/^\d+$/.test(raw) && parsed >= 10000) {
    const maybeCents = parsed / 100
    if (Number.isFinite(maybeCents) && maybeCents > 0) return maybeCents
  }
  return parsed
}

function collectImageFieldsFromObject(input: unknown, out: string[] = []): string[] {
  if (input == null) return out
  if (typeof input === 'string') {
    out.push(input)
    return out
  }
  if (Array.isArray(input)) {
    for (const item of input) collectImageFieldsFromObject(item, out)
    return out
  }
  if (typeof input !== 'object') return out
  const obj = input as Record<string, unknown>
  const direct = ['src', 'url', 'image', 'featured_image', 'originalSrc', 'preview_image', 'featuredImage']
  for (const key of direct) {
    const value = obj[key]
    if (typeof value === 'string') out.push(value)
    else if (value && typeof value === 'object') collectImageFieldsFromObject(value, out)
  }
  return out
}

function findShopifyProductNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  const current = node as Record<string, unknown>
  const hasProductShape = typeof current['title'] === 'string'
    && (
      Array.isArray(current['variants'])
      || Array.isArray(current['images'])
      || Array.isArray(current['media'])
      || typeof current['featured_image'] === 'string'
      || typeof current['featured_media'] === 'object'
    )
  if (hasProductShape) return current
  if (current['product'] && typeof current['product'] === 'object') {
    const nested = findShopifyProductNode(current['product'])
    if (nested) return nested
  }
  for (const value of Object.values(current)) {
    if (value && typeof value === 'object') {
      const found = findShopifyProductNode(value)
      if (found) return found
    }
  }
  return null
}

function normalizeCurrency(currency: string | undefined, sampleText?: string): string {
  const raw = String(currency || '').trim().toUpperCase()
  if (raw === 'JPY' || raw === 'BRL' || raw === 'USD') return raw
  const t = String(sampleText || '')
  if (/R\$|BRL/i.test(t)) return 'BRL'
  if (/\$|USD/i.test(t)) return 'USD'
  return 'JPY'
}

function normalizeProductName(input: string | undefined, pageUrl: URL): string {
  const raw = String(input || '').replace(/\s+/g, ' ').trim()
  if (!raw) return 'Produto'
  const host = pageUrl.hostname.toLowerCase()
  let name = raw
  if (host.includes('amazon.')) {
    name = name.replace(/^amazon\.[^:]+:\s*/i, '')
    name = name.replace(/\s*[:|\-|｜]\s*amazon\.[^\s]+.*$/i, '')
  }
  if (host.includes('mercari.')) {
    name = name.replace(/\s*[:|\-|｜]\s*mercari.*$/i, '')
  }
  name = name
    .replace(/\s*[:|\-|｜]\s*(Amazon|Mercari|Rakuten|Yahoo!?\s*ショッピング|Yahoo!? Shopping).*$/i, '')
    .trim()
  return name.length >= 3 ? name : raw
}

function extractFromMeta(html: string): ExtractResult {
  const result: ExtractResult = {}
  const metaOgTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
  const metaTwitterTitle = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i)
  const metaTitle = html.match(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i)
  result.name = String(metaOgTitle?.[1] || metaTwitterTitle?.[1] || metaTitle?.[1] || '').trim() || undefined

  const metaOgImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  const metaTwitterImage = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
  const itempropImage = html.match(/<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i)
  const ogAll = Array.from(html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)).map((m) => m[1])
  const twAll = Array.from(html.matchAll(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi)).map((m) => m[1])
  const metaImageList = [...new Set([metaOgImage?.[1], metaTwitterImage?.[1], itempropImage?.[1], ...ogAll, ...twAll].filter(Boolean) as string[])]
  result.imageUrl = String(metaImageList[0] || '').trim() || undefined
  result.imageUrls = metaImageList

  const metaPrice = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']product:price:amount["']/i)
  result.price = parsePrice(metaPrice?.[1])
  const metaCurrency = html.match(/<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']product:price:currency["']/i)
  result.currency = normalizeCurrency(metaCurrency?.[1], metaPrice?.[1])
  return result
}

function isProductType(value: unknown): boolean {
  if (typeof value === 'string') return value.toLowerCase().includes('product')
  if (Array.isArray(value)) return value.some((v) => typeof v === 'string' && v.toLowerCase().includes('product'))
  return false
}

function findProductNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  const current = node as Record<string, unknown>
  if (isProductType(current['@type'])) return current
  const graph = current['@graph']
  if (Array.isArray(graph)) {
    for (const item of graph) {
      const found = findProductNode(item)
      if (found) return found
    }
  }
  for (const value of Object.values(current)) {
    if (value && typeof value === 'object') {
      const found = findProductNode(value)
      if (found) return found
    }
  }
  return null
}

function extractFromJsonLd(html: string): ExtractResult {
  const scriptMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of scriptMatches) {
    const raw = m[1]?.trim()
    if (!raw) continue
    const candidates = [raw, raw.replace(/^\uFEFF/, ''), raw.replace(/<!--|-->/g, '')]
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate)
        const rootNodes = Array.isArray(parsed) ? parsed : [parsed]
        for (const root of rootNodes) {
          const product = findProductNode(root)
          if (!product) continue
          const name = (product['name'] as string) || (product['description'] as string)
          const offers = product['offers']
          const image = product['image']
          let imageUrl: string | undefined
          let imageUrls: string[] | undefined
          if (typeof image === 'string') imageUrl = image
          else if (Array.isArray(image)) {
            imageUrls = image.filter((v) => typeof v === 'string') as string[]
            imageUrl = imageUrls[0]
          }
          else if (image && typeof image === 'object' && typeof (image as Record<string, unknown>)['url'] === 'string') {
            imageUrl = (image as Record<string, unknown>)['url'] as string
            imageUrls = [imageUrl]
          }
          let price: number | undefined
          let currency = 'JPY'
          const offerObj = Array.isArray(offers) ? offers[0] : offers
          if (offerObj && typeof offerObj === 'object') {
            const o = offerObj as Record<string, unknown>
            price = parsePrice(o['price'] ?? o['lowPrice'] ?? o['highPrice'])
            currency = normalizeCurrency(typeof o['priceCurrency'] === 'string' ? o['priceCurrency'] : undefined)
          }
          return { name, price, currency, imageUrl, imageUrls }
        }
      } catch {
        // try next candidate
      }
    }
  }
  return {}
}

function extractFromPage(html: string): ExtractResult {
  const result: ExtractResult = {}
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) result.name = titleMatch[1].trim()
  const pricePatterns = [
    /(?:¥|R\$\s*|US\$\s*|USD\s*|JPY\s*|BRL\s*)?([\d.,]+)\s*(?:円|yen)?/gi,
    /["']price["']\s*:\s*["']?([\d.,]+)/gi,
    /["']priceAmount["']\s*:\s*["']?([\d.,]+)/gi,
    /["']priceToPay["']\s*:\s*\{[\s\S]{0,120}?["']amount["']\s*:\s*["']?([\d.,]+)/gi,
    /class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([\d.,]+)/gi,
    /itemprop=["']price["'][^>]*content=["']([^"']+)["']/gi,
    /data-price=["']([^"']+)["']/gi,
  ]
  for (const re of pricePatterns) {
    const m = re.exec(html)
    if (m) {
      const p = parsePrice(m[1])
      if (p != null) {
        result.price = p
        result.currency = normalizeCurrency(undefined, m[0])
        break
      }
    }
  }
  return result
}

function adapterAmazon(html: string, pageUrl: URL): AdapterResult | null {
  if (!pageUrl.hostname.toLowerCase().includes('amazon.')) return null
  const priceRaw =
    html.match(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*([^<]+)\s*<\/span>/i)?.[1] ||
    html.match(/["']price["']\s*:\s*["']?([\d.,]+)/i)?.[1] ||
    html.match(/["']priceAmount["']\s*:\s*["']?([\d.,]+)/i)?.[1]
  const imageCandidates = [
    html.match(/"landingImageUrl"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"hiRes"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"large"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/data-old-hires=["']([^"']+)["']/i)?.[1],
    ...Array.from(html.matchAll(/https?:\/\/[^"'\s)]+\/images\/I\/[^"'\s)]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s)]*)?/gi)).map((m) => m[0]),
  ].filter(Boolean) as string[]
  const imageUrls = pickTopImageUrls(imageCandidates, pageUrl, 10)
  return {
    adapterName: 'amazon',
    price: parsePrice(priceRaw),
    currency: normalizeCurrency(undefined, priceRaw),
    imageUrl: imageUrls[0] || pickBestImageUrl(imageCandidates, pageUrl),
    imageUrls,
  }
}

function adapterMercari(html: string, pageUrl: URL): AdapterResult | null {
  const host = pageUrl.hostname.toLowerCase()
  if (!(host.includes('mercari.') || host.includes('jp.mercari.com'))) return null
  const priceRaw =
    html.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[0] ||
    html.match(/["']price["']\s*:\s*["']?([\d.,]+)/i)?.[1]
  const imageCandidates = [
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/"photo"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"thumbnailUrl"\s*:\s*"([^"]+)"/i)?.[1],
  ].filter(Boolean) as string[]
  const imageUrls = pickTopImageUrls(imageCandidates, pageUrl, 10)
  return {
    adapterName: 'mercari',
    price: parsePrice(priceRaw),
    currency: normalizeCurrency(undefined, priceRaw),
    imageUrl: imageUrls[0] || pickBestImageUrl(imageCandidates, pageUrl),
    imageUrls,
  }
}

function adapterRakuma(html: string, pageUrl: URL): AdapterResult | null {
  const host = pageUrl.hostname.toLowerCase()
  if (!(host.includes('rakuma.') || host.includes('fril.jp'))) return null
  const priceRaw =
    html.match(/(?:¥|￥)\s*([\d,]+(?:\.\d+)?)/i)?.[0] ||
    html.match(/["']price["']\s*:\s*["']?([\d.,]+)/i)?.[1]
  const imageCandidates = [
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/"image(?:Url)?"\s*:\s*"([^"]+)"/i)?.[1],
  ].filter(Boolean) as string[]
  const imageUrls = pickTopImageUrls(imageCandidates, pageUrl, 10)
  return {
    adapterName: 'rakuma',
    price: parsePrice(priceRaw),
    currency: normalizeCurrency(undefined, priceRaw),
    imageUrl: imageUrls[0] || pickBestImageUrl(imageCandidates, pageUrl),
    imageUrls,
  }
}

function adapterYahooShopping(html: string, pageUrl: URL): AdapterResult | null {
  const host = pageUrl.hostname.toLowerCase()
  if (!(host.includes('shopping.yahoo') || host.includes('store.shopping.yahoo'))) return null
  const priceRaw =
    html.match(/"price"\s*:\s*"([^"]+)"/i)?.[1] ||
    html.match(/(?:¥|￥)\s*([\d,]+)/i)?.[0]
  const imageCandidates = [
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/"thumbnailUrl"\s*:\s*"([^"]+)"/i)?.[1],
  ].filter(Boolean) as string[]
  const imageUrls = pickTopImageUrls(imageCandidates, pageUrl, 10)
  return {
    adapterName: 'yahoo',
    price: parsePrice(priceRaw),
    currency: normalizeCurrency(undefined, priceRaw),
    imageUrl: imageUrls[0] || pickBestImageUrl(imageCandidates, pageUrl),
    imageUrls,
  }
}

function getProductHints(pageUrl: URL): { slug: string; codes: string[]; words: string[] } {
  const path = String(pageUrl.pathname || '').toLowerCase()
  const slug = path.split('/').filter(Boolean).pop() || ''
  const codes = Array.from(slug.matchAll(/(\d{5,})/g)).map((m) => m[1])
  const words = slug
    .split(/[^a-z0-9]+/g)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4)
  return { slug, codes, words }
}

function scorePriceContext(context: string): number {
  const c = String(context || '').toLowerCase()
  let score = 0
  if (/(通常価格|セール価格|販売価格|price|preço|税込み|単価)/i.test(c)) score += 6
  if (/(cart|カートに入れる|購入手続き|商品コード|sku|在庫)/i.test(c)) score += 2
  if (/(以上|送料無料|送料|ノベルティ|特典|プレゼント)/i.test(c)) score -= 7
  if (/(faq|お問い合わせ|ガイド|site info|利用規約)/i.test(c)) score -= 3
  return score
}

function parsePriceNearProductCode(text: string, pageUrl: URL): number | undefined {
  const content = String(text || '')
  const hints = getProductHints(pageUrl)
  for (const code of hints.codes) {
    const codeBlock = new RegExp(`(?:SKU\\s*[:：]?\\s*${code}|商品コード[^\\n]{0,40}${code})[\\s\\S]{0,260}?([\\d][\\d,.]*)\\s*円`, 'i')
    const codeBefore = content.match(codeBlock)
    if (codeBefore?.[1]) {
      const parsed = parsePrice(codeBefore[1])
      if (parsed != null) return parsed
    }
    const priceBefore = new RegExp(`([\\d][\\d,.]*)\\s*円[\\s\\S]{0,220}(?:SKU\\s*[:：]?\\s*${code}|商品コード[^\\n]{0,40}${code})`, 'i')
    const codeAfter = content.match(priceBefore)
    if (codeAfter?.[1]) {
      const parsed = parsePrice(codeAfter[1])
      if (parsed != null) return parsed
    }
  }
  return undefined
}

function pickBestTextPrice(text: string, pageUrl: URL): { price: number; currency: string } | null {
  const content = String(text || '')
  const hints = getProductHints(pageUrl)
  const directPrice = parsePriceNearProductCode(content, pageUrl)
  if (directPrice != null) return { price: directPrice, currency: 'JPY' }
  const regex = /(?:¥|￥)?\s*([\d][\d,.]*)\s*円|(?:¥|JPY)\s*([\d,]+(?:\.\d+)?)|(?:R\$|BRL)\s*([\d.,]+)|(?:price|preço)\s*[:：]?\s*([\d.,]+)/gi
  const candidates: Array<{ price: number; currency: string; score: number; index: number }> = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1] || match[2] || match[3] || match[4]
    const parsed = parsePrice(raw)
    if (parsed == null) continue
    const start = Math.max(0, match.index - 110)
    const end = Math.min(content.length, match.index + 110)
    const context = content.slice(start, end)
    let score = scorePriceContext(context)
    if (context.toLowerCase().includes(pageUrl.pathname.toLowerCase())) score += 8
    if (hints.codes.some((code) => context.includes(code))) score += 4
    if (/\/products\/n-\d+-\d{5,}/i.test(context)) {
      const otherCodes = Array.from(context.matchAll(/\/products\/n-\d+-(\d{5,})/gi)).map((m) => m[1])
      if (otherCodes.some((code) => !hints.codes.includes(code))) score -= 8
    }
    if (parsed > 0 && parsed <= 20000) score += 1
    if (parsed >= 50000) score -= 2
    candidates.push({
      price: parsed,
      currency: /R\$|BRL/i.test(match[0] || '') ? 'BRL' : 'JPY',
      score,
      index: match.index,
    })
  }
  candidates.sort((a, b) => b.score - a.score || a.index - b.index)
  return candidates[0] ? { price: candidates[0].price, currency: candidates[0].currency } : null
}

function pickTextImages(text: string, pageUrl: URL, limit = 10): string[] {
  const content = String(text || '')
  const hints = getProductHints(pageUrl)
  const markdownMatches = Array.from(content.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi)).map((m) => ({
    alt: m[1] || '',
    url: m[2],
    index: m.index || 0,
  }))
  const rawImageMatches = Array.from(content.matchAll(/https?:\/\/[^\s)"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s)"']*)?/gi)).map((m) => ({
    alt: '',
    url: m[0],
    index: m.index || 0,
  }))
  const deduped: Array<{ alt: string; url: string; index: number }> = []
  const seen = new Set<string>()
  const keyOf = (input: string) => {
    try {
      const parsed = new URL(input)
      parsed.searchParams.delete('width')
      parsed.searchParams.delete('height')
      return `${parsed.origin}${parsed.pathname}`
    } catch {
      return input
    }
  }
  for (const entry of [...markdownMatches, ...rawImageMatches]) {
    if (!entry.url) continue
    const key = keyOf(entry.url)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(entry)
  }

  return deduped
    .map((entry) => {
      const lower = entry.url.toLowerCase()
      const start = Math.max(0, entry.index - 120)
      const end = Math.min(content.length, entry.index + 120)
      const context = content.slice(start, end)
      let score = 0
      if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower)) score += 3
      if (/(cdn\.shopify\.com|\/cdn\/shop\/files\/|\/products\/)/i.test(lower)) score += 3
      if (/(menuimage|footer|banner|popup|totop|icon-|icon_|logo)/i.test(lower)) score -= 8
      if (/(small|thumb|thumbnail|sprite|icon|logo|placeholder|captcha|spinner|loading)/i.test(lower)) score -= 4
      if (/モーダルでメディア|media \(\d+\)|商品情報|商品コード|sku/i.test(context)) score += 6
      if (hints.codes.some((code) => lower.includes(code) || context.includes(code))) score += 6
      if (hints.words.some((w) => context.toLowerCase().includes(w) || lower.includes(w))) score += 2
      return { url: entry.url, score }
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
    .map((x) => x.url)
}

function adapterShopify(html: string, pageUrl: URL): AdapterResult | null {
  const lowerHtml = html.toLowerCase()
  if (!/(shopify|cdn\.shopify\.com|shopify-section)/i.test(lowerHtml)) return null

  const scriptMatches = html.matchAll(/<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of scriptMatches) {
    const raw = match[1]?.trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      const product = findShopifyProductNode(parsed)
      if (!product) continue
      const variants = Array.isArray(product['variants']) ? product['variants'] : []
      const firstVariant = variants.find((v) => v && typeof v === 'object') as Record<string, unknown> | undefined
      const priceRaw = firstVariant?.['price'] ?? product['price'] ?? product['price_min']
      const imageCandidates = [
        ...collectImageFieldsFromObject(product['featured_image']),
        ...collectImageFieldsFromObject(product['featured_media']),
        ...collectImageFieldsFromObject(product['images']),
        ...collectImageFieldsFromObject(product['media']),
      ]
      const imageUrls = pickTopImageUrls(imageCandidates, pageUrl, 10)
      const name = typeof product['title'] === 'string' ? product['title'] : undefined
      return {
        adapterName: 'shopify',
        name,
        price: parseShopifyPrice(priceRaw),
        currency: normalizeCurrency(undefined, html),
        imageUrl: imageUrls[0],
        imageUrls,
      }
    } catch {
      // try next script
    }
  }

  return null
}

function extractFromText(text: string, pageUrl: URL): ExtractResult {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  let name: string | undefined = text.match(/(?:^|\n)Title:\s*(.+)/i)?.[1]?.trim()
  const skipLine = /^(URL Source|Markdown Content|Warning|http[s]?:\/\/)/i
  if (!name) {
    for (const line of lines) {
      if (skipLine.test(line)) continue
      if (line.length >= 6 && line.length <= 180) {
        name = line.replace(/^#{1,6}\s*/, '').trim()
        if (name) break
      }
    }
  }
  const imageUrls = pickTextImages(text, pageUrl, 10)
  const imageUrl = imageUrls[0]
  const bestPrice = pickBestTextPrice(text, pageUrl)
  if (bestPrice) return { name, price: bestPrice.price, currency: bestPrice.currency, imageUrl, imageUrls }
  return { name, imageUrl, imageUrls }
}

async function extractViaJina(pageUrl: URL): Promise<ExtractResult> {
  const jinaUrl = `https://r.jina.ai/http://${pageUrl.hostname}${pageUrl.pathname}${pageUrl.search}`
  const jinaRes = await fetch(jinaUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EikoDelivery/1.0; +https://eiko-dls.com)',
      'Accept': 'text/plain,text/markdown,*/*',
    },
    signal: AbortSignal.timeout(JINA_TIMEOUT_MS),
  })
  if (!jinaRes.ok) return {}
  const text = await jinaRes.text()
  return extractFromText(text, pageUrl)
}

async function extractViaHeadless(pageUrl: URL): Promise<ExtractResult> {
  if (!HEADLESS_ENABLED || !HEADLESS_ENDPOINT) return {}
  try {
    const res = await fetch(HEADLESS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: pageUrl.toString() }),
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    })
    if (!res.ok) return {}
    const data = await res.json().catch(() => null)
    if (!data || typeof data !== 'object') return {}
    const result = data as Record<string, unknown>
    return {
      name: typeof result.name === 'string' ? result.name : undefined,
      price: parsePrice(result.price),
      currency: normalizeCurrency(typeof result.currency === 'string' ? result.currency : undefined),
      imageUrl: typeof result.imageUrl === 'string' ? result.imageUrl : undefined,
      imageUrls: Array.isArray(result.imageUrls)
        ? (result.imageUrls.filter((x) => typeof x === 'string') as string[])
        : (typeof result.imageUrl === 'string' ? [result.imageUrl] : undefined),
    }
  } catch {
    return {}
  }
}

function scoreConfidence(result: ScrapePayload): number {
  let score = 0.15
  if (result.name && result.name !== 'Produto') score += 0.30
  if (result.price != null && result.price > 0) score += 0.35
  if (result.imageUrl) score += 0.15
  if (result.source === 'adapter') score += 0.05
  if (result.source === 'headless') score += 0.05
  return Math.min(1, Number(score.toFixed(2)))
}

function mergePreferred(base: ExtractResult, incoming: ExtractResult): ExtractResult {
  const mergedImageUrls = [
    ...(Array.isArray(base.imageUrls) ? base.imageUrls : []),
    ...(base.imageUrl ? [base.imageUrl] : []),
    ...(Array.isArray(incoming.imageUrls) ? incoming.imageUrls : []),
    ...(incoming.imageUrl ? [incoming.imageUrl] : []),
  ]
  return {
    name: base.name || incoming.name,
    price: base.price ?? incoming.price,
    currency: base.currency || incoming.currency,
    imageUrl: base.imageUrl || incoming.imageUrl,
    imageUrls: mergedImageUrls.length ? Array.from(new Set(mergedImageUrls)) : undefined,
  }
}

function mapFailure(errorMessage: string): ScrapeFailureCode {
  const msg = String(errorMessage || '').toLowerCase()
  if (msg.includes('url') || msg.includes('requisição') || msg.includes('request')) return 'invalid_request'
  if (msg.includes('retornou erro') || msg.includes('http')) return 'http_error'
  if (msg.includes('acessar') || msg.includes('responder') || msg.includes('timeout')) return 'network'
  return 'parse_error'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return safeReturn({ error: 'Method not allowed', error_code: 'invalid_request' })

  try {
    let body: { url?: string }
    try {
      body = await req.json()
    } catch {
      return safeReturn({ error: 'Corpo da requisição inválido', error_code: 'invalid_request' })
    }
    const url = body?.url
    if (!url || typeof url !== 'string') return safeReturn({ error: 'URL obrigatória', error_code: 'invalid_request' })

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return safeReturn({ error: 'URL inválida', error_code: 'invalid_request' })
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return safeReturn({ error: 'URL inválida', error_code: 'invalid_request' })

    let html = ''
    let responseStatus = 0
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EikoDelivery/1.0; +https://eiko-dls.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8,pt-BR;q=0.7',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      })
      responseStatus = res.status
      if (!res.ok) return safeReturn({ error: `O site retornou erro (${res.status}). Tente outro link.`, error_code: 'http_error' })
      html = await res.text()
    } catch (err) {
      const msg = err instanceof Error && err.name === 'AbortError'
        ? 'O site demorou para responder. Tente outro link.'
        : 'Não foi possível acessar a URL.'
      return safeReturn({ error: msg, error_code: 'network' })
    }

    const layersTried: string[] = []
    const warnings: string[] = []

    const adapterFns = [adapterShopify, adapterAmazon, adapterMercari, adapterRakuma, adapterYahooShopping]
    let adapterData: AdapterResult | null = null
    for (const fn of adapterFns) {
      const data = fn(html, parsed)
      if (data) {
        adapterData = data
        layersTried.push(`adapter:${data.adapterName}`)
        break
      }
    }
    if (!adapterData) layersTried.push('adapter:none')

    const meta = extractFromMeta(html)
    layersTried.push('meta')
    const jsonLd = extractFromJsonLd(html)
    layersTried.push('jsonld')
    const page = extractFromPage(html)
    layersTried.push('page')

    const imageCandidates = [
      adapterData?.imageUrl,
      meta.imageUrl,
      jsonLd.imageUrl,
      ...(meta.imageUrls || []),
      ...(jsonLd.imageUrls || []),
      ...Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)).map((m) => m[1]),
    ].filter(Boolean) as string[]

    let merged: ExtractResult = {}
    if (adapterData) merged = mergePreferred(merged, adapterData)
    merged = mergePreferred(merged, meta)
    merged = mergePreferred(merged, jsonLd)
    merged = mergePreferred(merged, page)

    const normalizedName = normalizeProductName(merged.name, parsed)
    const normalizedPrice = merged.price ?? null
    const normalizedCurrency = normalizeCurrency(merged.currency, html)
    const normalizedImages = pickTopImageUrls([
      ...imageCandidates,
      ...(merged.imageUrls || []),
      ...(merged.imageUrl ? [merged.imageUrl] : []),
    ], parsed, 10)
    const normalizedImage = normalizedImages[0] || null

    let payload: ScrapePayload = {
      name: normalizedName,
      price: normalizedPrice,
      currency: normalizedCurrency,
      imageUrl: normalizedImage,
      imageUrls: normalizedImages,
      source: adapterData ? 'adapter' : (jsonLd.name || jsonLd.price || jsonLd.imageUrl ? 'jsonld' : (meta.name || meta.price || meta.imageUrl ? 'meta' : 'page')),
      confidence: 0,
      warnings,
      diagnostics: {
        host: parsed.hostname,
        layersTried,
        lowConfidence: false,
        requiresReview: false,
        usedHeadlessFallback: false,
      },
    }

    if (!payload.price) warnings.push('Preço não encontrado automaticamente')
    if (!payload.imageUrl) warnings.push('Imagem não encontrada automaticamente')
    if (payload.name === 'Produto') warnings.push('Nome genérico; revisar antes de salvar')
    if (payload.currency === 'JPY' && /R\$|BRL|USD|\$/i.test(html)) warnings.push('Moeda inferida automaticamente')

    payload.confidence = scoreConfidence(payload)
    payload.diagnostics.lowConfidence = payload.confidence < LOW_CONFIDENCE_THRESHOLD
    payload.diagnostics.requiresReview = payload.diagnostics.lowConfidence || warnings.length > 0

    if (payload.diagnostics.lowConfidence) {
      try {
        const jinaData = await extractViaJina(parsed)
        layersTried.push('jina')
        const afterJina = mergePreferred({
          name: payload.name === 'Produto' ? undefined : payload.name,
          price: payload.price ?? undefined,
          currency: payload.currency,
          imageUrl: payload.imageUrl ?? undefined,
        }, jinaData)
        payload.name = normalizeProductName(afterJina.name, parsed)
        payload.price = afterJina.price ?? null
        payload.currency = normalizeCurrency(afterJina.currency, jinaData.currency)
        payload.imageUrls = pickTopImageUrls([
          ...(payload.imageUrls || []),
          ...(afterJina.imageUrls || []),
          ...(afterJina.imageUrl ? [afterJina.imageUrl] : []),
        ], parsed, 10)
        payload.imageUrl = payload.imageUrls[0] || payload.imageUrl
        const jinaAddedName = payload.name === 'Produto' && !!afterJina.name
        const jinaAddedPrice = payload.price == null && afterJina.price != null
        const jinaAddedImage = !payload.imageUrl && ((afterJina.imageUrls?.length || 0) > 0 || !!afterJina.imageUrl)
        if (jinaAddedName || jinaAddedPrice || jinaAddedImage) {
          payload.source = 'jina'
        }
      } catch {
        warnings.push('Fallback textual indisponível para este link')
      }
    }

    payload.confidence = scoreConfidence(payload)
    payload.diagnostics.lowConfidence = payload.confidence < LOW_CONFIDENCE_THRESHOLD
    payload.diagnostics.requiresReview = payload.diagnostics.lowConfidence || warnings.length > 0

    if (payload.diagnostics.lowConfidence) {
      if (HEADLESS_ENABLED && HEADLESS_ENDPOINT) {
        const headlessData = await extractViaHeadless(parsed)
        layersTried.push('headless')
        if (headlessData.name || headlessData.price || headlessData.imageUrl) {
          const afterHeadless = mergePreferred({
            name: payload.name === 'Produto' ? undefined : payload.name,
            price: payload.price ?? undefined,
            currency: payload.currency,
            imageUrl: payload.imageUrl ?? undefined,
          }, headlessData)
          payload.name = normalizeProductName(afterHeadless.name, parsed)
          payload.price = afterHeadless.price ?? null
          payload.currency = normalizeCurrency(afterHeadless.currency)
          payload.imageUrls = pickTopImageUrls([
            ...(payload.imageUrls || []),
            ...(afterHeadless.imageUrls || []),
            ...(afterHeadless.imageUrl ? [afterHeadless.imageUrl] : []),
          ], parsed, 10)
          payload.imageUrl = payload.imageUrls[0] || payload.imageUrl
          payload.source = 'headless'
          payload.diagnostics.usedHeadlessFallback = true
        } else {
          warnings.push('Headless habilitado, mas sem dados úteis para este domínio')
        }
      } else {
        warnings.push('Fallback headless desabilitado; para páginas com JS pesado, configure SCRAPE_ENABLE_HEADLESS=1')
      }
    }

    payload.confidence = scoreConfidence(payload)
    payload.diagnostics.lowConfidence = payload.confidence < LOW_CONFIDENCE_THRESHOLD
    payload.diagnostics.requiresReview = payload.diagnostics.lowConfidence || warnings.length > 0

    if (payload.name === 'Produto' && payload.price == null) {
      return safeReturn({
        error: 'Não foi possível extrair dados desse link automaticamente.',
        error_code: 'not_found',
        diagnostics: {
          host: parsed.hostname,
          layersTried,
          http_status: responseStatus,
        },
      })
    }

    return safeReturn(payload)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado'
    return safeReturn({ error: msg, error_code: mapFailure(msg) })
  }
})

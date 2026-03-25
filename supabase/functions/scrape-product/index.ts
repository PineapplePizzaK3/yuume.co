// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Edge Function: scrape-product
 * Extrai nome e preço de uma URL de produto.
 * Substitua o conteúdo do seu index.ts no Dashboard por este código.
 * Importante: a função precisa se chamar "scrape-product" no Supabase.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parsePrice(value: unknown): number | undefined {
  if (value == null) return undefined
  let text = String(value).trim()
  if (!text) return undefined

  // Keep only digits and separators for robust parsing across locales.
  text = text.replace(/[^\d.,-]/g, '')
  if (!text) return undefined

  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')

  // If both separators exist, assume the last one is decimal separator.
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? '.' : ','
    const thousandsSep = decimalSep === '.' ? ',' : '.'
    text = text.replace(new RegExp(`\\${thousandsSep}`, 'g'), '')
    if (decimalSep === ',') text = text.replace(/,/g, '.')
  } else if (lastComma !== -1) {
    // Only comma exists: comma as decimal when 1-2 digits at end, else thousands.
    const parts = text.split(',')
    const tail = parts[parts.length - 1] ?? ''
    if (tail.length <= 2) {
      text = parts.slice(0, -1).join('') + '.' + tail
    } else {
      text = parts.join('')
    }
  } else if (lastDot !== -1) {
    // Only dot exists: dot as decimal when 1-2 digits at end, else thousands.
    const parts = text.split('.')
    const tail = parts[parts.length - 1] ?? ''
    if (tail.length > 2) {
      text = parts.join('')
    }
  }

  const parsed = parseFloat(text)
  if (!isFinite(parsed) || parsed <= 0 || parsed >= 1e9) return undefined
  return parsed
}

function extractFromMeta(html: string): { name?: string; price?: number; currency?: string; imageUrl?: string } {
  const result: { name?: string; price?: number; currency?: string; imageUrl?: string } = {}
  try {
    const metaOgTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
    const metaTwitterTitle = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i)
    const metaTitle = html.match(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i)
    if (metaOgTitle?.[1] || metaTwitterTitle?.[1] || metaTitle?.[1]) {
      result.name = String(metaOgTitle?.[1] || metaTwitterTitle?.[1] || metaTitle?.[1]).trim()
    }
  } catch { /* ignore */ }

  try {
    const metaOgImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    const metaTwitterImage = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
    const itempropImage = html.match(/<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i)
    if (metaOgImage?.[1] || metaTwitterImage?.[1] || itempropImage?.[1]) {
      result.imageUrl = String(metaOgImage?.[1] || metaTwitterImage?.[1] || itempropImage?.[1]).trim()
    }
  } catch { /* ignore */ }
  try {
    const metaPrice = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']product:price:amount["']/i)
    if (metaPrice?.[1]) result.price = parsePrice(metaPrice[1])
  } catch { /* ignore */ }
  try {
    const metaCurrency = html.match(/<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']product:price:currency["']/i)
    if (metaCurrency?.[1]) result.currency = String(metaCurrency[1])
  } catch { /* ignore */ }
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

function extractFromJsonLd(html: string): { name?: string; price?: number; currency?: string; imageUrl?: string } | null {
  const scriptMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of scriptMatches) {
    const raw = m[1]?.trim()
    if (!raw) continue
    const candidates = [
      raw,
      raw.replace(/^\uFEFF/, ''), // remove BOM
      raw.replace(/<!--|-->/g, ''), // some pages wrap JSON-LD in HTML comments
    ]
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate)
        const rootNodes = Array.isArray(parsed) ? parsed : [parsed]
        for (const root of rootNodes) {
          const product = findProductNode(root)
          if (!product) continue
          const name = (product['name'] as string) || (product['description'] as string)
          let price: number | undefined
          let currency = 'JPY'
          let imageUrl: string | undefined
          const offers = product['offers']
          const image = product['image']
          if (typeof image === 'string') imageUrl = image
          else if (Array.isArray(image)) imageUrl = typeof image[0] === 'string' ? image[0] : undefined
          else if (image && typeof image === 'object') {
            const imgObj = image as Record<string, unknown>
            if (typeof imgObj['url'] === 'string') imageUrl = imgObj['url']
          }
          if (offers) {
            const offerObj = Array.isArray(offers) ? offers[0] : offers
            if (offerObj && typeof offerObj === 'object') {
              const o = offerObj as Record<string, unknown>
              price = parsePrice(o['price'] ?? o['lowPrice'] ?? o['highPrice'])
              currency = typeof o['priceCurrency'] === 'string' ? o['priceCurrency'] : 'JPY'
            }
          }
          return { name, price, currency, imageUrl }
        }
      } catch {
        // ignore and try next candidate
      }
    }
  }
  return null
}

function extractFromPage(html: string): { name?: string; price?: number } {
  const result: { name?: string; price?: number } = {}
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
        break
      }
    }
  }
  return result
}

function extractFromText(text: string): { name?: string; price?: number; currency?: string; imageUrl?: string } {
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

  const imageMatch =
    text.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i) ||
    text.match(/https?:\/\/[^\s)"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s)"']*)?/i)

  const candidates = [
    ...text.matchAll(/(?:¥|JPY)\s*([\d,]+(?:\.\d+)?)/gi),
    ...text.matchAll(/(?:R\$|BRL)\s*([\d.,]+)/gi),
    ...text.matchAll(/(?:price|preço)\s*[:：]?\s*([\d.,]+)/gi),
  ]

  for (const m of candidates) {
    const parsed = parsePrice(m[1])
    if (parsed != null) {
      const currency = /R\$|BRL/i.test(m[0]) ? 'BRL' : 'JPY'
      return { name, price: parsed, currency, imageUrl: imageMatch?.[1] || imageMatch?.[0] }
    }
  }

  return { name, imageUrl: imageMatch?.[1] || imageMatch?.[0] }
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

function jsonResponse(obj: object, status = 200) {
  return new Response(JSON.stringify(obj), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

Deno.serve(async (req) => {
  const safeReturn = (obj: object) => {
    try {
      return jsonResponse(obj)
    } catch {
      return new Response(JSON.stringify(obj), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return safeReturn({ error: 'Method not allowed' })
  }

  try {
    let body: { url?: string }
    try {
      body = await req.json()
    } catch {
      return safeReturn({ error: 'Corpo da requisição inválido' })
    }
    const url = body?.url

    if (!url || typeof url !== 'string') {
      return safeReturn({ error: 'URL obrigatória' })
    }

    try {
      new URL(url)
    } catch {
      return safeReturn({ error: 'URL inválida' })
    }

    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return safeReturn({ error: 'URL inválida' })
    }

    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EikoDelivery/1.0; +https://eiko-dls.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8,pt-BR;q=0.7',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      })
    } catch (err) {
      const msg = err instanceof Error && err.name === 'AbortError'
        ? 'O site demorou para responder. Tente outro link.'
        : 'Não foi possível acessar a URL.'
      return safeReturn({ error: msg })
    }

    if (!res.ok) {
      return safeReturn({ error: `O site retornou erro (${res.status}). Tente outro link.` })
    }

    let html: string
    try {
      html = await res.text()
    } catch (err) {
      return safeReturn({ error: 'Erro ao ler a página' })
    }

    let name = 'Produto'
    let price: number | undefined
    let currency = 'JPY'
    let imageUrl: string | undefined
    try {
      const meta = extractFromMeta(html)
      const jsonLd = extractFromJsonLd(html)
      const page = extractFromPage(html)
      name = normalizeProductName(meta.name ?? jsonLd?.name ?? page.name ?? 'Produto', parsed)
      price = meta.price ?? jsonLd?.price ?? page.price ?? undefined
      currency = meta.currency ?? jsonLd?.currency ?? 'JPY'
      imageUrl = meta.imageUrl ?? jsonLd?.imageUrl ?? undefined
    } catch { /* use defaults */ }

    // Fallback para sites que bloqueiam bot ou renderizam preço via JS:
    // usa r.jina.ai para obter uma versão legível do conteúdo.
    const lowConfidence = (!price || name === 'Produto')
    if (lowConfidence) {
      try {
        const jinaUrl = `https://r.jina.ai/http://${parsed.hostname}${parsed.pathname}${parsed.search}`
        const jinaRes = await fetch(jinaUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; EikoDelivery/1.0; +https://eiko-dls.com)',
            'Accept': 'text/plain,text/markdown,*/*',
          },
          signal: AbortSignal.timeout(10000),
        })
        if (jinaRes.ok) {
          const text = await jinaRes.text()
          const ext = extractFromText(text)
          if (ext.name && name === 'Produto') name = normalizeProductName(ext.name, parsed)
          if (ext.price != null && price == null) price = ext.price
          if (ext.currency && currency === 'JPY') currency = ext.currency
          if (ext.imageUrl && !imageUrl) imageUrl = ext.imageUrl
        }
      } catch {
        // mantém resultado original
      }
    }

    return safeReturn({ name, price, currency, imageUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado'
    return safeReturn({ error: msg })
  }
})

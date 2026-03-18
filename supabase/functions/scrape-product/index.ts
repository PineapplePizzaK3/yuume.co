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
    if (metaOgTitle?.[1]) result.name = String(metaOgTitle[1]).trim()
  } catch { /* ignore */ }

  try {
    const metaOgImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (metaOgImage?.[1]) result.imageUrl = String(metaOgImage[1]).trim()
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

function extractFromJsonLd(html: string): { name?: string; price?: number; currency?: string } | null {
  const scriptMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of scriptMatches) {
    try {
      const json = JSON.parse(m[1].trim())
      const obj = Array.isArray(json) ? json.find((x: { '@type'?: string }) => x?.['@type'] === 'Product') : json
      if (obj && (obj['@type'] === 'Product' || obj['@type']?.includes?.('Product'))) {
        const name = obj.name || obj.description
        let price: number | undefined
        let currency = 'JPY'
        const offers = obj.offers
        if (offers) {
          const o = Array.isArray(offers) ? offers[0] : offers
          price = parsePrice(o?.price ?? o?.lowPrice)
          currency = o?.priceCurrency ?? 'JPY'
        }
        return { name, price, currency }
      }
    } catch { /* ignore */ }
  }
  return null
}

function extractFromPage(html: string): { name?: string; price?: number } {
  const result: { name?: string; price?: number } = {}
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) result.name = titleMatch[1].trim().replace(/\s*[|-]\s*.*$/, '')

  const pricePatterns = [
    /(?:¥|R\$\s*|US\$\s*|USD\s*|JPY\s*|BRL\s*)?([\d.,]+)\s*(?:円|yen)?/gi,
    /["']price["']\s*:\s*["']?([\d.,]+)/gi,
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
          'User-Agent': 'Mozilla/5.0 (compatible; EikoDelivery/1.0; +https://eikodelivery.com)',
          'Accept': 'text/html,application/xhtml+xml',
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
      name = meta.name ?? jsonLd?.name ?? page.name ?? 'Produto'
      price = meta.price ?? jsonLd?.price ?? page.price ?? undefined
      currency = meta.currency ?? jsonLd?.currency ?? 'JPY'
      imageUrl = meta.imageUrl ?? undefined
    } catch { /* use defaults */ }

    return safeReturn({ name, price, currency, imageUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado'
    return safeReturn({ error: msg })
  }
})

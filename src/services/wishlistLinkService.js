/**
 * Wishlist links - itens adicionados por URL com scraping de nome/preço.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

const FUNCOES_SCRAPE = ['scrape-product', 'scrape_product']

function parsePriceLoose(value) {
  if (value == null) return null
  let text = String(value).trim()
  if (!text) return null
  text = text.replace(/[^\d.,-]/g, '')
  if (!text) return null
  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) text = text.replace(/\./g, '').replace(',', '.')
    else text = text.replace(/,/g, '')
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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function extractFromJinaText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  let name = String(text || '').match(/(?:^|\n)Title:\s*(.+)/i)?.[1]?.trim() || 'Produto'
  const skipLine = /^(URL Source|Markdown Content|Warning|http[s]?:\/\/)/i
  if (!name || name === 'Produto') {
    for (const line of lines) {
      if (skipLine.test(line)) continue
      if (line.length >= 6 && line.length <= 180) {
        name = line.replace(/^#{1,6}\s*/, '').trim()
        break
      }
    }
  }
  const imageMatch =
    text.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i) ||
    text.match(/https?:\/\/[^\s)"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s)"']*)?/i)

  const priceMatch =
    text.match(/(?:¥|JPY)\s*([\d,]+(?:\.\d+)?)/i) ||
    text.match(/(?:R\$|BRL)\s*([\d.,]+)/i) ||
    text.match(/(?:price|preço)\s*[:：]?\s*([\d.,]+)/i)
  const price = parsePriceLoose(priceMatch?.[1] ?? null)
  const currency = /R\$|BRL/i.test(priceMatch?.[0] || '') ? 'BRL' : 'JPY'
  return { name, price, currency, imageUrl: imageMatch?.[1] || imageMatch?.[0] || null }
}

function normalizeProductName(rawName, pageUrl) {
  const raw = String(rawName || '').replace(/\s+/g, ' ').trim()
  if (!raw) return 'Produto'
  let name = raw
  const host = pageUrl.hostname.toLowerCase()
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

async function scrapeFallbackViaJina(url) {
  try {
    const parsed = new URL(url)
    const jinaUrl = `https://r.jina.ai/http://${parsed.hostname}${parsed.pathname}${parsed.search}`
    const res = await fetch(jinaUrl, { method: 'GET' })
    if (!res.ok) return { data: null, error: { message: 'Fallback indisponível para este link.' } }
    const text = await res.text()
    const extracted = extractFromJinaText(text)
    extracted.name = normalizeProductName(extracted.name, parsed)
    if (!extracted?.price && extracted?.name === 'Produto') {
      return { data: null, error: { message: 'Não foi possível extrair dados desse link automaticamente.' } }
    }
    return {
      data: {
        name: extracted.name,
        price: extracted.price,
        currency: extracted.currency,
        imageUrl: extracted.imageUrl || null,
      },
      error: null,
    }
  } catch {
    return { data: null, error: { message: 'Não foi possível extrair dados desse link automaticamente.' } }
  }
}

async function normalizeInvokeError(err) {
  const status = err?.context?.status
  let backendMessage = ''
  try {
    if (err?.context) {
      const clone = err.context.clone?.() || err.context
      const asJson = await clone.json?.()
      backendMessage = asJson?.error || asJson?.message || ''
      if (!backendMessage) {
        const asText = await clone.text?.()
        backendMessage = asText || ''
      }
    }
  } catch {
    // ignore parse errors
  }

  if (status === 401 || status === 403) {
    return { message: 'Sessão expirada ou sem permissão para chamar o scraper. Faça login novamente.' }
  }
  if (status === 404) {
    return { message: 'Função scrape-product não encontrada no Supabase (deploy pendente ou nome divergente).' }
  }
  if (backendMessage) return { message: backendMessage }
  if (status) return { message: `Erro no scraper (HTTP ${status}).` }
  return { message: err?.message || 'Erro ao buscar dados' }
}

/**
 * Chama a Edge Function para extrair nome/preço de uma URL.
 * Timeout de 25s para evitar carregamento infinito.
 */
export async function scrapeProductUrl(url) {
  const TIMEOUT_MS = 25000
  const parsedUrl = new URL(url)
  const isMarketplaceStrict = /(^|\.)amazon\./i.test(parsedUrl.hostname) || /(^|\.)mercari\./i.test(parsedUrl.hostname)
  let lastError = null
  for (const funcName of FUNCOES_SCRAPE) {
    const invokePromise = supabase.functions.invoke(funcName, { body: { url } })
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tempo esgotado. Tente novamente.')), TIMEOUT_MS)
    )
    try {
      const result = await Promise.race([invokePromise, timeoutPromise])
      const { data, error } = result ?? {}
      if (error) {
        lastError = await normalizeInvokeError(error)
        // tenta o próximo nome de função quando a rota não existir
        if (lastError?.message?.includes('não encontrada')) continue
      } else if (data?.error) {
        lastError = { message: data.error }
      } else {
        if (data?.name) data.name = normalizeProductName(data.name, parsedUrl)
        if (isMarketplaceStrict && (data?.price == null || Number(data?.price) <= 0)) {
          lastError = { message: 'Não foi possível extrair o preço automaticamente deste link. Use adição manual.' }
          continue
        }
        return { data, error: null }
      }
    } catch (e) {
      lastError = { message: e?.message || 'Erro ao buscar dados' }
      if (!String(lastError.message).includes('Tempo esgotado')) continue
    }
  }

  // Fallback específico para sites que bloqueiam scraping server-side (ex.: Amazon/Mercari).
  const fallback = await scrapeFallbackViaJina(url)
  if (!fallback.error) return fallback

  return { data: null, error: lastError || fallback.error || { message: 'Erro ao buscar dados' } }
}

export async function getWishlistLinks(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist_links')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function addWishlistLink(userId, { url, product_name, price, currency, image_url }) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist_links')
        .insert({
          user_id: userId,
          url,
          product_name,
          price: price ?? null,
          previous_price: null,
          currency: currency ?? 'JPY',
          image_url: image_url ?? null,
          last_checked_at: new Date().toISOString(),
        })
        .select()
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function updateWishlistLink(userId, id, { url, product_name, price, previous_price, image_url, currency }) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist_links')
        .update({
          url: url ?? undefined,
          product_name: product_name ?? undefined,
          price: price ?? undefined,
          previous_price: previous_price ?? undefined,
          image_url: image_url ?? undefined,
          currency: currency ?? undefined,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function removeWishlistLink(userId, id) {
  try {
    const { error } = await withDbTimeout(
      supabase
        .from('wishlist_links')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

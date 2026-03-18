/**
 * Wishlist links - itens adicionados por URL com scraping de nome/preço.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

const FUNCAO_SCRAPE = 'scrape-product'

/**
 * Chama a Edge Function para extrair nome/preço de uma URL.
 * Timeout de 25s para evitar carregamento infinito.
 */
export async function scrapeProductUrl(url) {
  const TIMEOUT_MS = 25000
  const invokePromise = supabase.functions.invoke(FUNCAO_SCRAPE, { body: { url } })
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Tempo esgotado. Tente novamente.')), TIMEOUT_MS)
  )
  try {
    const result = await Promise.race([invokePromise, timeoutPromise])
    const { data, error } = result ?? {}
    if (error) {
      const msg = error?.message?.includes('non-2xx')
        ? 'O site não respondeu corretamente. Tente novamente ou adicione manualmente.'
        : (error?.message || 'Erro ao buscar dados')
      return { data: null, error: { message: msg } }
    }
    if (data?.error) return { data: null, error: { message: data.error } }
    return { data, error: null }
  } catch (e) {
    const msg = e?.message || 'Erro ao buscar dados'
    return { data: null, error: { message: msg } }
  }
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

export async function updateWishlistLink(userId, id, { product_name, price, previous_price, image_url, currency }) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist_links')
        .update({
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

/**
 * Wishlist service - lista de desejos do usuário.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

export async function getWishlist(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist')
        .select('*, products(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function addToWishlist(userId, productId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('wishlist')
        .upsert({ user_id: userId, product_id: productId }, { onConflict: 'user_id,product_id' })
        .select()
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function removeFromWishlist(userId, productId) {
  try {
    const { error } = await withDbTimeout(
      supabase
        .from('wishlist')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId)
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

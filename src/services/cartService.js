/**
 * Cart service - carrinho da loja virtual.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

export async function getCart(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('cart_items')
        .select(`
          id,
          user_id,
          product_id,
          quantity,
          created_at,
          products(
            id,
            name,
            price,
            image_url,
            is_active,
            stock_quantity,
            purchase_group_id
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function addToCart(userId, productId, quantity = 1) {
  try {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)))
    const { data, error } = await withDbTimeout(
      supabase
        .from('cart_items')
        .upsert(
          { user_id: userId, product_id: productId, quantity: qty },
          { onConflict: 'user_id,product_id' }
        )
        .select()
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function updateCartItem(userId, productId, quantity) {
  try {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)))
    const { data, error } = await withDbTimeout(
      supabase
        .from('cart_items')
        .update({ quantity: qty })
        .eq('user_id', userId)
        .eq('product_id', productId)
        .select()
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function removeFromCart(userId, productId) {
  try {
    const { error } = await withDbTimeout(
      supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId)
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

export async function clearCart(userId) {
  try {
    const { error } = await withDbTimeout(
      supabase.from('cart_items').delete().eq('user_id', userId)
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

export async function createStoreOrder(userId, shipImmediately, shippingCostJpy = null, shippingAddressId = null, couponCode = null) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('create_store_order', {
        p_user_id: userId,
        p_ship_immediately: shipImmediately,
        p_shipping_cost: shipImmediately ? shippingCostJpy : null,
        p_shipping_currency: 'JPY',
        p_shipping_address_id: shippingAddressId,
        p_coupon_code: couponCode && String(couponCode).trim() ? String(couponCode).trim() : null,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function getLatestPendingStoreOrder(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('orders')
        .select('id, user_id, status, order_source, created_at, total_amount, quote_amount, quote_currency, shipping_cost, shipping_currency, wallet_applied_amount')
        .eq('user_id', userId)
        .eq('order_source', 'store')
        .eq('status', 'awaiting_payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

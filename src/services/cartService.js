/**
 * Cart service - carrinho da loja virtual.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

export const CART_UPDATED_EVENT = 'cart:updated'

function emitCartUpdated(userId) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: { userId } }))
}

export async function getCart(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('cart_items')
        .select(`
          id,
          user_id,
          product_id,
          variant_id,
          quantity,
          created_at,
          products(
            id,
            name,
            price,
            price_jpy,
            price_usd,
            price_brl,
            image_url,
            is_active,
            stock_quantity,
            purchase_group_id
          ),
          product_variants:variant_id(
            id,
            product_id,
            title,
            attributes,
            price_jpy,
            stock_quantity,
            is_active,
            is_default
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

export async function addToCart(userId, productId, quantity = 1, variantId = null) {
  try {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)))
    if (!variantId) {
      return { data: null, error: { message: 'Selecione uma variante do produto.' } }
    }

    // Fallback robusto: evita depender de ON CONFLICT quando o índice ainda não foi migrado.
    const { data: existingRows, error: existingError } = await withDbTimeout(
      supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', userId)
        .eq('variant_id', variantId)
        .order('created_at', { ascending: false })
        .limit(5)
    )
    if (existingError) return { data: null, error: existingError }

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      const primary = existingRows[0]
      const currentQty = Math.max(0, Number(primary?.quantity) || 0)
      const nextQty = Math.max(1, Math.min(99, currentQty + qty))
      const { data: updated, error: updateError } = await withDbTimeout(
        supabase
          .from('cart_items')
          .update({ quantity: nextQty, product_id: productId })
          .eq('id', primary.id)
          .select()
          .single()
      )
      if (updateError) return { data: null, error: updateError }

      // Segurança para bases que chegaram a criar duplicados.
      if (existingRows.length > 1) {
        const duplicateIds = existingRows.slice(1).map((row) => row?.id).filter(Boolean)
        if (duplicateIds.length > 0) {
          await withDbTimeout(
            supabase
              .from('cart_items')
              .delete()
              .in('id', duplicateIds)
          )
        }
      }
      emitCartUpdated(userId)
      return { data: updated, error: null }
    }

    const { data, error } = await withDbTimeout(
      supabase
        .from('cart_items')
        .insert({ user_id: userId, product_id: productId, variant_id: variantId, quantity: qty })
        .select()
        .single()
    )
    if (!error) emitCartUpdated(userId)
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function updateCartItem(userId, variantId, quantity) {
  try {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)))
    const { data, error } = await withDbTimeout(
      supabase
        .from('cart_items')
        .update({ quantity: qty })
        .eq('user_id', userId)
        .eq('variant_id', variantId)
        .select()
        .single()
    )
    if (!error) emitCartUpdated(userId)
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function removeFromCart(userId, variantId) {
  try {
    const { error } = await withDbTimeout(
      supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
        .eq('variant_id', variantId)
    )
    if (!error) emitCartUpdated(userId)
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
    if (!error) emitCartUpdated(userId)
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

export async function createStoreOrder(userId, shipImmediately, shippingCostJpy = null, shippingAddressId = null, couponCode = null) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('create_store_order_safe', {
        p_user_id: userId,
        p_ship_immediately: shipImmediately,
        p_shipping_cost: shipImmediately ? shippingCostJpy : null,
        p_shipping_currency: 'JPY',
        p_shipping_address_id: shippingAddressId,
        p_coupon_code: couponCode && String(couponCode).trim() ? String(couponCode).trim() : null,
      })
    )
    if (!error) emitCartUpdated(userId)
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
        .select(`
          id,
          user_id,
          status,
          order_source,
          created_at,
          total_amount,
          total_amount_usd,
          quote_amount,
          quote_currency,
          shipping_cost,
          shipping_currency,
          wallet_applied_amount,
          discount_amount,
          order_items(quantity, price_at_purchase)
        `)
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

/**
 * Cart service - carrinho da loja virtual.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { triggerUserTransactionalEmail } from './userTransactionalEmailService'

export const CART_UPDATED_EVENT = 'cart:updated'

function emitCartUpdated(userId) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: { userId } }))
}

function mapEphemeralCartRow(row) {
  const token = String(row?.ephemeral_token || '').trim()
  const priceJpy = Number(row?.price_jpy) || 0
  return {
    id: row?.id || `ephemeral-${token}`,
    line_type: 'ephemeral',
    ephemeral_token: token,
    user_id: row?.user_id || null,
    product_id: null,
    variant_id: null,
    quantity: Math.max(1, Number(row?.quantity) || 1),
    created_at: row?.created_at || null,
    products: {
      id: token ? `ephemeral:${token}` : null,
      name: row?.title || 'Produto temporário',
      price: priceJpy,
      price_jpy: priceJpy,
      price_usd: null,
      price_brl: null,
      image_url: row?.image_url || '',
      is_active: row?.is_available !== false,
      stock_quantity: null,
      purchase_group_id: null,
      external_url: row?.external_url || '',
      store_id: row?.store_id || '',
      expires_at: row?.expires_at || null,
    },
    product_variants: null,
  }
}

export async function getEphemeralCart() {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('list_my_ephemeral_cart_items')
    )
    if (error) return { data: [], error }
    const rows = Array.isArray(data) ? data.map(mapEphemeralCartRow) : []
    return { data: rows, error: null }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
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
            image_url,
            image_urls,
            price_jpy,
            stock_quantity,
            is_active,
            is_default
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    )
    if (error) return { data: data ?? [], error }

    const catalogRows = (Array.isArray(data) ? data : []).map((row) => ({
      ...row,
      line_type: 'catalog',
    }))

    const { data: ephemeralRows } = await getEphemeralCart()
    // Não bloquear o carrinho principal se a listagem efêmera falhar.
    const merged = [
      ...(Array.isArray(ephemeralRows) ? ephemeralRows : []),
      ...catalogRows,
    ]
    return { data: merged, error: null }
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

export async function addEphemeralToCart(ephemeralToken, quantity = 1) {
  try {
    const token = String(ephemeralToken || '').trim()
    if (!token) return { data: null, error: { message: 'Item temporário inválido.' } }
    const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)))

    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id || ''
    if (!userId) return { data: null, error: { message: 'Faça login para adicionar ao carrinho.' } }

    const { data, error } = await withDbTimeout(
      supabase.rpc('add_ephemeral_to_cart', {
        p_token: token,
        p_quantity: qty,
      })
    )
    if (!error) emitCartUpdated(userId)
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function updateEphemeralCartItem(ephemeralToken, quantity) {
  try {
    const token = String(ephemeralToken || '').trim()
    if (!token) return { data: null, error: { message: 'Item temporário inválido.' } }
    const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)))

    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id || ''

    const { data, error } = await withDbTimeout(
      supabase.rpc('update_ephemeral_cart_item', {
        p_token: token,
        p_quantity: qty,
      })
    )
    if (!error && userId) emitCartUpdated(userId)
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function removeEphemeralFromCart(ephemeralToken) {
  try {
    const token = String(ephemeralToken || '').trim()
    if (!token) return { error: { message: 'Item temporário inválido.' } }

    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id || ''

    const { error } = await withDbTimeout(
      supabase.rpc('remove_ephemeral_from_cart', {
        p_token: token,
      })
    )
    if (!error && userId) emitCartUpdated(userId)
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
    if (!error) {
      emitCartUpdated(userId)
      if (data?.id) {
        void triggerUserTransactionalEmail({
          event_type: 'order_created',
          order_id: data.id,
        })
      }
    }
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

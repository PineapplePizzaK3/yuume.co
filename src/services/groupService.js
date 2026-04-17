/**
 * Group service - grupos de compra.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

export async function getPurchaseGroups(destination = 'physical') {
  try {
    if (destination === 'all') {
      const [online, physical] = await Promise.all([
        getPurchaseGroups('online'),
        getPurchaseGroups('physical'),
      ])
      const err = online.error || physical.error
      const byId = new Map()
      for (const g of [...(online.data ?? []), ...(physical.data ?? [])]) {
        if (g?.id != null && !byId.has(g.id)) byId.set(g.id, g)
      }
      const merged = Array.from(byId.values()).sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime()
        const tb = new Date(b.created_at || 0).getTime()
        return tb - ta
      })
      return { data: merged, error: err }
    }
    const safeDestination = destination === 'online' ? 'online' : 'physical'
    const { data, error } = await withDbTimeout(
      supabase
        .from('purchase_groups')
        .select('*')
        .eq('is_active', true)
        .eq('source', 'scheduled')
        .eq('destination', safeDestination)
        .order('created_at', { ascending: false })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function getPurchaseGroupsAdmin() {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_list_purchase_groups')
    )
    const list = Array.isArray(data) ? data : (data ?? [])
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function createPurchaseGroup(group) {
  try {
    const imageUrls = Array.isArray(group.image_urls) ? group.image_urls : []
    const payload = {
      name: group.name,
      description: group.description ?? '',
      image_url: group.image_url ?? (imageUrls[0] || ''),
      image_urls: imageUrls,
      is_active: group.is_active ?? true,
      product_ids: [],
      source: 'scheduled',
      destination: group.destination ?? null,
      scheduled_shipping_fee_jpy: group.scheduled_shipping_fee_jpy ?? null,
      scheduled_free_shipping_min_jpy: group.scheduled_free_shipping_min_jpy ?? null,
    }

    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_create_purchase_group', { p_group: payload })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function updatePurchaseGroup(id, group) {
  try {
    const imageUrls = Array.isArray(group.image_urls) ? group.image_urls : []
    const payload = {
      name: group.name,
      description: group.description ?? '',
      image_url: group.image_url ?? (imageUrls[0] || ''),
      image_urls: imageUrls,
      is_active: group.is_active ?? true,
      product_ids: [],
      source: 'scheduled',
      destination: group.destination ?? null,
      scheduled_shipping_fee_jpy: group.scheduled_shipping_fee_jpy ?? null,
      scheduled_free_shipping_min_jpy: group.scheduled_free_shipping_min_jpy ?? null,
    }

    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_update_purchase_group', { p_id: id, p_group: payload })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function deletePurchaseGroup(id) {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('admin_delete_purchase_group', { p_id: id })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

/** Admin: cria produto específico do grupo */
export async function createPurchaseGroupProduct(groupId, product) {
  try {
    const imageUrls = Array.isArray(product.image_urls) ? product.image_urls : []
    const payload = {
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      image_url: product.image_url ?? (imageUrls[0] || ''),
      image_urls: imageUrls,
      source_url: product.source_url ?? null,
      admin_product_url: product.admin_product_url ?? null,
      weight_kg: product.weight_kg ?? 0,
      stock_quantity: product.stock_quantity ?? null,
    }
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_create_purchase_group_product', {
        p_group_id: groupId,
        p_product: payload,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/** Admin: atualiza produto do grupo */
export async function updatePurchaseGroupProduct(groupId, productId, product) {
  try {
    const imageUrls = Array.isArray(product.image_urls) ? product.image_urls : []
    const payload = {
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      image_url: product.image_url ?? (imageUrls[0] || ''),
      image_urls: imageUrls,
      source_url: product.source_url ?? null,
      admin_product_url: product.admin_product_url ?? null,
      weight_kg: product.weight_kg ?? 0,
      stock_quantity: product.stock_quantity ?? null,
    }
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_update_purchase_group_product', {
        p_group_id: groupId,
        p_product_id: productId,
        p_product: payload,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/** Admin: remove produto do grupo */
export async function deletePurchaseGroupProduct(groupId, productId) {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('admin_delete_purchase_group_product', {
        p_group_id: groupId,
        p_product_id: productId,
      })
    )
    if (!error) return { error: null }

    const msg = String(error?.message || '').toLowerCase()
    const isFkViolation =
      msg.includes('foreign key') ||
      msg.includes('violat') ||
      msg.includes('constraint')

    // Fallback seguro: mantém histórico de pedidos e apenas remove o produto do grupo.
    if (isFkViolation) {
      const { error: fallbackError } = await withDbTimeout(
        supabase
          .from('products')
          .update({
            purchase_group_id: null,
            is_active: false,
          })
          .eq('id', productId)
          .eq('purchase_group_id', groupId)
      )
      return { error: fallbackError }
    }

    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}


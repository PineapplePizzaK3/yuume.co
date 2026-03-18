/**
 * Group service - grupos de compra.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

export async function getPurchaseGroups() {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('purchase_groups')
        .select('*')
        .eq('is_active', true)
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
    }

    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_create_purchase_group', { p_group: payload })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}


/**
 * Address service - CRUD for user addresses.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

export async function getAddresses(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function createAddress(userId, address) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('addresses')
        .insert({
          user_id: userId,
          label: address.label ?? null,
          recipient_name: address.recipient_name,
          street: address.street,
          number: address.number,
          complement: address.complement ?? null,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country ?? 'Brasil',
        })
        .select()
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function updateAddress(userId, id, address) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('addresses')
        .update({
          label: address.label ?? null,
          recipient_name: address.recipient_name,
          street: address.street,
          number: address.number,
          complement: address.complement ?? null,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country ?? 'Brasil',
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

export async function deleteAddress(userId, id) {
  try {
    const { error } = await withDbTimeout(
      supabase
        .from('addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

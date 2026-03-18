/**
 * Profile service - CRUD for user profiles.
 * Profiles are linked to Supabase auth.users via user_id.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

/**
 * Get or create profile for the current user.
 * Call after signup to create profile row.
 * New users receive role 'user' by default.
 */
export async function getOrCreateProfile(userId, { email, name } = {}) {
  try {
    const { data: existing } = await withDbTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
    )

    if (existing) return { data: existing, error: null }

    const { data: inserted, error } = await withDbTimeout(
      supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email ?? '',
          name: name ?? '',
          role: 'user',
        })
        .select()
        .single()
    )

    return { data: inserted, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: lista usuários (id, email, name, account_code).
 */
export async function getUsersAdmin() {
  try {
    const { data, error } = await withDbTimeout(supabase.rpc('admin_list_users'))
    const list = Array.isArray(data) ? data : []
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Get profile by user id.
 */
export async function getProfile(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Update profile.
 */
export async function updateProfile(userId, updates) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

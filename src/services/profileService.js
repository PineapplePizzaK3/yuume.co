/**
 * Profile service - CRUD for user profiles.
 * Profiles are linked to Supabase auth.users via user_id.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

const KYC_BUCKET = 'kyc-documents'
const KYC_MAX_BYTES = 10 * 1024 * 1024
const KYC_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/**
 * Upload de documento KYC (identidade) — bucket privado kyc-documents/{userId}/...
 * @returns {{ data: { path: string, original_name: string, uploaded_at: string } | null, error }}
 */
export async function uploadKycDocument(file, userId) {
  if (!file || !KYC_ALLOWED_TYPES.includes(file.type)) {
    return { data: null, error: { message: 'Envie JPG, PNG, WebP ou PDF.' } }
  }
  if (file.size > KYC_MAX_BYTES) {
    return { data: null, error: { message: 'Arquivo deve ter no máximo 10 MB.' } }
  }
  if (!userId) return { data: null, error: { message: 'Usuário não identificado.' } }
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const path = `${userId}/${safeName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(KYC_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) return { data: null, error: uploadError }

    const uploadedAt = new Date().toISOString()
    return {
      data: {
        path: uploadData.path,
        original_name: file.name,
        uploaded_at: uploadedAt,
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/** Remove arquivo KYC do storage (paths completos retornados pelo upload). */
export async function removeKycDocumentFromStorage(paths) {
  const list = Array.isArray(paths) ? paths.filter(Boolean) : []
  if (list.length === 0) return { error: null }
  try {
    const { error } = await supabase.storage.from(KYC_BUCKET).remove(list)
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}

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
export async function getUsersAdmin(limit = 500, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_list_users', {
        p_limit: limit,
        p_offset: offset,
      })
    )
    const list = Array.isArray(data) ? data : []
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Admin: obtém dados completos do usuário (perfil, carteira, contagem de pedidos).
 */
export async function getUserFullAdmin(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_get_user_full', { p_user_id: userId })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Admin: atualiza perfil de outro usuário.
 */
export async function updateProfileAdmin(userId, updates) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_update_profile', {
        p_user_id: userId,
        p_updates: updates,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
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

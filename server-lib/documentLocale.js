function pickFromMetadata(meta = {}) {
  if (!meta || typeof meta !== 'object') return ''
  const keys = [
    'locale',
    'language',
    'lang',
    'preferred_locale',
    'preferred_language',
    'site_locale',
    'ui_locale',
  ]
  for (const k of keys) {
    const v = String(meta[k] || '').trim()
    if (v) return v
  }
  return ''
}

export function normalizeDocumentLocale(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return 'pt-BR'
  if (v.startsWith('en')) return 'en'
  if (v.startsWith('pt')) return 'pt-BR'
  return 'pt-BR'
}

export async function resolveUserDocumentLocale(supabaseAdmin, userId, fallback = 'pt-BR') {
  if (!supabaseAdmin || !userId) return normalizeDocumentLocale(fallback)
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error || !data?.user) return normalizeDocumentLocale(fallback)
    const user = data.user
    const fromUser = pickFromMetadata(user.user_metadata)
    const fromApp = pickFromMetadata(user.app_metadata)
    return normalizeDocumentLocale(fromUser || fromApp || fallback)
  } catch {
    return normalizeDocumentLocale(fallback)
  }
}

import { supabase } from '../lib/supabase'
import { toServiceError } from '../lib/dbGuard'

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data?.session?.access_token || ''
}

/**
 * Best-effort user transactional email trigger.
 * Never blocks the main user flow if email fails.
 */
export async function triggerUserTransactionalEmail(payload = {}) {
  try {
    const token = await getAccessToken()
    if (!token) return { data: null, error: { message: 'Sessão inválida.' } }

    const res = await fetch('/api/user-event-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { data: null, error: { message: json?.error || 'Falha ao disparar e-mail transacional.' } }
    }
    return { data: json, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

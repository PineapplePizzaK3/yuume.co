import { supabase } from '../lib/supabase'
import { toServiceError } from '../lib/dbGuard'

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data?.session?.access_token || ''
}

export async function sendAdminManualEmail(payload) {
  try {
    const token = await getAccessToken()
    if (!token) {
      return { data: null, error: { message: 'Sessao invalida. Faca login novamente.' } }
    }

    const res = await fetch('/api/admin-send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { data: null, error: { message: json?.error || 'Erro ao enviar email' } }
    }
    return { data: json, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

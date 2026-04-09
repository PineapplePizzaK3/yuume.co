import { supabase } from '../lib/supabase'
import { toServiceError } from '../lib/dbGuard'

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || null
}

export async function getFraudReviewQueue(limit = 100) {
  try {
    const token = await getAccessToken()
    if (!token) return { data: null, error: { message: 'Sessão inválida' } }
    const res = await fetch(`/api/admin/fraud?limit=${encodeURIComponent(String(limit))}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: { message: json?.error || 'Erro ao carregar fila de fraude' } }
    return { data: json, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function decideFraudCase({ entityType, id, decision, note = '' }) {
  try {
    const token = await getAccessToken()
    if (!token) return { data: null, error: { message: 'Sessão inválida' } }
    const res = await fetch('/api/admin/fraud', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'decision', entityType, id, decision, note }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: { message: json?.error || 'Erro ao decidir caso de fraude' } }
    return { data: json, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

import { supabase } from '../lib/supabase'
import { toServiceError } from './_serviceError'

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data?.session?.access_token || ''
}

/**
 * Calls privileged RPCs through server endpoint with admin validation.
 */
export async function callAdminRpc(fn, params = {}) {
  try {
    const token = await getAccessToken()
    if (!token) {
      return { data: null, error: { message: 'Sessão inválida. Faça login novamente.' } }
    }

    const res = await fetch('/api/admin/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fn, params }),
    })

    let payload = {}
    try {
      payload = await res.json()
    } catch {
      payload = {}
    }

    if (!res.ok) {
      return { data: null, error: { message: payload?.error || 'Falha ao executar ação administrativa.' } }
    }

    return { data: payload?.data ?? null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

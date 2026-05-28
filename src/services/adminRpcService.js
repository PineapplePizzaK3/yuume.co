import { supabase } from '../lib/supabase'
import { toServiceError } from '../lib/dbGuard'

async function getAccessToken({ forceRefresh = false } = {}) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const currentToken = data?.session?.access_token || ''
  if (currentToken && !forceRefresh) return currentToken

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) throw refreshError
  return refreshed?.session?.access_token || ''
}

async function callAdminRpcWithToken(token, fn, params = {}) {
  return await fetch('/api/admin/rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fn, params }),
  })
}

/**
 * Calls privileged RPCs through server endpoint with admin validation.
 */
export async function callAdminRpc(fn, params = {}) {
  try {
    let token = await getAccessToken()
    if (!token) {
      return { data: null, error: { message: 'Sessão inválida. Faça login novamente.' } }
    }

    let res = await callAdminRpcWithToken(token, fn, params)
    if (res.status === 401) {
      token = await getAccessToken({ forceRefresh: true })
      if (!token) {
        return { data: null, error: { message: 'Sessão inválida. Faça login novamente.' } }
      }
      res = await callAdminRpcWithToken(token, fn, params)
    }

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

import { supabase } from '../lib/supabase'

const SEARCH_FUNCTION_NAMES = ['catalog-search', 'catalog_search']
/** Alinhado ao timeout longo de `fetch` para `/functions/v1/` em `supabase.js`. */
const SEARCH_TIMEOUT_MS = 45000
const DEFAULT_STORES = ['amazon', 'rakuma', 'mercari', 'yahoo', 'yahoo_flea', 'snkrdunk']

async function normalizeInvokeError(err, authErrorMessage = 'Sessão expirada ou sem permissão para usar a busca do admin.') {
  const status = err?.context?.status
  let backendMessage = ''
  try {
    if (err?.context) {
      const clone = err.context.clone?.() || err.context
      const asJson = await clone.json?.()
      backendMessage = asJson?.error || asJson?.message || ''
      if (!backendMessage) {
        const asText = await clone.text?.()
        backendMessage = asText || ''
      }
    }
  } catch {
    // ignore parse errors
  }
  if (status === 401 || status === 403) {
    if (backendMessage) return { message: backendMessage }
    return { message: authErrorMessage }
  }
  if (status === 404) {
    return { message: 'Função catalog-search não encontrada no Supabase (deploy pendente).' }
  }
  if (backendMessage) return { message: backendMessage }
  if (status) return { message: `Erro na busca (HTTP ${status}).` }
  const raw = err?.message || ''
  if (/failed to send a request to the edge function/i.test(raw)) {
    return {
      message:
        'Não foi possível contactar a função catalog-search no Supabase. Confira se ela está implantada (`supabase functions deploy catalog-search`), se a URL/chave do projeto no .env estão corretas e a aba Rede do navegador para CORS ou bloqueio.',
    }
  }
  return { message: raw || 'Erro ao buscar catálogo externo.' }
}

async function invokeCatalogSearch({ body, token, authErrorMessage }) {
  let lastError = null

  for (const functionName of SEARCH_FUNCTION_NAMES) {
    const invokePromise = supabase.functions.invoke(functionName, {
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tempo esgotado ao consultar as lojas externas.')), SEARCH_TIMEOUT_MS)
    })

    try {
      const result = await Promise.race([invokePromise, timeoutPromise])
      const { data, error } = result ?? {}
      if (error) {
        lastError = await normalizeInvokeError(error, authErrorMessage)
        if (String(lastError?.message || '').includes('não encontrada')) continue
        return { data: null, error: lastError }
      }
      if (data?.error) return { data: null, error: { message: data.error } }
      return { data, error: null }
    } catch (error) {
      lastError = { message: error?.message || 'Erro ao buscar catálogo externo.' }
    }
  }

  return { data: null, error: lastError || { message: 'Não foi possível executar a busca de catálogo.' } }
}

export async function searchCatalogAdmin({
  query,
  stores = DEFAULT_STORES,
  page = 1,
  pageSize = 30,
  cursors = null,
}) {
  const { error: userErr } = await supabase.auth.getUser()
  if (userErr) {
    return { data: null, error: { message: 'Sessão expirada. Faça login novamente.' } }
  }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    return { data: null, error: { message: 'Faça login para usar a busca do catálogo.' } }
  }

  return await invokeCatalogSearch({
    body: { query, stores, page, pageSize, mode: 'admin', ...(cursors ? { cursors } : {}) },
    token,
    authErrorMessage: 'Sessão expirada ou sem permissão para usar a busca do admin.',
  })
}

export async function searchCatalogPublic({
  query,
  stores = DEFAULT_STORES,
  page = 1,
  pageSize = 24,
  cursors = null,
}) {
  return await invokeCatalogSearch({
    body: { query, stores, page, pageSize, mode: 'public', ...(cursors ? { cursors } : {}) },
    token: '',
    authErrorMessage: 'Acesso não autorizado para busca pública.',
  })
}

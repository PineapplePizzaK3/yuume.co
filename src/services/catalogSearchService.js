import { supabase } from '../lib/supabase'

const SEARCH_FUNCTION_NAMES = ['catalog-search', 'catalog_search']
/** Alinhado ao timeout longo de `fetch` para `/functions/v1/` em `supabase.js`. */
const SEARCH_TIMEOUT_MS = 45000
const ALL_STORES = ['amazon', 'rakuma', 'mercari', 'yahoo', 'yahoo_flea', 'snkrdunk']
const PUBLIC_DEFAULT_STORES = ['mercari', 'yahoo', 'yahoo_flea']

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

async function invokeCatalogSearch({ body, token, authErrorMessage, timeoutMs = SEARCH_TIMEOUT_MS }) {
  let lastError = null

  for (const functionName of SEARCH_FUNCTION_NAMES) {
    const invokePromise = supabase.functions.invoke(functionName, {
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tempo esgotado ao consultar as lojas externas.')), timeoutMs)
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
  stores = ALL_STORES,
  page = 1,
  pageSize = 30,
  cursors = null,
  filters = null,
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
    body: { query, stores, page, pageSize, mode: 'admin', context: 'legacy', ...(cursors ? { cursors } : {}), ...(filters ? { filters } : {}) },
    token,
    authErrorMessage: 'Sessão expirada ou sem permissão para usar a busca do admin.',
  })
}

export async function fetchCatalogProductGallery({ productUrl, storeId, timeoutMs = 12000 }) {
  return await invokeCatalogSearch({
    body: {
      action: 'gallery',
      productUrl,
      storeId,
      mode: 'public',
      context: 'legacy',
    },
    token: '',
    authErrorMessage: 'Acesso não autorizado para busca pública.',
    timeoutMs,
  })
}

export async function searchCatalogPublic({
  query,
  stores = PUBLIC_DEFAULT_STORES,
  page = 1,
  pageSize = 24,
  cursors = null,
  filters = null,
  forceLive = false,
}) {
  return await invokeCatalogSearch({
    body: {
      query,
      stores,
      page,
      pageSize,
      mode: 'public',
      context: 'legacy',
      ...(cursors ? { cursors } : {}),
      ...(filters ? { filters } : {}),
      ...(forceLive ? { forceLive: true } : {}),
    },
    token: '',
    authErrorMessage: 'Acesso não autorizado para busca pública.',
  })
}

/**
 * Collector-context search (fail-closed against market_sources).
 * Prefer stores already filtered to cleared + can_search_automated sources.
 */
export async function searchCatalogCollector({
  query,
  stores = ['own_stock'],
  page = 1,
  pageSize = 24,
  cursors = null,
  catalogItemId = null,
  filters = null,
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token || ''

  return await invokeCatalogSearch({
    body: {
      query,
      stores,
      page,
      pageSize,
      mode: 'public',
      context: 'collector',
      ...(catalogItemId ? { catalogItemId } : {}),
      ...(cursors ? { cursors } : {}),
      ...(filters ? { filters } : {}),
    },
    token,
    authErrorMessage: 'Faça login para buscar no mercado japonês.',
  })
}

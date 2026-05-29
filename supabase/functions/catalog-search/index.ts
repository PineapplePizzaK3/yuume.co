import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SearchRequest, StoreId, StoreSearchResult, UnifiedSearchHit } from './types.ts'
import { interleaveRankedByStore } from './rank.ts'
import { buildCacheKey, getCache, setCache } from './cache.ts'
import { buildStoreDiagnostics, buildSystemStrategyMeta } from './strategy.ts'
import { STORE_DEADLINE_MS } from './adapters/common.ts'
import { searchAmazon } from './adapters/amazon.ts'
import { searchRakuma } from './adapters/rakuma.ts'
import { searchMercari } from './adapters/mercari.ts'
import { searchYahoo } from './adapters/yahoo.ts'
import { searchYahooFlea } from './adapters/yahooFlea.ts'
import { searchSnkrdunk } from './adapters/snkrdunk.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_STORES: StoreId[] = ['amazon', 'rakuma', 'mercari', 'yahoo', 'yahoo_flea', 'snkrdunk']

const searchByStore: Record<StoreId, (query: string, pageSize: number) => Promise<UnifiedSearchHit[]>> = {
  amazon: searchAmazon,
  rakuma: searchRakuma,
  mercari: searchMercari,
  yahoo: searchYahoo,
  yahoo_flea: searchYahooFlea,
  snkrdunk: searchSnkrdunk,
}

function safeJson(payload: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

/** Valida JWT + role admin (o gateway pode ter verify_jwt=false; a proteção fica aqui). */
async function requireAdmin(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) {
    return safeJson({ error: 'Autenticação necessária.' }, 401)
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!supabaseUrl || !anon) {
    return safeJson({ error: 'Configuração do servidor incompleta.' }, 500)
  }
  const supabase = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    return safeJson({ error: 'Sessão inválida ou expirada.' }, 401)
  }
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profErr || profile?.role !== 'admin') {
    return safeJson({ error: 'Acesso restrito a administradores.' }, 403)
  }
  return null
}

function sanitizeRequest(body: SearchRequest): Required<SearchRequest> {
  const query = String(body?.query ?? '').trim()
  const requestedStores = Array.isArray(body?.stores) ? body.stores : ALLOWED_STORES
  const stores = requestedStores.filter((store): store is StoreId =>
    ALLOWED_STORES.includes(store as StoreId)
  )
  const page = Number.isFinite(Number(body?.page)) ? Math.max(1, Number(body.page)) : 1
  const pageSize = Number.isFinite(Number(body?.pageSize))
    ? Math.min(48, Math.max(6, Number(body.pageSize)))
    : 30
  return {
    query,
    stores: stores.length ? stores : ALLOWED_STORES,
    page,
    pageSize,
  }
}

async function searchStore(storeId: StoreId, query: string, pageSize: number): Promise<StoreSearchResult> {
  const startedAt = Date.now()
  try {
    const hits = await searchByStore[storeId](query, pageSize)
    return {
      storeId,
      hits,
      tookMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      storeId,
      hits: [],
      error: error instanceof Error ? error.message : 'Falha ao consultar loja',
      tookMs: Date.now() - startedAt,
    }
  }
}

async function searchStoreWithDeadline(
  storeId: StoreId,
  query: string,
  pageSize: number,
): Promise<StoreSearchResult> {
  const startedAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<StoreSearchResult>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          storeId,
          hits: [],
          error: 'Tempo esgotado ao consultar loja',
          tookMs: Date.now() - startedAt,
        }),
      STORE_DEADLINE_MS,
    )
  })
  try {
    return await Promise.race([searchStore(storeId, query, pageSize), deadline])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return safeJson({ error: 'Método não suportado' }, 405)

  try {
    const denied = await requireAdmin(req)
    if (denied) return denied

    const body = (await req.json()) as SearchRequest
    const input = sanitizeRequest(body)

    if (!input.query || input.query.length < 2) {
      return safeJson({ error: 'Informe ao menos 2 caracteres para buscar.' }, 400)
    }

    const cacheKey = buildCacheKey({
      q: input.query.toLowerCase(),
      stores: input.stores,
      page: input.page,
      pageSize: input.pageSize,
    })
    const cached = getCache<unknown>(cacheKey)
    if (cached) return safeJson({ ...cached, cacheHit: true })

    const startedAt = Date.now()
    const neededTotal = input.pageSize * input.page
    const perStoreSize = Math.max(8, Math.ceil(neededTotal / input.stores.length) + 4)
    const settled = await Promise.all(
      input.stores.map((storeId) => searchStoreWithDeadline(storeId, input.query, perStoreSize)),
    )

    const partials = settled
      .filter((result) => result.error)
      .map((result) => ({
        storeId: result.storeId,
        reason: result.error,
      }))

    const merged = settled.flatMap((result) => result.hits)
    const ranked = interleaveRankedByStore(merged, input.query, input.stores)
    const startIdx = (input.page - 1) * input.pageSize
    const pageHits = ranked.slice(startIdx, startIdx + input.pageSize)
    // Página cheia ⇒ pode haver mais na próxima rodada (perStoreSize sobe com page).
    const hasMore = pageHits.length >= input.pageSize

    const payload = {
      results: pageHits,
      meta: {
        query: input.query,
        stores: input.stores,
        totalEstimated: ranked.length,
        page: input.page,
        pageSize: input.pageSize,
        hasMore,
        tookMs: Date.now() - startedAt,
        strategy: buildSystemStrategyMeta(),
        diagnostics: buildStoreDiagnostics(input.stores, settled),
      },
      partials,
      cacheHit: false,
    }

    setCache(cacheKey, payload)
    return safeJson(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado'
    return safeJson({ error: message }, 500)
  }
})

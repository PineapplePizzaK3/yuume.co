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
const PUBLIC_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const PUBLIC_RATE_LIMIT_MAX_REQUESTS = 20
const PUBLIC_MAX_PAGE = 50
const PUBLIC_MAX_PAGE_SIZE = 24
const ADMIN_MAX_PAGE = 50
const publicIpHits = new Map<string, number[]>()

const searchByStore: Record<
  StoreId,
  (query: string, pageSize: number, storePage?: number) => Promise<UnifiedSearchHit[]>
> = {
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

function getRequestMode(body: SearchRequest): 'admin' | 'public' {
  return body?.mode === 'public' ? 'public' : 'admin'
}

function getClientIp(req: Request): string {
  const fromForwarded = req.headers.get('x-forwarded-for')?.split(',')?.[0]?.trim()
  const fromCf = req.headers.get('cf-connecting-ip')?.trim()
  const fromReal = req.headers.get('x-real-ip')?.trim()
  return fromForwarded || fromCf || fromReal || 'unknown'
}

function enforcePublicRateLimit(req: Request): Response | null {
  const now = Date.now()
  const ip = getClientIp(req)
  const windowStart = now - PUBLIC_RATE_LIMIT_WINDOW_MS
  const recent = (publicIpHits.get(ip) ?? []).filter((ts) => ts >= windowStart)
  if (recent.length >= PUBLIC_RATE_LIMIT_MAX_REQUESTS) {
    return safeJson(
      {
        error: 'Muitas buscas em sequência. Aguarde alguns minutos e tente novamente.',
      },
      429,
    )
  }
  recent.push(now)
  publicIpHits.set(ip, recent)
  return null
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

function sanitizeRequest(body: SearchRequest, mode: 'admin' | 'public'): Required<SearchRequest> {
  const query = String(body?.query ?? '').trim()
  const requestedStores = Array.isArray(body?.stores) ? body.stores : ALLOWED_STORES
  const stores = requestedStores.filter((store): store is StoreId =>
    ALLOWED_STORES.includes(store as StoreId)
  )
  const pageLimit = mode === 'public' ? PUBLIC_MAX_PAGE : ADMIN_MAX_PAGE
  const page = Number.isFinite(Number(body?.page))
    ? Math.min(pageLimit, Math.max(1, Number(body.page)))
    : 1
  const pageSizeMax = mode === 'public' ? PUBLIC_MAX_PAGE_SIZE : 48
  const pageSize = Number.isFinite(Number(body?.pageSize))
    ? Math.min(pageSizeMax, Math.max(6, Number(body.pageSize)))
    : 30
  return {
    query,
    stores: stores.length ? stores : ALLOWED_STORES,
    page,
    pageSize,
  }
}

async function searchStore(
  storeId: StoreId,
  query: string,
  pageSize: number,
  storePage: number = 1,
): Promise<StoreSearchResult> {
  const startedAt = Date.now()
  try {
    const hits = await searchByStore[storeId](query, pageSize, storePage)
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
  perStoreSize: number,
): Promise<StoreSearchResult> {
  const startedAt = Date.now()
  const storePageCapacity = 36
  const maxStorePage = Math.max(1, Math.ceil(perStoreSize / storePageCapacity))
  const seen = new Set<string>()
  const hits: UnifiedSearchHit[] = []

  for (let storePage = 1; storePage <= maxStorePage; storePage += 1) {
    const remaining = perStoreSize - hits.length
    if (remaining <= 0) break

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

    let pageResult: StoreSearchResult
    try {
      pageResult = await Promise.race([searchStore(storeId, query, remaining, storePage), deadline])
    } finally {
      if (timer) clearTimeout(timer)
    }

    if (pageResult.error && hits.length === 0) return pageResult

    for (const hit of pageResult.hits) {
      const key = hit.productUrl || hit.id
      if (!key || seen.has(key)) continue
      seen.add(key)
      hits.push(hit)
      if (hits.length >= perStoreSize) break
    }

    if (pageResult.hits.length < remaining) break
  }

  return {
    storeId,
    hits: hits.slice(0, perStoreSize),
    tookMs: Date.now() - startedAt,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return safeJson({ error: 'Método não suportado' }, 405)

  try {
    const body = (await req.json()) as SearchRequest
    const mode = getRequestMode(body)
    if (mode === 'admin') {
      const denied = await requireAdmin(req)
      if (denied) return denied
    } else {
      const denied = enforcePublicRateLimit(req)
      if (denied) return denied
    }
    const input = sanitizeRequest(body, mode)

    if (!input.query || input.query.length < 2) {
      return safeJson({ error: 'Informe ao menos 2 caracteres para buscar.' }, 400)
    }

    const cacheKey = buildCacheKey({
      mode,
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
    const hasMore = startIdx + pageHits.length < ranked.length

    const payload = {
      results: pageHits,
      meta: {
        mode,
        query: input.query,
        stores: input.stores,
        totalEstimated: ranked.length,
        page: input.page,
        pageSize: input.pageSize,
        hasMore,
        tookMs: Date.now() - startedAt,
        strategy: buildSystemStrategyMeta(),
        diagnostics: mode === 'admin' ? buildStoreDiagnostics(input.stores, settled) : undefined,
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

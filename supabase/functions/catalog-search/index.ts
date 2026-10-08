import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SearchRequest, StoreId, StoreSearchResult, UnifiedSearchHit } from './types.ts'
import { interleaveByStore, interleaveRankedByStore } from './rank.ts'
import { buildCacheKey, getCache, setCache } from './cache.ts'
import { buildStoreDiagnostics, buildSystemStrategyMeta } from './strategy.ts'
import { STORE_DEADLINE_MS } from './adapters/common.ts'
import { searchAmazon } from './adapters/amazon.ts'
import { searchRakuma } from './adapters/rakuma.ts'
import { searchMercariPage } from './adapters/mercari.ts'
import { searchYahoo } from './adapters/yahoo.ts'
import { searchYahooFlea } from './adapters/yahooFlea.ts'
import { searchSnkrdunk } from './adapters/snkrdunk.ts'
import { fetchProductGallery } from './productGallery.ts'
import { ingestListingIndexHits, mergeLiveHitsWithIndex, searchListingIndexHits } from './listingIndex.ts'
import { evaluateIndexSufficiency } from './indexSufficiency.ts'
import {
  claimInflight,
  consumeSharedRateLimit,
  finishInflight,
  getSharedCache,
  incrementQueryStat,
  isServiceRoleRequest,
  recordStoreFetchResult,
  releaseStoreSlot,
  setSharedCache,
  tryAcquireStoreSlot,
  waitForSharedCache,
} from './searchInfra.ts'
import { isSourceAllowed, partitionAllowedSources, type GateContext } from '../_shared/marketSourceGate.ts'
import {
  applyHitFilters,
  batchMayHaveMorePages,
  compactFiltersForCache,
  liveSearchQuery,
  sanitizeFilters,
  sortHitsByPrice,
  type CatalogSearchFilters,
} from './filters.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_STORES: StoreId[] = ['amazon', 'rakuma', 'mercari', 'yahoo', 'yahoo_flea', 'snkrdunk']
const PUBLIC_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const PUBLIC_RATE_LIMIT_MAX_REQUESTS = 200
const PUBLIC_MAX_PAGE_SIZE = 24
const publicIpHits = new Map<string, number[]>()
const STORE_FETCH_MAX: Record<StoreId, number> = {
  amazon: 1,
  rakuma: 1,
  mercari: 2,
  yahoo: 2,
  yahoo_flea: 2,
  snkrdunk: 1,
}

const searchByStore: Record<
  StoreId,
  (query: string, pageSize: number, storePage?: number, filters?: CatalogSearchFilters) => Promise<UnifiedSearchHit[]>
> = {
  amazon: searchAmazon,
  rakuma: searchRakuma,
  yahoo: searchYahoo,
  yahoo_flea: searchYahooFlea,
  snkrdunk: searchSnkrdunk,
  mercari: () => Promise.resolve([]),
}

type SearchPayload = {
  results: UnifiedSearchHit[]
  meta: Record<string, unknown>
  partials: { storeId: StoreId; reason?: string }[]
  cacheHit: boolean
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

function getGateContext(body: SearchRequest, mode: 'admin' | 'public'): GateContext {
  if (body?.context === 'collector') return 'collector'
  return mode === 'admin' ? 'legacy_admin' : 'legacy_public'
}

function getClientIp(req: Request): string {
  const fromForwarded = req.headers.get('x-forwarded-for')?.split(',')?.[0]?.trim()
  const fromCf = req.headers.get('cf-connecting-ip')?.trim()
  const fromReal = req.headers.get('x-real-ip')?.trim()
  return fromForwarded || fromCf || fromReal || 'unknown'
}

function enforceMemoryRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - PUBLIC_RATE_LIMIT_WINDOW_MS
  const recent = (publicIpHits.get(ip) ?? []).filter((ts) => ts >= windowStart)
  if (recent.length >= PUBLIC_RATE_LIMIT_MAX_REQUESTS) return false
  recent.push(now)
  publicIpHits.set(ip, recent)
  return true
}

async function enforcePublicRateLimit(req: Request): Promise<Response | null> {
  const ip = getClientIp(req)
  const shared = await consumeSharedRateLimit(ip)
  if (shared === false) {
    return safeJson(
      { error: 'Muitas buscas em sequência. Aguarde alguns minutos e tente novamente.' },
      429,
    )
  }
  if (shared === true) return null
  if (!enforceMemoryRateLimit(ip)) {
    return safeJson(
      { error: 'Muitas buscas em sequência. Aguarde alguns minutos e tente novamente.' },
      429,
    )
  }
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

function sanitizeCursors(raw: unknown): Partial<Record<StoreId, string>> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Partial<Record<StoreId, string>> = {}
  for (const storeId of ALLOWED_STORES) {
    const token = String((raw as Record<string, unknown>)[storeId] ?? '').trim()
    if (token) out[storeId] = token
  }
  return out
}

function sanitizeRequest(body: SearchRequest, mode: 'admin' | 'public'): Required<SearchRequest> {
  const query = String(body?.query ?? '').trim()
  const requestedStores = Array.isArray(body?.stores) ? body.stores : ALLOWED_STORES
  const stores = requestedStores.filter((store): store is StoreId =>
    ALLOWED_STORES.includes(store as StoreId)
  )
  const page = Number.isFinite(Number(body?.page)) ? Math.max(1, Number(body.page)) : 1
  const pageSizeMax = mode === 'public' ? PUBLIC_MAX_PAGE_SIZE : 48
  const pageSize = Number.isFinite(Number(body.pageSize))
    ? Math.min(pageSizeMax, Math.max(6, Number(body.pageSize)))
    : 30
  return {
    query,
    stores: stores.length ? stores : ALLOWED_STORES,
    page,
    pageSize,
    mode,
    context: body?.context === 'collector' ? 'collector' : 'legacy',
    cursors: sanitizeCursors(body?.cursors),
    filters: sanitizeFilters(body?.filters),
    forceLive: Boolean(body?.forceLive),
  }
}

function runInBackground(task: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime
  const guarded = task.catch((err) => console.error('[catalog-search] background', err))
  if (typeof runtime?.waitUntil === 'function') {
    runtime.waitUntil(guarded)
    return
  }
  void guarded
}

function isHardStoreFailure(error?: string): boolean {
  if (!error) return false
  return /429|rate|forbidden|403|tempo esgotado|timeout|econnreset|network/i.test(error)
}

async function searchStoreBatch(
  storeId: StoreId,
  query: string,
  batchSize: number,
  storePage: number,
  cursor?: string,
  filters?: CatalogSearchFilters,
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

  const work = async (): Promise<StoreSearchResult> => {
    try {
      if (storeId === 'mercari') {
        const mercari = await searchMercariPage(query, batchSize, {
          storePage,
          pageToken: cursor,
          filters,
        })
        return {
          storeId,
          hits: mercari.hits,
          nextCursor: mercari.nextPageToken,
          tookMs: Date.now() - startedAt,
        }
      }

      const hits = await searchByStore[storeId](query, batchSize, storePage, filters)
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

  try {
    return await Promise.race([work(), deadline])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function rankHits(
  hits: UnifiedSearchHit[],
  query: string,
  stores: StoreId[],
  filters: CatalogSearchFilters,
): UnifiedSearchHit[] {
  if (filters.sort === 'price_asc' || filters.sort === 'price_desc') {
    return sortHitsByPrice(hits, filters.sort)
  }
  if (filters.sort === 'newest') return interleaveByStore(hits, stores)
  return interleaveRankedByStore(hits, query, stores)
}

function buildSearchPayload(args: {
  hits: UnifiedSearchHit[]
  indexHits: UnifiedSearchHit[]
  settled: StoreSearchResult[]
  partials: { storeId: StoreId; reason?: string }[]
  input: Required<SearchRequest>
  mode: 'admin' | 'public'
  gateContext: GateContext
  excludedStores: string[]
  startedAt: number
  source: 'index' | 'live' | 'hybrid'
  indexFresh: boolean
  refreshPending: boolean
  hasMore: boolean
  nextCursors?: Partial<Record<StoreId, string>>
}): SearchPayload {
  const pageHits = args.hits.slice(0, args.input.pageSize)
  return {
    results: pageHits,
    meta: {
      mode: args.mode,
      context: args.gateContext,
      query: args.input.query,
      stores: args.input.stores,
      excludedStores: args.excludedStores,
      totalEstimated: null,
      page: args.input.page,
      pageSize: args.input.pageSize,
      filters: args.input.filters,
      hasMore: args.hasMore,
      cursors: args.nextCursors && Object.keys(args.nextCursors).length ? args.nextCursors : undefined,
      tookMs: Date.now() - args.startedAt,
      strategy: buildSystemStrategyMeta(args.indexHits.length),
      diagnostics: args.mode === 'admin' ? buildStoreDiagnostics(args.input.stores, args.settled) : undefined,
      source: args.source,
      indexFresh: args.indexFresh,
      refreshPending: args.refreshPending,
    },
    partials: args.partials,
    cacheHit: false,
  }
}

async function executeLiveSearch(args: {
  input: Required<SearchRequest>
  indexHits: UnifiedSearchHit[]
  mode: 'admin' | 'public'
  gateContext: GateContext
  excludedStores: string[]
  startedAt: number
  indexFresh: boolean
}): Promise<SearchPayload> {
  const { input, indexHits } = args
  const perStoreBatch = Math.max(8, Math.ceil(input.pageSize / input.stores.length) + 2)
  const liveQuery = liveSearchQuery(input.query, input.filters)
  const allSettled = await Promise.all(
    input.stores.map(async (storeId) => {
      const slot = await tryAcquireStoreSlot(storeId, STORE_FETCH_MAX[storeId] ?? 1)
      if (!slot) {
        return {
          storeId,
          hits: indexHits.filter((hit) => hit.storeId === storeId),
          error: 'throttled',
          tookMs: 0,
        } satisfies StoreSearchResult
      }
      try {
        const result = await searchStoreBatch(
          storeId,
          liveQuery,
          perStoreBatch,
          input.page,
          input.cursors?.[storeId],
          input.filters,
        )
        const failed = Boolean(result.error) && isHardStoreFailure(result.error)
        void recordStoreFetchResult(storeId, !failed)
        return result
      } finally {
        await releaseStoreSlot(storeId)
      }
    }),
  )
  const settled = allSettled.filter((result) => result.error !== 'throttled')
  const throttledStores = allSettled
    .filter((result) => result.error === 'throttled')
    .map((result) => result.storeId)

  const partials = allSettled
    .filter((result) => result.error)
    .map((result) => ({
      storeId: result.storeId,
      reason: result.error,
    }))

  const nextCursors: Partial<Record<StoreId, string>> = {}
  for (const result of settled) {
    if (result.nextCursor) nextCursors[result.storeId] = result.nextCursor
  }

  const merged = allSettled.flatMap((result) => result.hits)
  const withImages = merged.filter((hit) => Boolean(String(hit.imageUrl || '').trim()))
  const liveUsable = withImages.length > 0 ? withImages : merged
  ingestListingIndexHits(input.query, liveUsable.filter((hit) => hit.source !== 'index'), args.gateContext)
  const usable = mergeLiveHitsWithIndex(liveUsable, indexHits)
  const filtered = applyHitFilters(usable, input.filters)
  const ranked = rankHits(filtered, input.query, input.stores, input.filters)
  const liveHasMore = settled.some((result) => batchMayHaveMorePages(result, perStoreBatch, input.filters))
  const source: 'live' | 'hybrid' = throttledStores.length || (indexHits.length && liveUsable.length)
    ? 'hybrid'
    : 'live'

  return buildSearchPayload({
    hits: ranked,
    indexHits,
    settled: allSettled,
    partials,
    input,
    mode: args.mode,
    gateContext: args.gateContext,
    excludedStores: args.excludedStores,
    startedAt: args.startedAt,
    source,
    indexFresh: args.indexFresh,
    refreshPending: false,
    hasMore: liveHasMore || ranked.length >= input.pageSize,
    nextCursors,
  })
}

function payloadWasFullyThrottled(payload: SearchPayload, storeCount: number): boolean {
  if (storeCount <= 0) return false
  const throttled = (payload.partials || []).filter((part) => part.reason === 'throttled').length
  return throttled >= storeCount
}

async function persistLivePayload(
  cacheKey: string,
  payload: SearchPayload,
  cacheAllowed: boolean,
  storeCount: number,
): Promise<void> {
  if (!cacheAllowed || payloadWasFullyThrottled(payload, storeCount)) return
  setCache(cacheKey, payload)
  await setSharedCache(cacheKey, payload, 600)
}

async function runLiveWithCoordination(args: {
  cacheKey: string
  cacheAllowed: boolean
  input: Required<SearchRequest>
  indexHits: UnifiedSearchHit[]
  mode: 'admin' | 'public'
  gateContext: GateContext
  excludedStores: string[]
  startedAt: number
  indexFresh: boolean
  forceLive: boolean
}): Promise<SearchPayload> {
  if (args.cacheAllowed) {
    const memory = getCache<SearchPayload>(args.cacheKey)
    if (memory && !payloadWasFullyThrottled(memory, args.input.stores.length)) {
      return { ...memory, cacheHit: true }
    }
    const shared = await getSharedCache<SearchPayload>(args.cacheKey)
    if (shared && !payloadWasFullyThrottled(shared, args.input.stores.length)) {
      setCache(args.cacheKey, shared)
      return { ...shared, cacheHit: true }
    }
  }

  const claim = await claimInflight(args.cacheKey)
  if (claim === 'busy') {
    const waited = await waitForSharedCache<SearchPayload>(args.cacheKey, 9000)
    if (waited) {
      setCache(args.cacheKey, waited)
      return { ...waited, cacheHit: true }
    }
    if (args.indexHits.length) {
      const filtered = applyHitFilters(args.indexHits, args.input.filters)
      const ranked = rankHits(filtered, args.input.query, args.input.stores, args.input.filters)
      return buildSearchPayload({
        hits: ranked,
        indexHits: args.indexHits,
        settled: [],
        partials: [],
        input: args.input,
        mode: args.mode,
        gateContext: args.gateContext,
        excludedStores: args.excludedStores,
        startedAt: args.startedAt,
        source: 'index',
        indexFresh: args.indexFresh,
        refreshPending: true,
        hasMore: true,
      })
    }
  }

  try {
    const payload = await executeLiveSearch(args)
    await persistLivePayload(args.cacheKey, payload, args.cacheAllowed, args.input.stores.length)
    return payload
  } finally {
    if (claim !== 'busy') await finishInflight(args.cacheKey)
  }
}

function refreshLiveInBackground(args: {
  cacheKey: string
  cacheAllowed: boolean
  input: Required<SearchRequest>
  indexHits: UnifiedSearchHit[]
  mode: 'admin' | 'public'
  gateContext: GateContext
  excludedStores: string[]
  indexFresh: boolean
}): void {
  runInBackground((async () => {
    const claim = await claimInflight(args.cacheKey)
    if (claim === 'busy') return
    try {
      if (args.cacheAllowed) {
        const existing = (await getSharedCache<SearchPayload>(args.cacheKey)) || getCache<SearchPayload>(args.cacheKey)
        if (
          existing
          && existing.meta?.refreshPending !== true
          && !payloadWasFullyThrottled(existing, args.input.stores.length)
        ) return
      }
      const payload = await executeLiveSearch({
        ...args,
        startedAt: Date.now(),
      })
      await persistLivePayload(args.cacheKey, payload, args.cacheAllowed, args.input.stores.length)
    } finally {
      await finishInflight(args.cacheKey)
    }
  })())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return safeJson({ error: 'Método não suportado' }, 405)

  try {
    const body = (await req.json()) as SearchRequest
    const mode = getRequestMode(body)
    const gateContext = getGateContext(body, mode)
    const serviceRole = isServiceRoleRequest(req)
    if (mode === 'admin') {
      if (!serviceRole) {
        const denied = await requireAdmin(req)
        if (denied) return denied
      }
    } else if (!serviceRole) {
      const denied = await enforcePublicRateLimit(req)
      if (denied) return denied
    }
    if (String((body as { action?: string })?.action || '') === 'gallery') {
      const productUrl = String((body as { productUrl?: string })?.productUrl || '').trim()
      if (!productUrl) return safeJson({ error: 'URL do produto obrigatória.' }, 400)
      const storeId = String((body as { storeId?: string })?.storeId || '').trim()
      if (!(await isSourceAllowed(storeId, 'display_images', gateContext))) {
        return safeJson({ imageUrls: [], excluded: true })
      }
      const imageUrls = await fetchProductGallery(storeId, productUrl)
      return safeJson({ imageUrls })
    }

    const input = sanitizeRequest(body, mode)

    if (!input.query || input.query.length < 2) {
      return safeJson({ error: 'Informe ao menos 2 caracteres para buscar.' }, 400)
    }

    const { allowed: allowedStores, excluded: excludedStores } = await partitionAllowedSources(
      input.stores,
      'search',
      gateContext,
    )
    input.stores = allowedStores

    if (!input.stores.length) {
      return safeJson({
        results: [],
        meta: {
          mode,
          context: gateContext,
          query: input.query,
          stores: [],
          excludedStores,
          totalEstimated: null,
          page: input.page,
          pageSize: input.pageSize,
          filters: input.filters,
          hasMore: false,
          tookMs: 0,
          strategy: buildSystemStrategyMeta(),
          source: 'index',
          indexFresh: false,
          refreshPending: false,
        },
        partials: [],
        cacheHit: false,
      })
    }

    const { excluded: cacheExcludedStores } = await partitionAllowedSources(input.stores, 'cache', gateContext)
    const cacheAllowed = cacheExcludedStores.length === 0

    const cacheKey = buildCacheKey({
      mode,
      context: gateContext,
      q: input.query.toLowerCase(),
      stores: input.stores,
      page: input.page,
      pageSize: input.pageSize,
      cursors: input.cursors,
      filters: compactFiltersForCache(input.filters),
    })

    const startedAt = Date.now()
    const forceLive = Boolean(input.forceLive) || input.page > 1
    void incrementQueryStat(input.query, input.stores)

    const indexHits = input.page > 1
      ? []
      : await searchListingIndexHits(input.query, input.stores, input.filters, input.pageSize)
    const sufficiency = evaluateIndexSufficiency(indexHits, input.pageSize)

    if (!forceLive && sufficiency.sufficient) {
      const filtered = applyHitFilters(indexHits, input.filters)
      const ranked = rankHits(filtered, input.query, input.stores, input.filters)
      const payload = buildSearchPayload({
        hits: ranked,
        indexHits,
        settled: [],
        partials: [],
        input,
        mode,
        gateContext,
        excludedStores,
        startedAt,
        source: 'index',
        indexFresh: sufficiency.indexFresh,
        refreshPending: true,
        hasMore: true,
      })
      refreshLiveInBackground({
        cacheKey,
        cacheAllowed,
        input,
        indexHits,
        mode,
        gateContext,
        excludedStores,
        indexFresh: sufficiency.indexFresh,
      })
      return safeJson(payload)
    }

    const payload = await runLiveWithCoordination({
      cacheKey,
      cacheAllowed,
      input,
      indexHits,
      mode,
      gateContext,
      excludedStores,
      startedAt,
      indexFresh: sufficiency.indexFresh,
      forceLive,
    })
    return safeJson(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado'
    return safeJson({ error: message }, 500)
  }
})

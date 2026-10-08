import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

function serviceClient(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
  const client = serviceClient()
  if (!client) return null
  try {
    const { data, error } = await client.rpc(name, args)
    if (error) return null
    return data as T
  } catch {
    return null
  }
}

export async function consumeSharedRateLimit(ip: string): Promise<boolean | null> {
  const allowed = await rpc<boolean>('consume_search_rate_limit', {
    p_ip: ip || 'unknown',
    p_ip_max: 200,
    p_global_max: 1500,
    p_window_seconds: 600,
  })
  if (allowed == null) return null
  return Boolean(allowed)
}

export async function getSharedCache<T>(cacheKey: string): Promise<T | null> {
  const payload = await rpc<T>('get_search_request_cache', { p_cache_key: cacheKey })
  return payload == null ? null : payload
}

export async function setSharedCache(cacheKey: string, payload: unknown, ttlSeconds = 600): Promise<void> {
  await rpc('set_search_request_cache', {
    p_cache_key: cacheKey,
    p_payload: payload,
    p_ttl_seconds: ttlSeconds,
  })
}

export async function claimInflight(cacheKey: string, ttlSeconds = 45): Promise<'acquired' | 'busy' | 'unavailable'> {
  const acquired = await rpc<boolean>('claim_search_inflight', {
    p_cache_key: cacheKey,
    p_ttl_seconds: ttlSeconds,
  })
  if (acquired == null) return 'unavailable'
  return acquired ? 'acquired' : 'busy'
}

export async function finishInflight(cacheKey: string): Promise<void> {
  await rpc('finish_search_inflight', { p_cache_key: cacheKey })
}

export async function waitForSharedCache<T>(cacheKey: string, timeoutMs = 9000): Promise<T | null> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const cached = await getSharedCache<T>(cacheKey)
    if (cached) return cached
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return null
}

export async function tryAcquireStoreSlot(storeId: string, max: number): Promise<boolean> {
  const ok = await rpc<boolean>('try_acquire_store_slot', {
    p_store_id: storeId,
    p_max: max,
  })
  return ok == null ? true : Boolean(ok)
}

export async function releaseStoreSlot(storeId: string): Promise<void> {
  await rpc('release_store_slot', { p_store_id: storeId })
}

export async function recordStoreFetchResult(storeId: string, ok: boolean): Promise<void> {
  await rpc('record_store_fetch_result', {
    p_store_id: storeId,
    p_ok: ok,
    p_fail_threshold: 3,
    p_skip_seconds: 600,
  })
}

export async function incrementQueryStat(query: string, stores: string[]): Promise<void> {
  await rpc('increment_search_query_stat', {
    p_query: query,
    p_stores: stores,
  })
}

export function isServiceRoleRequest(req: Request): boolean {
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() || ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return Boolean(jwt && key && jwt === key)
}

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { applyHitFilters, type CatalogSearchFilters } from './filters.ts'
import type { GateContext } from '../_shared/marketSourceGate.ts'
import type { StoreId, UnifiedSearchHit } from './types.ts'

const STORE_NAMES: Record<StoreId, string> = {
  amazon: 'Amazon JP',
  rakuma: 'Rakuma',
  mercari: 'Mercari',
  yahoo: 'Yahoo Auctions',
  yahoo_flea: 'Yahoo Flea',
  snkrdunk: 'SNKRDUNK',
}

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function gateContextForMode(context: string | undefined): 'legacy_public' | 'legacy_admin' | 'collector' {
  if (context === 'collector') return 'collector'
  if (context === 'legacy_admin') return 'legacy_admin'
  return 'legacy_public'
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter((item) => /^https?:\/\//i.test(item))
}

export function listingIndexHitKey(hit: { productUrl?: string; external_url?: string } | null): string {
  const raw = String(hit?.productUrl || hit?.external_url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    parsed.hash = ''
    parsed.search = ''
    return parsed.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return raw.toLowerCase()
  }
}

export function mergeLiveHitsWithIndex(
  liveHits: UnifiedSearchHit[],
  indexHits: UnifiedSearchHit[],
): UnifiedSearchHit[] {
  const seen = new Set<string>()
  const out: UnifiedSearchHit[] = []
  for (const hit of [...liveHits, ...indexHits]) {
    const key = listingIndexHitKey(hit)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(hit)
  }
  return out
}

function rowToHit(row: Record<string, unknown>): UnifiedSearchHit | null {
  const storeId = String(row.store_id || row.storeId || '') as StoreId
  const productUrl = String(row.external_url || row.productUrl || '').trim()
  const title = String(row.title || '').trim()
  if (!STORE_NAMES[storeId] || !productUrl || !title) return null
  const imageUrls = asStringArray(row.image_urls ?? row.imageUrls)
  const imageUrl = String(row.image_url || row.imageUrl || imageUrls[0] || '').trim() || null
  const price = Number(row.price_jpy ?? row.price)
  return {
    id: `index-${storeId}-${listingIndexHitKey({ productUrl })}`,
    title,
    price: Number.isFinite(price) && price > 0 ? price : null,
    currency: String(row.currency || 'JPY').toUpperCase(),
    imageUrl,
    imageUrls: imageUrl && !imageUrls.includes(imageUrl) ? [imageUrl, ...imageUrls] : imageUrls,
    productUrl,
    storeId,
    storeName: STORE_NAMES[storeId],
    source: 'index',
    tags: Array.isArray(row.tags)
      ? row.tags.map((tag) => String(tag || '').trim()).filter(Boolean) as UnifiedSearchHit['tags']
      : undefined,
    fetchedAt: String(row.last_seen_at || new Date().toISOString()),
  }
}

export async function searchListingIndexHits(
  query: string,
  stores: StoreId[],
  filters: CatalogSearchFilters,
  limit: number,
): Promise<UnifiedSearchHit[]> {
  const client = serviceClient()
  if (!client) return []
  try {
    const { data, error } = await client.rpc('search_listing_index', {
      p_query: query,
      p_stores: stores,
      p_limit: Math.max(6, Math.min(limit, 48)),
    })
    if (error || !Array.isArray(data)) return []
    const hits = data.map((row) => rowToHit(row as Record<string, unknown>)).filter(Boolean) as UnifiedSearchHit[]
    return applyHitFilters(hits, filters)
  } catch {
    return []
  }
}

export function ingestListingIndexHits(
  query: string,
  hits: UnifiedSearchHit[],
  context: GateContext | string,
): void {
  const client = serviceClient()
  if (!client || !hits.length) return
  const rows = hits.map((hit) => ({
    storeId: hit.storeId,
    productUrl: hit.productUrl,
    title: hit.title,
    price: hit.price,
    currency: hit.currency,
    imageUrl: hit.imageUrl,
    imageUrls: hit.imageUrls || [],
    tags: hit.tags || [],
  }))
  void client.rpc('upsert_listing_index', {
    p_rows: rows,
    p_query: query,
    p_context: gateContextForMode(String(context)),
    p_acquisition: 'live_search',
  }).then(() => undefined, () => undefined)
}

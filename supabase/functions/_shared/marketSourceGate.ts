import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  decidePermission,
  resolveSourceIdByHost,
  type GateContext,
  type GateOperation,
  type MarketSourceRow,
} from './marketSourcePolicy.ts'

export type { GateContext, GateOperation } from './marketSourcePolicy.ts'

const REGISTRY_TTL_MS = 60_000
const REGISTRY_TIMEOUT_MS = 2_500

let cached: { loadedAt: number; registry: Map<string, MarketSourceRow> | null } | null = null
let inflight: Promise<Map<string, MarketSourceRow> | null> | null = null

async function fetchRegistry(): Promise<Map<string, MarketSourceRow> | null> {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !serviceKey) return null
  try {
    const client = createClient(url, serviceKey, { auth: { persistSession: false } })
    const query = client
      .from('market_sources')
      .select(
        'id, enabled, review_status, can_search_automated, can_display_price, can_display_images, max_cache_hours, can_link, can_purchase_sourcing, can_automate_snapshots, legacy_search_allowed, legacy_automation_allowed, hosts',
      )
    const timeout = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('registry timeout') }), REGISTRY_TIMEOUT_MS)
    )
    const { data, error } = await Promise.race([query, timeout])
    if (error || !Array.isArray(data)) return null
    const map = new Map<string, MarketSourceRow>()
    for (const row of data as MarketSourceRow[]) map.set(row.id, row)
    return map
  } catch {
    return null
  }
}

/** Returns the registry (cached for 60s) or null when it cannot be read. */
export async function getMarketSourceRegistry(): Promise<Map<string, MarketSourceRow> | null> {
  const now = Date.now()
  if (cached && now - cached.loadedAt < REGISTRY_TTL_MS) return cached.registry
  if (!inflight) {
    inflight = fetchRegistry().finally(() => {
      inflight = null
    })
  }
  const registry = await inflight
  cached = { loadedAt: Date.now(), registry }
  return registry
}

export async function isSourceAllowed(
  sourceId: string,
  operation: GateOperation,
  context: GateContext,
): Promise<boolean> {
  const registry = await getMarketSourceRegistry()
  return decidePermission(registry, sourceId, operation, context)
}

export async function partitionAllowedSources<T extends string>(
  sourceIds: T[],
  operation: GateOperation,
  context: GateContext,
): Promise<{ allowed: T[]; excluded: T[] }> {
  const registry = await getMarketSourceRegistry()
  const allowed: T[] = []
  const excluded: T[] = []
  for (const id of sourceIds) {
    if (decidePermission(registry, id, operation, context)) allowed.push(id)
    else excluded.push(id)
  }
  return { allowed, excluded }
}

export async function resolveSourceForHost(hostname: string): Promise<string | null> {
  const registry = await getMarketSourceRegistry()
  return resolveSourceIdByHost(registry, hostname)
}

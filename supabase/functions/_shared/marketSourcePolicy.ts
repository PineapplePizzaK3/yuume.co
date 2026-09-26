// Pure permission policy for market sources. Mirrors public.market_source_allows() (migration 151);
// keep both in sync. No runtime dependencies so it can run in Deno edge functions and in vitest.

export type GateContext = 'legacy_public' | 'legacy_admin' | 'collector' | 'snapshot_job'

export type GateOperation =
  | 'search'
  | 'display_price'
  | 'display_images'
  | 'cache'
  | 'link'
  | 'purchase_sourcing'
  | 'snapshot'
  | 'automation'

export type MarketSourceRow = {
  id: string
  enabled: boolean
  review_status: 'unreviewed' | 'in_review' | 'cleared' | 'rejected'
  can_search_automated: boolean
  can_display_price: boolean
  can_display_images: boolean
  max_cache_hours: number
  can_link: boolean
  can_purchase_sourcing: boolean
  can_automate_snapshots: boolean
  legacy_search_allowed: boolean
  legacy_automation_allowed: boolean
  hosts?: string[] | null
}

export function isLegacyContext(context: GateContext): boolean {
  return context === 'legacy_public' || context === 'legacy_admin'
}

export function evaluateSourcePermission(
  row: MarketSourceRow | undefined | null,
  operation: GateOperation,
  context: GateContext,
): boolean {
  if (!row || !row.enabled) return false

  if (operation === 'link') return row.can_link
  if (operation === 'purchase_sourcing') return row.can_purchase_sourcing

  if (isLegacyContext(context)) {
    switch (operation) {
      case 'search':
        return row.can_search_automated || row.legacy_search_allowed
      case 'display_price':
        return row.can_display_price || row.legacy_search_allowed
      case 'display_images':
        return row.can_display_images || row.legacy_search_allowed
      case 'cache':
        return row.max_cache_hours > 0 || row.legacy_search_allowed
      case 'automation':
        return row.can_automate_snapshots || row.legacy_automation_allowed
      default:
        return false
    }
  }

  if (row.review_status !== 'cleared') return false

  switch (operation) {
    case 'search':
      return row.can_search_automated
    case 'display_price':
      return row.can_display_price
    case 'display_images':
      return row.can_display_images
    case 'cache':
      return row.max_cache_hours > 0
    case 'snapshot':
      return row.can_automate_snapshots && row.max_cache_hours > 0
    case 'automation':
      return row.can_automate_snapshots
    default:
      return false
  }
}

/**
 * Decision when the registry cannot be read or has no row for the source.
 * Legacy contexts keep pre-registry behavior (allowed) so production flows never break because of the
 * registry; collector and snapshot contexts fail closed.
 */
export function fallbackPermission(context: GateContext, operation: GateOperation): boolean {
  if (!isLegacyContext(context)) return false
  return operation !== 'snapshot'
}

export function decidePermission(
  registry: Map<string, MarketSourceRow> | null,
  sourceId: string,
  operation: GateOperation,
  context: GateContext,
): boolean {
  if (!registry) return fallbackPermission(context, operation)
  const row = registry.get(sourceId)
  if (!row) return fallbackPermission(context, operation)
  return evaluateSourcePermission(row, operation, context)
}

export function normalizeHost(hostname: string): string {
  return String(hostname || '').trim().toLowerCase().replace(/^www\./, '')
}

/** Maps a URL hostname to a registry source id using each row's `hosts` list (suffix match). */
export function resolveSourceIdByHost(
  registry: Map<string, MarketSourceRow> | null,
  hostname: string,
): string | null {
  if (!registry) return null
  const host = normalizeHost(hostname)
  if (!host) return null
  for (const row of registry.values()) {
    for (const candidate of row.hosts ?? []) {
      const h = normalizeHost(candidate)
      if (h && (host === h || host.endsWith(`.${h}`))) return row.id
    }
  }
  return null
}

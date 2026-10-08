import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { supabase } from '../lib/supabase'
import { buildLinkOutUrl, buildMarketQuery, classifyMatch } from '../lib/market/marketQuery'
import { listPublicMarketSources } from './marketSourceService'
import { searchCatalogCollector } from './catalogSearchService'

/**
 * Contextual Japan market for a catalog item.
 * Until D1 clears API sources, collector context only surfaces own_stock + link-outs + sourcing CTA.
 */
export async function findInJapanForItem(item, { limit = 12 } = {}) {
  if (!item?.id) return { data: null, error: toServiceError(new Error('Item inválido')) }

  const queryBuilt = buildMarketQuery({
    nameJa: item.name_ja || item.nameJa,
    number: item.number,
    setCode: item.set?.set_code || item.set_code || item.setCode,
  })

  const sourcesRes = await listPublicMarketSources()
  const sources = Array.isArray(sourcesRes.data) ? sourcesRes.data : []

  const linkOuts = sources
    .filter((s) => s.can_link && s.search_url_template)
    .map((s) => ({
      sourceId: s.id,
      displayName: s.display_name || s.id,
      url: buildLinkOutUrl(s.search_url_template, queryBuilt.positive || queryBuilt.query),
    }))
    .filter((s) => s.url)

  const canPurchase = sources.some((s) => s.can_purchase_sourcing)

  let hits = []
  let searchError = null
  const searchable = sources.filter((s) => s.can_search_automated).map((s) => s.id)
  if (searchable.length > 0 && queryBuilt.positive) {
    const searchRes = await searchCatalogCollector({
      query: queryBuilt.positive,
      stores: searchable,
      pageSize: limit,
      catalogItemId: item.id,
    })
    if (searchRes.error) searchError = searchRes.error
    const raw = Array.isArray(searchRes.data?.results)
      ? searchRes.data.results
      : Array.isArray(searchRes.data?.items)
        ? searchRes.data.items
        : Array.isArray(searchRes.data)
          ? searchRes.data
          : []
    hits = raw.map((hit) => ({
      ...hit,
      matchQuality: classifyMatch(hit, item),
    }))
  }

  let snapshot = null
  try {
    const { data } = await withDbTimeout(
      supabase
        .from('market_snapshots_valid')
        .select('*')
        .eq('catalog_item_id', item.id)
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
    snapshot = data || null
  } catch {
    snapshot = null
  }

  return {
    data: {
      query: queryBuilt,
      hits,
      linkOuts,
      canPurchase,
      snapshot,
      searchError: searchError?.message || null,
    },
    error: null,
  }
}

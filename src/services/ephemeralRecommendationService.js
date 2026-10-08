import { rankEphemeralRecommendations } from '../lib/ephemeralRecommendations'
import { readCatalogSearchSession } from '../lib/catalogSearchSession'
import { mergeLiveHitsWithIndex } from '../lib/listingIndex.js'
import { searchListingIndex } from './listingIndexService.js'

/**
 * Similar listings from the current search session, filled by the listing index.
 * Does not call live catalog-search.
 */
export async function getEphemeralListingRecommendations(product, { limit = 8 } = {}) {
  const session = readCatalogSearchSession()
  const sessionHits = Array.isArray(session?.results) ? session.results : []
  const sessionQuery = String(session?.query || '').trim()
  const query = sessionQuery.length >= 2 ? sessionQuery : String(product?.title || '').trim()
  const stores = Array.isArray(session?.selectedStores) ? session.selectedStores : []
  const { data: indexHits } = await searchListingIndex({
    query,
    stores,
    limit: Math.max(limit * 3, 16),
  })
  const hits = mergeLiveHitsWithIndex(sessionHits, indexHits)
  const ranked = rankEphemeralRecommendations(hits, product, { limit })
  return { data: ranked, error: null }
}

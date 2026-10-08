import type { CatalogSearchFilters } from './filters.ts'

export type StoreId = 'amazon' | 'rakuma' | 'mercari' | 'yahoo' | 'yahoo_flea' | 'snkrdunk'

export type CatalogHitTag = 'auction' | 'sold' | 'unavailable'

export interface SearchRequest {
  query: string
  stores?: StoreId[]
  page?: number
  pageSize?: number
  mode?: 'admin' | 'public'
  /** 'legacy' (default) keeps grandfathered sources; 'collector' only uses sources cleared in market_sources. */
  context?: 'legacy' | 'collector'
  /** Cursores de paginação por loja (ex.: nextPageToken do Mercari). */
  cursors?: Partial<Record<StoreId, string>>
  filters?: Partial<CatalogSearchFilters>
  /** Skip index-first and wait for live (load-more, background refresh). */
  forceLive?: boolean
}

export interface UnifiedSearchHit {
  id: string
  title: string
  price: number | null
  currency: string
  imageUrl: string | null
  /** Fotos do anúncio, da capa até as extras. A capa continua em imageUrl. */
  imageUrls?: string[]
  productUrl: string
  storeId: StoreId
  storeName: string
  source: 'html' | 'jina' | 'mixed' | 'index'
  score?: number
  tags?: CatalogHitTag[]
  auctionCurrentBidPrice?: number | null
  auctionBuyoutPrice?: number | null
  fetchedAt: string
}

export interface StoreSearchResult {
  storeId: StoreId
  hits: UnifiedSearchHit[]
  error?: string
  tookMs: number
  nextCursor?: string
}

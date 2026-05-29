export type StoreId = 'amazon' | 'rakuma' | 'mercari' | 'yahoo' | 'yahoo_flea' | 'snkrdunk'

export type CatalogHitTag = 'auction' | 'sold' | 'unavailable'

export interface SearchRequest {
  query: string
  stores?: StoreId[]
  page?: number
  pageSize?: number
  mode?: 'admin' | 'public'
  /** Cursores de paginação por loja (ex.: nextPageToken do Mercari). */
  cursors?: Partial<Record<StoreId, string>>
}

export interface UnifiedSearchHit {
  id: string
  title: string
  price: number | null
  currency: string
  imageUrl: string | null
  productUrl: string
  storeId: StoreId
  storeName: string
  source: 'html' | 'jina' | 'mixed'
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

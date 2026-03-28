export type StoreId = 'amazon' | 'rakuma' | 'mercari'

export interface SearchRequest {
  query: string
  stores?: StoreId[]
  page?: number
  pageSize?: number
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
  fetchedAt: string
}

export interface StoreSearchResult {
  storeId: StoreId
  hits: UnifiedSearchHit[]
  error?: string
  tookMs: number
}

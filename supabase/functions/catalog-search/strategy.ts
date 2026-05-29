import type { StoreId, StoreSearchResult } from './types.ts'

type StoreIntegrationModel = {
  sourceModel: 'public_web_fetch'
  officialPartner: boolean
  currentSearchMode: 'realtime_parse'
  targetSearchMode: 'ingestion_index'
  notes: string
}

const STORE_MODEL: Record<StoreId, StoreIntegrationModel> = {
  amazon: {
    sourceModel: 'public_web_fetch',
    officialPartner: false,
    currentSearchMode: 'realtime_parse',
    targetSearchMode: 'ingestion_index',
    notes: 'Resultados podem variar por mudanças de HTML e anti-bot.',
  },
  rakuma: {
    sourceModel: 'public_web_fetch',
    officialPartner: false,
    currentSearchMode: 'realtime_parse',
    targetSearchMode: 'ingestion_index',
    notes: 'Páginas dinâmicas podem reduzir cobertura e consistência.',
  },
  mercari: {
    sourceModel: 'public_web_fetch',
    officialPartner: false,
    currentSearchMode: 'realtime_parse',
    targetSearchMode: 'ingestion_index',
    notes: 'Busca primária via API web (DPoP); HTML/Jina só como fallback.',
  },
  yahoo: {
    sourceModel: 'public_web_fetch',
    officialPartner: false,
    currentSearchMode: 'realtime_parse',
    targetSearchMode: 'ingestion_index',
    notes: 'Yahoo Auctions via parsing de busca pública; sujeito a variações de markup.',
  },
  yahoo_flea: {
    sourceModel: 'public_web_fetch',
    officialPartner: false,
    currentSearchMode: 'realtime_parse',
    targetSearchMode: 'ingestion_index',
    notes: 'Yahoo Flea Market (PayPayフリマ) via parsing web público; pode variar por sessão/região.',
  },
  snkrdunk: {
    sourceModel: 'public_web_fetch',
    officialPartner: false,
    currentSearchMode: 'realtime_parse',
    targetSearchMode: 'ingestion_index',
    notes: 'SNKRDUNK via busca pública (sneakers, streetwear e apparels); markup Next.js pode variar.',
  },
}

export function buildSystemStrategyMeta() {
  return {
    currentSystemMode: 'pilot_realtime_parse',
    targetSystemMode: 'hybrid_ingestion_index',
    benchmarkModel: 'partner_integrated_proxy',
    architectureDecision:
      'Priorizar ingestão assíncrona + índice próprio, mantendo parsing em tempo real apenas como fallback.',
  }
}

export function buildStoreDiagnostics(stores: StoreId[], settled: StoreSearchResult[]) {
  return stores.map((storeId) => {
    const result = settled.find((row) => row.storeId === storeId)
    return {
      storeId,
      model: STORE_MODEL[storeId],
      hitCount: result?.hits?.length ?? 0,
      tookMs: result?.tookMs ?? null,
      status: result?.error ? 'partial_error' : 'ok',
      error: result?.error ?? null,
    }
  })
}

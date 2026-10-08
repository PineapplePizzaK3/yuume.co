import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  CATALOG_CATEGORIES,
  CATALOG_CONDITIONS,
  catalogFiltersAreDefault,
  DEFAULT_CATALOG_FILTERS,
} from '../lib/catalogSearchFilters'

export const CATALOG_STORE_OPTIONS = [
  { id: 'amazon', label: 'Amazon JP' },
  { id: 'rakuma', label: 'Rakuma' },
  { id: 'mercari', label: 'Mercari' },
  { id: 'yahoo', label: 'Yahoo Auctions' },
  { id: 'yahoo_flea', label: 'Yahoo Flea Market' },
  { id: 'snkrdunk', label: 'SNKRDUNK' },
]

/** Public search starts on Mercari + Yahoo; the rest stay off until the user enables them. */
export const DEFAULT_ENABLED_CATALOG_STORE_IDS = ['mercari', 'yahoo', 'yahoo_flea']

export function defaultCatalogStoreSelection(storeIdFromUrl = '') {
  const storeId = String(storeIdFromUrl || '').trim()
  const known = CATALOG_STORE_OPTIONS.some((store) => store.id === storeId)
  const onlyOne = Boolean(storeId && storeId !== 'all' && known)
  const enableAll = storeId === 'all'
  return CATALOG_STORE_OPTIONS.reduce((acc, row) => {
    if (onlyOne) acc[row.id] = row.id === storeId
    else if (enableAll) acc[row.id] = true
    else acc[row.id] = DEFAULT_ENABLED_CATALOG_STORE_IDS.includes(row.id)
    return acc
  }, {})
}

export function catalogStoreBrand(storeId) {
  const map = {
    amazon: { label: 'Amazon JP', logo: 'https://www.google.com/s2/favicons?domain=www.amazon.co.jp&sz=64' },
    rakuma: { label: 'Rakuma', logo: 'https://www.google.com/s2/favicons?domain=rakuma.rakuten.co.jp&sz=64' },
    mercari: { label: 'Mercari', logo: 'https://www.google.com/s2/favicons?domain=jp.mercari.com&sz=64' },
    yahoo: { label: 'Yahoo Auctions', logo: 'https://www.google.com/s2/favicons?domain=auctions.yahoo.co.jp&sz=64' },
    yahoo_flea: {
      label: 'Yahoo Flea Market',
      logo: 'https://www.google.com/s2/favicons?domain=paypayfleamarket.yahoo.co.jp&sz=64',
    },
    snkrdunk: {
      label: 'SNKRDUNK',
      logo: 'https://www.google.com/s2/favicons?domain=snkrdunk.com&sz=64',
    },
  }
  return map[storeId] || { label: 'Loja externa', logo: null }
}

function itemTags(item) {
  return Array.isArray(item?.tags) ? item.tags : []
}

function isAuctionItem(item) {
  return itemTags(item).includes('auction')
}

function isSoldOrUnavailable(item) {
  const tags = itemTags(item)
  return tags.includes('sold') || tags.includes('unavailable')
}

function SearchBusyMark() {
  return (
    <svg className="h-4 w-4 animate-spin text-earth-800" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  )
}

function formatAuctionPrice(price, currency, formatExternalPrice) {
  if (price == null || Number.isNaN(Number(price))) return '----'
  return formatExternalPrice(price, currency)
}

export default function CatalogSearchPanel({
  headerTitle,
  headerSubtitle,
  headerBadge,
  query,
  setQuery,
  onSubmit,
  loading,
  loadingMore,
  stores,
  toggleStore,
  error,
  meta,
  partials,
  results,
  canAutoLoad,
  loadMore,
  formatExternalPrice,
  inputPlaceholder,
  searchButtonLabel = 'Buscar',
  loadingButtonLabel = 'Buscando...',
  showStrategyBox = false,
  showDiagnostics = false,
  showStoreFilters = true,
  emptyLabel = 'Nenhum resultado encontrado com os filtros atuais.',
  loadingLabel = 'Consultando lojas externas...',
  loadingMoreLabel = 'Carregando mais resultados...',
  autoLoadHintLabel = 'Role para carregar mais resultados.',
  endOfResultsLabel = 'Fim dos resultados disponiveis para esta busca.',
  storesLabel = 'Lojas:',
  showTotals = true,
  statusMessage = '',
  pendingResultUrl = '',
  onPrepareResultHref,
  onResultClick,
  buildResultHref,
  resultTarget = '_blank',
  resultRel = 'noopener noreferrer',
  filters = DEFAULT_CATALOG_FILTERS,
  setFilters,
  isEn = false,
  showListingFilters = true,
  refreshingLabel = 'Atualizando resultados...',
  moreResultsLabel = 'Mais resultados',
}) {
  const loadMoreSentinelRef = useRef(null)
  const loadMoreRef = useRef(loadMore)
  const loadingRef = useRef(loading)
  const loadingMoreRef = useRef(loadingMore)
  loadMoreRef.current = loadMore
  loadingRef.current = loading
  loadingMoreRef.current = loadingMore
  const showInfiniteScroll = results.length > 0
  const [brokenImages, setBrokenImages] = useState(() => new Set())
  const visibleResults = useMemo(() => {
    const list = Array.isArray(results) ? results : []
    return list.filter((item) => {
      const url = String(item?.imageUrl || '').trim()
      if (!url || !/^https?:\/\//i.test(url)) return false
      if (brokenImages.has(url)) return false
      return true
    })
  }, [results, brokenImages])

  useEffect(() => {
    setBrokenImages(new Set())
  }, [meta?.query, meta?.page])

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel || results.length === 0 || !canAutoLoad) return

    const tryLoadMore = () => {
      if (loadingRef.current || loadingMoreRef.current) return
      if (typeof loadMoreRef.current !== 'function') return
      loadMoreRef.current()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) tryLoadMore()
      },
      { root: null, rootMargin: '240px 0px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [results.length, canAutoLoad, meta?.page])

  useEffect(() => {
    if (loading || loadingMore || !canAutoLoad || results.length === 0) return
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel) return
    const rect = sentinel.getBoundingClientRect()
    if (rect.top < (typeof window !== 'undefined' ? window.innerHeight : 0) + 240) {
      loadMoreRef.current?.()
    }
  }, [loading, loadingMore, canAutoLoad, results.length, meta?.page])

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">{headerTitle}</h2>
          <p className="mt-1 text-sm text-earth-600">{headerSubtitle}</p>
        </div>
        {headerBadge ? <div className="text-xs text-earth-500">{headerBadge}</div> : null}
      </div>

      <form onSubmit={onSubmit} className="mt-4 rounded-lg border border-earth-200 bg-white p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={inputPlaceholder}
              className="min-w-[240px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
            />
            <button
              type="submit"
              disabled={loading}
              className={`rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-white hover:bg-earth-900 disabled:opacity-60 ${
              loading ? 'cursor-wait' : ''
            }`}
            >
              {loading ? loadingButtonLabel : searchButtonLabel}
            </button>
          </div>

          {showStoreFilters ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-earth-700">{storesLabel}</span>
              {CATALOG_STORE_OPTIONS.map((store) => {
                const brand = catalogStoreBrand(store.id)
                const checked = !!stores?.[store.id]
                return (
                  <label
                    key={store.id}
                    title={brand.label}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                      checked
                        ? 'border-earth-400 bg-earth-100 shadow-sm'
                        : 'border-earth-200 bg-white opacity-70 hover:opacity-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStore(store.id)}
                      className="sr-only"
                      aria-label={brand.label}
                    />
                    {brand.logo ? (
                      <img
                        src={brand.logo}
                        alt=""
                        aria-hidden
                        className="h-5 w-5 rounded-sm object-contain"
                        loading="lazy"
                      />
                    ) : null}
                    <span className="text-xs text-earth-700">{brand.label}</span>
                  </label>
                )
              })}
            </div>
          ) : null}

          {showListingFilters && typeof setFilters === 'function' ? (
            <div className={`space-y-3 border-t border-earth-100 pt-3 ${loading ? 'opacity-80' : ''}`}>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-[7rem] flex-1 flex-col gap-1 text-xs text-earth-600">
                  {isEn ? 'Min price (¥)' : 'Preço mín. (¥)'}
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={filters.priceMin ?? ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        priceMin: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    className="rounded-lg border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
                <label className="flex min-w-[7rem] flex-1 flex-col gap-1 text-xs text-earth-600">
                  {isEn ? 'Max price (¥)' : 'Preço máx. (¥)'}
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={filters.priceMax ?? ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        priceMax: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    className="rounded-lg border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
                <label className="flex min-w-[10rem] flex-[1.2] flex-col gap-1 text-xs text-earth-600">
                  {isEn ? 'Sort' : 'Ordenar'}
                  <select
                    value={filters.sort}
                    onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
                    className="rounded-lg border border-earth-300 bg-white px-2 py-1.5 text-sm text-earth-900"
                  >
                    <option value="relevance">{isEn ? 'Relevance' : 'Relevância'}</option>
                    <option value="newest">{isEn ? 'Newest' : 'Mais recentes'}</option>
                    <option value="price_asc">{isEn ? 'Lowest price' : 'Menor preço'}</option>
                    <option value="price_desc">{isEn ? 'Highest price' : 'Maior preço'}</option>
                  </select>
                </label>
                <label className="flex min-w-[10rem] flex-[1.2] flex-col gap-1 text-xs text-earth-600">
                  {isEn ? 'Sale type' : 'Tipo de venda'}
                  <select
                    value={filters.saleType}
                    onChange={(e) => setFilters((prev) => ({ ...prev, saleType: e.target.value }))}
                    className="rounded-lg border border-earth-300 bg-white px-2 py-1.5 text-sm text-earth-900"
                  >
                    <option value="any">{isEn ? 'Any' : 'Qualquer'}</option>
                    <option value="fixed">{isEn ? 'Buy now' : 'Preço fixo'}</option>
                    <option value="auction">{isEn ? 'Auction' : 'Leilão'}</option>
                  </select>
                </label>
                <label className="flex min-w-[10rem] flex-[1.2] flex-col gap-1 text-xs text-earth-600">
                  {isEn ? 'Category' : 'Categoria'}
                  <select
                    value={filters.category || 'any'}
                    onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                    className="rounded-lg border border-earth-300 bg-white px-2 py-1.5 text-sm text-earth-900"
                  >
                    {CATALOG_CATEGORIES.map((id) => {
                      const labels = {
                        any: isEn ? 'Any' : 'Qualquer',
                        tcg: isEn ? 'TCG / cards' : 'TCG / cartas',
                        sneakers: isEn ? 'Sneakers' : 'Tênis',
                        figures: isEn ? 'Figures' : 'Figures',
                        apparel: isEn ? 'Apparel' : 'Roupas',
                      }
                      return (
                        <option key={id} value={id}>
                          {labels[id]}
                        </option>
                      )
                    })}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-earth-700">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={filters.onSaleOnly}
                    onChange={(e) => setFilters((prev) => ({ ...prev, onSaleOnly: e.target.checked }))}
                  />
                  {isEn ? 'On sale only' : 'Somente à venda'}
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={filters.sellerPaysShipping}
                    onChange={(e) => setFilters((prev) => ({ ...prev, sellerPaysShipping: e.target.checked }))}
                  />
                  {isEn ? 'Seller pays shipping' : 'Frete pelo vendedor'}
                </label>
                <span className="font-medium text-earth-600">{isEn ? 'Condition:' : 'Condição:'}</span>
                {CATALOG_CONDITIONS.map((id) => {
                  const labels = {
                    new: isEn ? 'New' : 'Novo',
                    good: isEn ? 'Good condition' : 'Bom estado',
                    used: isEn ? 'Signs of use' : 'Com marcas de uso',
                  }
                  const checked = (filters.conditions || []).includes(id)
                  return (
                    <label key={id} className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setFilters((prev) => {
                            const current = Array.isArray(prev.conditions) ? prev.conditions : []
                            return {
                              ...prev,
                              conditions: checked
                                ? current.filter((item) => item !== id)
                                : [...current, id],
                            }
                          })
                        }
                      />
                      {labels[id]}
                    </label>
                  )
                })}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-earth-600">
                  {isEn ? 'Brand' : 'Marca'}
                  <input
                    type="text"
                    value={filters.brand || ''}
                    onChange={(e) => setFilters((prev) => ({ ...prev, brand: e.target.value }))}
                    placeholder={isEn ? 'Nike, Pokémon…' : 'Nike, Pokémon…'}
                    className="rounded-lg border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-earth-600">
                  {isEn ? 'Exclude words' : 'Excluir palavras'}
                  <input
                    type="text"
                    value={filters.excludeKeywords}
                    onChange={(e) => setFilters((prev) => ({ ...prev, excludeKeywords: e.target.value }))}
                    placeholder={isEn ? 'PSA, オリパ, まとめ…' : 'PSA, オリパ, まとめ…'}
                    className="rounded-lg border border-earth-300 px-2 py-1.5 text-sm text-earth-900"
                  />
                </label>
                {!catalogFiltersAreDefault(filters) ? (
                  <button
                    type="button"
                    onClick={() => setFilters({ ...DEFAULT_CATALOG_FILTERS, conditions: [] })}
                    className="rounded-lg border border-earth-300 px-3 py-1.5 text-xs font-medium text-earth-700 hover:bg-earth-50"
                  >
                    {isEn ? 'Clear filters' : 'Limpar filtros'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </form>

      {statusMessage ? (
        <div className="mt-3 rounded-lg border border-earth-200 bg-white px-3 py-2 text-sm text-earth-700">{statusMessage}</div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-800 shadow-sm"
          role="status"
          aria-live="polite"
        >
          <SearchBusyMark />
          <span>{visibleResults.length > 0 ? refreshingLabel : loadingLabel}</span>
        </div>
      ) : null}

      {meta && showTotals ? (
        <div className="mt-3 text-xs text-earth-600">
          {visibleResults.length} exibidos
          {meta.totalEstimated != null ? ` de ${meta.totalEstimated} estimados` : ''}
          {' • '}
          {meta.tookMs ?? 0}ms na ultima consulta
          {loading ? (isEn ? ' • updating…' : ' • atualizando…') : ''}
        </div>
      ) : null}

      {!loading && showStrategyBox && meta?.strategy ? (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <strong>Modo atual:</strong>{' '}
          {meta.strategy.currentSystemMode === 'hybrid_ingestion_index'
            ? (isEn
              ? 'hybrid: recent listing index + live marketplace parse.'
              : 'híbrido: índice recente + parsing ao vivo das lojas.')
            : (isEn
              ? 'live marketplace parse (pilot).'
              : 'busca em tempo real com parsing de páginas públicas (piloto).')}{' '}
          <strong>{isEn ? 'Next:' : 'Direção:'}</strong>{' '}
          {isEn
            ? 'keep ingesting into the index; live parse stays the fallback.'
            : 'continuar ingerindo no índice; o parse ao vivo continua como fallback.'}
        </div>
      ) : null}

      {partials?.some((part) => part?.reason && part.reason !== 'throttled') ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {isEn
            ? `Some stores failed this time: ${partials
              .filter((part) => part?.reason && part.reason !== 'throttled')
              .map((part) => `${part.storeId} (${part.reason})`)
              .join(' | ')}`
            : `Algumas lojas falharam nesta tentativa: ${partials
              .filter((part) => part?.reason && part.reason !== 'throttled')
              .map((part) => `${part.storeId} (${part.reason})`)
              .join(' | ')}`}
        </div>
      ) : null}

      {!loading && showDiagnostics && Array.isArray(meta?.diagnostics) && meta.diagnostics.length > 0 ? (
        <div className="mt-3 rounded-lg border border-earth-200 bg-white px-3 py-2 text-xs text-earth-700">
          {meta.diagnostics.map((d) => (
            <div key={d.storeId}>
              {d.storeId}: {d.status === 'ok' ? 'ok' : 'falha parcial'} • hits {d.hitCount ?? 0} • {d.tookMs ?? 0}ms
            </div>
          ))}
        </div>
      ) : null}

      {!loading && visibleResults.length === 0 && meta ? <p className="mt-4 text-sm text-earth-600">{emptyLabel}</p> : null}

      {visibleResults.length > 0 ? (
        <div className="relative mt-4" aria-busy={loading ? 'true' : 'false'}>
          <div className={`grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${loading ? 'pointer-events-none opacity-50' : ''}`}>
          {visibleResults.map((item, index) => {
            const batch = Number(item.loadedBatch) || 0
            const prevBatch = index > 0 ? Number(visibleResults[index - 1]?.loadedBatch) || 0 : 0
            const showBatchDivider = index > 0 && batch > prevBatch
            return (
            <Fragment key={item.productUrl || item.id}>
            {showBatchDivider ? (
              <div className="col-span-full my-1 flex items-center gap-3 py-1 text-[11px] font-medium uppercase tracking-wide text-earth-500">
                <span className="h-px flex-1 bg-earth-200" aria-hidden />
                <span>{moreResultsLabel}</span>
                <span className="h-px flex-1 bg-earth-200" aria-hidden />
              </div>
            ) : null}
            <a
              href={typeof buildResultHref === 'function' ? buildResultHref(item) : item.productUrl}
              target={resultTarget}
              rel={resultRel}
              onPointerDown={() => {
                onPrepareResultHref?.(item)
              }}
              onContextMenu={() => {
                onPrepareResultHref?.(item)
              }}
              onClick={(event) => {
                // Let the browser handle new-tab / modified clicks via real href.
                if (
                  event.button !== 0
                  || event.metaKey
                  || event.ctrlKey
                  || event.shiftKey
                  || event.altKey
                ) {
                  onPrepareResultHref?.(item)
                  return
                }
                const shouldContinue = onResultClick?.(item, event)
                if (shouldContinue === false) event.preventDefault()
              }}
              className={`group flex flex-col overflow-hidden rounded-lg border border-earth-200 bg-white shadow-sm transition hover:border-earth-300 hover:shadow-md ${
                isSoldOrUnavailable(item) ? 'opacity-75' : ''
              } ${pendingResultUrl && pendingResultUrl === item.productUrl ? 'opacity-60' : ''}`}
            >
              <div className="relative h-24 w-full bg-earth-100 sm:h-52">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className={`h-full w-full object-cover transition duration-200 group-hover:scale-[1.02] ${
                    isSoldOrUnavailable(item) ? 'grayscale-[35%]' : ''
                  }`}
                  loading="lazy"
                  onError={() => {
                    const url = String(item.imageUrl || '').trim()
                    if (!url) return
                    setBrokenImages((prev) => {
                      if (prev.has(url)) return prev
                      const next = new Set(prev)
                      next.add(url)
                      return next
                    })
                  }}
                />
                {Array.isArray(item.imageUrls) && item.imageUrls.length > 1 ? (
                  <span
                    className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white sm:right-1.5 sm:top-1.5 sm:text-[10px]"
                    title={`${item.imageUrls.length} fotos`}
                  >
                    {item.imageUrls.length}
                  </span>
                ) : null}
                <div className="absolute left-1 top-1 flex flex-col gap-0.5 sm:left-1.5 sm:top-1.5 sm:gap-1">
                  {itemTags(item).includes('auction') ? (
                    <span className="rounded bg-amber-500 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm sm:px-1.5 sm:text-[10px]">
                      Leilao
                    </span>
                  ) : null}
                  {itemTags(item).includes('sold') ? (
                    <span className="rounded bg-earth-700 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm sm:px-1.5 sm:text-[10px]">
                      Vendido
                    </span>
                  ) : null}
                  {itemTags(item).includes('unavailable') && !itemTags(item).includes('sold') ? (
                    <span className="rounded bg-earth-500 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm sm:px-1.5 sm:text-[10px]">
                      Indisponivel
                    </span>
                  ) : null}
                </div>
                <div className="absolute bottom-1 left-1 max-w-[90%] sm:bottom-1.5 sm:left-1.5 sm:max-w-[85%]">
                  <div className="inline-flex w-fit items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white backdrop-blur-[1px] sm:gap-1.5 sm:px-2 sm:py-1 sm:text-[11px]">
                    {catalogStoreBrand(item.storeId).logo ? (
                      <img
                        src={catalogStoreBrand(item.storeId).logo}
                        alt={catalogStoreBrand(item.storeId).label}
                        className="h-3 w-3 rounded-sm object-contain bg-white/90 sm:h-3.5 sm:w-3.5"
                        loading="lazy"
                      />
                    ) : null}
                    <span className="truncate max-sm:hidden">{item.storeName || catalogStoreBrand(item.storeId).label}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1 p-1.5 sm:space-y-1.5 sm:p-2.5">
                <p className="line-clamp-2 text-[10px] font-medium leading-snug text-earth-900 group-hover:text-earth-950 sm:text-xs">
                  {item.title}
                </p>
                <div className="flex items-center justify-end gap-1 text-[10px] sm:text-[11px]">
                  <span className="shrink-0 font-medium text-earth-800">
                    {formatExternalPrice(item.price, item.currency)}
                  </span>
                </div>
                {isAuctionItem(item) ? (
                  <div className="hidden space-y-0.5 text-[10px] text-earth-700 sm:block">
                    <div>
                      Lance atual:{' '}
                      <span className="font-semibold text-amber-700">
                        {formatAuctionPrice(item.auctionCurrentBidPrice, item.currency, formatExternalPrice)}
                      </span>
                    </div>
                    <div>
                      Buyout:{' '}
                      <span className="font-semibold text-sky-700">
                        {formatAuctionPrice(item.auctionBuyoutPrice, item.currency, formatExternalPrice)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </a>
            </Fragment>
            )
          })}
          </div>
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-start justify-center bg-earth-50/55 pt-16 backdrop-blur-[1px] sm:pt-24">
              <div className="flex items-center gap-2 rounded-full border border-earth-200 bg-white px-4 py-2 text-sm font-medium text-earth-800 shadow-md">
                <SearchBusyMark />
                <span>{refreshingLabel}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showInfiniteScroll ? (
        <div ref={loadMoreSentinelRef} className="mt-6 border-t border-earth-200 pt-5">
          {loadingMore ? (
            <p className="text-center text-sm text-earth-600">{loadingMoreLabel}</p>
          ) : canAutoLoad ? (
            <p className="text-center text-xs text-earth-500">{autoLoadHintLabel}</p>
          ) : (
            <p className="text-center text-xs text-earth-500">{endOfResultsLabel}</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

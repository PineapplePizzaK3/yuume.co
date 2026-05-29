import { useEffect, useRef } from 'react'

export const CATALOG_STORE_OPTIONS = [
  { id: 'amazon', label: 'Amazon JP' },
  { id: 'rakuma', label: 'Rakuma' },
  { id: 'mercari', label: 'Mercari' },
  { id: 'yahoo', label: 'Yahoo Auctions' },
  { id: 'yahoo_flea', label: 'Yahoo Flea Market' },
  { id: 'snkrdunk', label: 'SNKRDUNK' },
]

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
  onResultClick,
  buildResultHref,
  resultTarget = '_blank',
  resultRel = 'noopener noreferrer',
}) {
  const loadMoreSentinelRef = useRef(null)
  const showInfiniteScroll = results.length > 0

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel || results.length === 0 || !canAutoLoad) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        if (loading || loadingMore) return
        if (typeof loadMore !== 'function') return
        loadMore()
      },
      { root: null, rootMargin: '240px 0px', threshold: 0 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [results.length, loading, loadingMore, canAutoLoad, loadMore, meta?.page])

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
              className="rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-white hover:bg-earth-900 disabled:opacity-60"
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
        </div>
      </form>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {!loading && meta && showTotals ? (
        <div className="mt-3 text-xs text-earth-600">
          {results.length} exibidos
          {meta.totalEstimated != null ? ` de ${meta.totalEstimated} estimados` : ''}
          {' • '}
          {meta.tookMs ?? 0}ms na ultima consulta
        </div>
      ) : null}

      {!loading && showStrategyBox && meta?.strategy ? (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <strong>Modo atual:</strong> busca em tempo real com parsing de páginas públicas (piloto).{' '}
          <strong>Direção:</strong> ingestão assíncrona + índice próprio para aumentar precisão e estabilidade.
        </div>
      ) : null}

      {partials?.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Algumas lojas falharam nesta tentativa: {partials.map((p) => `${p.storeId} (${p.reason})`).join(' | ')}
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

      {!loading && results.length === 0 && meta ? <p className="mt-4 text-sm text-earth-600">{emptyLabel}</p> : null}
      {loading && results.length === 0 ? <p className="mt-4 text-sm text-earth-600">{loadingLabel}</p> : null}

      {results.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((item) => (
            <a
              key={item.productUrl || item.id}
              href={typeof buildResultHref === 'function' ? buildResultHref(item) : item.productUrl}
              target={resultTarget}
              rel={resultRel}
              onClick={(event) => {
                const shouldContinue = onResultClick?.(item, event)
                if (shouldContinue === false) event.preventDefault()
              }}
              className={`group flex flex-col overflow-hidden rounded-lg border border-earth-200 bg-white shadow-sm transition hover:border-earth-300 hover:shadow-md ${
                isSoldOrUnavailable(item) ? 'opacity-75' : ''
              }`}
            >
              <div className="relative h-24 w-full bg-earth-100 sm:h-52">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className={`h-full w-full object-cover transition duration-200 group-hover:scale-[1.02] ${
                      isSoldOrUnavailable(item) ? 'grayscale-[35%]' : ''
                    }`}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-earth-500">Sem imagem</div>
                )}
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
          ))}
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

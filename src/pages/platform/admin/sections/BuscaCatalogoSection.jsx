import { useEffect, useRef } from 'react'
import { useAdminContext } from '../AdminContext'

export default function BuscaCatalogoSection() {
  const {
    activeTab,
    handleExternalSearchSubmit,
    externalSearchQuery,
    setExternalSearchQuery,
    externalSearchLoading,
    externalSearchLoadingMore,
    externalSearchStores,
    toggleExternalStore,
    externalSearchError,
    externalSearchMeta,
    externalSearchPartials,
    externalSearchResults,
    externalSearchCanAutoLoad,
    formatExternalPrice,
    loadMoreExternalSearch,
  } = useAdminContext()

  const loadMoreSentinelRef = useRef(null)

  useEffect(() => {
    if (activeTab !== 'busca_catalogo') return
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel || externalSearchResults.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        if (externalSearchLoading || externalSearchLoadingMore) return
        if (!externalSearchCanAutoLoad) return
        if (typeof loadMoreExternalSearch !== 'function') return
        loadMoreExternalSearch()
      },
      { root: null, rootMargin: '240px 0px', threshold: 0 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    activeTab,
    externalSearchResults.length,
    externalSearchLoading,
    externalSearchLoadingMore,
    externalSearchCanAutoLoad,
    loadMoreExternalSearch,
  ])

  if (activeTab !== 'busca_catalogo') return null

  const showInfiniteScroll = externalSearchResults.length > 0

  const itemTags = (item) => (Array.isArray(item.tags) ? item.tags : [])
  const isAuctionItem = (item) => itemTags(item).includes('auction')
  const isSoldOrUnavailable = (item) => {
    const tags = itemTags(item)
    return tags.includes('sold') || tags.includes('unavailable')
  }
  const STORE_OPTIONS = [
    { id: 'amazon', label: 'Amazon JP' },
    { id: 'rakuma', label: 'Rakuma' },
    { id: 'mercari', label: 'Mercari' },
    { id: 'yahoo', label: 'Yahoo Auctions' },
    { id: 'yahoo_flea', label: 'Yahoo Flea Market' },
    { id: 'snkrdunk', label: 'SNKRDUNK' },
  ]

  const storeBrand = (storeId) => {
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
  const formatAuctionPrice = (price, currency) => {
    if (price == null || Number.isNaN(Number(price))) return '----'
    return formatExternalPrice(price, currency)
  }

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">Busca em catalogos externos</h2>
          <p className="mt-1 text-sm text-earth-600">
            Piloto no Admin para consultar Amazon, Rakuma, Mercari, Yahoo Auctions, Yahoo Flea Market e SNKRDUNK em um catalogo unico.
          </p>
        </div>
        <div className="text-xs text-earth-500">
          Versao de teste: somente painel admin
        </div>
      </div>

      <form onSubmit={handleExternalSearchSubmit} className="mt-4 rounded-lg border border-earth-200 bg-white p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={externalSearchQuery}
              onChange={(e) => setExternalSearchQuery(e.target.value)}
              placeholder="Ex.: Pokemon card Pikachu, Nendoroid, Nintendo Switch..."
              className="min-w-[240px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
            />
            <button
              type="submit"
              disabled={externalSearchLoading}
              className="rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-white hover:bg-earth-900 disabled:opacity-60"
            >
              {externalSearchLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-earth-700">Lojas:</span>
            {STORE_OPTIONS.map((store) => {
              const brand = storeBrand(store.id)
              const checked = !!externalSearchStores[store.id]
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
                    onChange={() => toggleExternalStore(store.id)}
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
        </div>
      </form>

      {externalSearchError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {externalSearchError}
        </div>
      )}

      {!externalSearchLoading && externalSearchMeta && (
        <div className="mt-3 text-xs text-earth-600">
          {externalSearchResults.length} exibidos
          {externalSearchMeta.totalEstimated != null ? ` de ${externalSearchMeta.totalEstimated} estimados` : ''}
          {' • '}
          {externalSearchMeta.tookMs ?? 0}ms na ultima consulta
        </div>
      )}

      {!externalSearchLoading && externalSearchMeta?.strategy && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <strong>Modo atual:</strong> busca em tempo real com parsing de páginas públicas (piloto).{' '}
          <strong>Direção:</strong> ingestão assíncrona + índice próprio para aumentar precisão e estabilidade.
        </div>
      )}

      {externalSearchPartials?.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Algumas lojas falharam nesta tentativa:{' '}
          {externalSearchPartials.map((p) => `${p.storeId} (${p.reason})`).join(' | ')}
        </div>
      )}

      {!externalSearchLoading && Array.isArray(externalSearchMeta?.diagnostics) && externalSearchMeta.diagnostics.length > 0 && (
        <div className="mt-3 rounded-lg border border-earth-200 bg-white px-3 py-2 text-xs text-earth-700">
          {externalSearchMeta.diagnostics.map((d) => (
            <div key={d.storeId}>
              {d.storeId}: {d.status === 'ok' ? 'ok' : 'falha parcial'} • hits {d.hitCount ?? 0} • {d.tookMs ?? 0}ms
            </div>
          ))}
        </div>
      )}

      {!externalSearchLoading && externalSearchResults.length === 0 && externalSearchMeta && (
        <p className="mt-4 text-sm text-earth-600">Nenhum resultado encontrado com os filtros atuais.</p>
      )}

      {externalSearchLoading && externalSearchResults.length === 0 && (
        <p className="mt-4 text-sm text-earth-600">Consultando lojas externas...</p>
      )}

      {externalSearchResults.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {externalSearchResults.map((item) => (
            <a
              key={item.productUrl || item.id}
              href={item.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex flex-col overflow-hidden rounded-lg border border-earth-200 bg-white shadow-sm transition hover:border-earth-300 hover:shadow-md ${
                isSoldOrUnavailable(item) ? 'opacity-75' : ''
              }`}
            >
              <div className="relative h-52 w-full bg-earth-100">
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
                <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
                  {itemTags(item).includes('auction') && (
                    <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Leilao
                    </span>
                  )}
                  {itemTags(item).includes('sold') && (
                    <span className="rounded bg-earth-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Vendido
                    </span>
                  )}
                  {itemTags(item).includes('unavailable') && !itemTags(item).includes('sold') && (
                    <span className="rounded bg-earth-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Indisponivel
                    </span>
                  )}
                </div>
                <div className="absolute bottom-1.5 left-1.5 max-w-[85%]">
                  <div className="inline-flex w-fit items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-[11px] text-white backdrop-blur-[1px]">
                    {storeBrand(item.storeId).logo ? (
                      <img
                        src={storeBrand(item.storeId).logo}
                        alt={storeBrand(item.storeId).label}
                        className="h-3.5 w-3.5 rounded-sm object-contain bg-white/90"
                        loading="lazy"
                      />
                    ) : null}
                    <span className="truncate">{item.storeName || storeBrand(item.storeId).label}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 p-2.5">
                <p className="line-clamp-2 text-xs font-medium leading-snug text-earth-900 group-hover:text-earth-950">
                  {item.title}
                </p>
                <div className="flex items-center justify-end gap-1 text-[11px]">
                  <span className="shrink-0 font-medium text-earth-800">
                    {formatExternalPrice(item.price, item.currency)}
                  </span>
                </div>
                {isAuctionItem(item) && (
                  <div className="space-y-0.5 text-[10px] text-earth-700">
                    <div>
                      Lance atual:{' '}
                      <span className="font-semibold text-amber-700">
                        {formatAuctionPrice(item.auctionCurrentBidPrice, item.currency)}
                      </span>
                    </div>
                    <div>
                      Buyout:{' '}
                      <span className="font-semibold text-sky-700">
                        {formatAuctionPrice(item.auctionBuyoutPrice, item.currency)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {showInfiniteScroll && (
        <div ref={loadMoreSentinelRef} className="mt-6 border-t border-earth-200 pt-5">
          {externalSearchLoadingMore ? (
            <p className="text-center text-sm text-earth-600">Carregando mais resultados...</p>
          ) : externalSearchCanAutoLoad ? (
            <p className="text-center text-xs text-earth-500">Role para carregar mais resultados.</p>
          ) : (
            <p className="text-center text-xs text-earth-500">Fim dos resultados disponiveis para esta busca.</p>
          )}
        </div>
      )}
    </section>
  )
}

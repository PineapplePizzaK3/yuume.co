import { useAdminContext } from '../AdminContext'

export default function BuscaCatalogoSection() {
  const {
    activeTab,
    handleExternalSearchSubmit,
    externalSearchQuery,
    setExternalSearchQuery,
    externalSearchLoading,
    externalSearchStores,
    toggleExternalStore,
    externalSearchError,
    externalSearchMeta,
    externalSearchPage,
    externalSearchPartials,
    externalSearchResults,
    formatExternalPrice,
    runExternalSearch,
  } = useAdminContext()

  if (activeTab !== 'busca_catalogo') return null

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">Busca em catalogos externos</h2>
          <p className="mt-1 text-sm text-earth-600">
            Piloto no Admin para consultar Amazon, Rakuma e Mercari em um catalogo unico.
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
            {[
              { id: 'amazon', label: 'Amazon JP' },
              { id: 'rakuma', label: 'Rakuma' },
              { id: 'mercari', label: 'Mercari' },
            ].map((store) => (
              <label key={store.id} className="inline-flex items-center gap-2 rounded border border-earth-200 px-2.5 py-1.5">
                <input
                  type="checkbox"
                  checked={!!externalSearchStores[store.id]}
                  onChange={() => toggleExternalStore(store.id)}
                />
                <span className="text-earth-700">{store.label}</span>
              </label>
            ))}
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
          {externalSearchMeta.totalEstimated ?? 0} resultados estimados • pagina {externalSearchMeta.page ?? externalSearchPage} • {externalSearchMeta.tookMs ?? 0}ms
        </div>
      )}

      {externalSearchPartials?.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Algumas lojas falharam nesta tentativa:{' '}
          {externalSearchPartials.map((p) => `${p.storeId} (${p.reason})`).join(' | ')}
        </div>
      )}

      {!externalSearchLoading && externalSearchResults.length === 0 && externalSearchMeta && (
        <p className="mt-4 text-sm text-earth-600">Nenhum resultado encontrado com os filtros atuais.</p>
      )}

      {externalSearchLoading && (
        <p className="mt-4 text-sm text-earth-600">Consultando lojas externas...</p>
      )}

      {!externalSearchLoading && externalSearchResults.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {externalSearchResults.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-lg border border-earth-200 bg-white shadow-sm">
              <div className="h-44 bg-earth-100">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-earth-500">Sem imagem</div>
                )}
              </div>
              <div className="space-y-2 p-3">
                <p className="line-clamp-2 text-sm font-medium text-earth-900">{item.title}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded bg-earth-100 px-2 py-1 text-earth-700">{item.storeName}</span>
                  <span className="font-medium text-earth-800">
                    {formatExternalPrice(item.price, item.currency)}
                  </span>
                </div>
                <a
                  href={item.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-xs font-medium text-earth-700 underline hover:text-earth-900"
                >
                  Abrir produto
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {!externalSearchLoading && externalSearchMeta && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-white px-3 py-2 text-sm">
          <span className="text-earth-600">Pagina {externalSearchPage}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => runExternalSearch(Math.max(1, externalSearchPage - 1))}
              disabled={externalSearchLoading || externalSearchPage <= 1}
              className="rounded border border-earth-300 px-3 py-1.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => runExternalSearch(externalSearchPage + 1)}
              disabled={externalSearchLoading || !externalSearchMeta?.hasMore}
              className="rounded border border-earth-300 px-3 py-1.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

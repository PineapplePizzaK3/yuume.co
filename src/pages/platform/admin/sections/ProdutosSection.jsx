import { useAdminContext } from '../AdminContext'

export default function ProdutosSection() {
  const {
    activeTab,
    resetForm,
    setCatalogCreateOpen,
    setActiveTab,
    storeProductSearch,
    setStoreProductSearch,
    filteredStorePublishCandidates,
    formatJPY,
    formatWeight,
    getProductBasePriceJpy,
    getProductConditionMeta,
    handlePublishToStore,
    storeLinkSubmittingId,
    loading,
    storeProducts,
    handleUnpublishFromStore,
    PaginationControls,
    storeProductsPage,
    storeProductsHasMore,
    setStoreProductsPage,
  } = useAdminContext()

  if (activeTab !== 'produtos') return null

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Produtos</h2>
      <div className="mt-4 rounded-lg border border-earth-200 bg-white p-4 text-sm text-earth-700">
        O cadastro/edicao de itens agora acontece na aba <strong>Lista de Produtos</strong>, para manter um catalogo unico.
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              resetForm()
              setCatalogCreateOpen(true)
              setActiveTab('catalogo_produtos')
            }}
            className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800"
          >
            Ir para Lista de Produtos
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div className="rounded-lg border border-earth-200 bg-white p-4">
          <h3 className="font-medium text-earth-900">Publicar itens da base na Vitrine</h3>
          <p className="mt-1 text-xs text-earth-600">
            Aqui voce apenas vincula/desvincula itens da loja. O cadastro e edicao do produto-base fica na aba Lista de Produtos.
          </p>
          <input
            type="search"
            value={storeProductSearch}
            onChange={(e) => setStoreProductSearch(e.target.value)}
            placeholder="Buscar produto-base para publicar..."
            className="mt-3 w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
          />
          {filteredStorePublishCandidates.length === 0 ? (
            <p className="mt-3 text-sm text-earth-600">Nenhum produto-base disponivel para publicacao.</p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {filteredStorePublishCandidates.slice(0, 40).map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded border border-earth-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-earth-900">{p.name}</p>
                    <p className="text-xs text-earth-600">
                      {formatJPY(getProductBasePriceJpy(p))} • {p.stock_quantity != null ? `Estoque ${p.stock_quantity}` : 'Estoque ilimitado'}
                      {` • ${getProductConditionMeta(p.item_condition).label}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePublishToStore(p.id)}
                    disabled={storeLinkSubmittingId === p.id}
                    className="rounded border border-earth-300 bg-white px-3 py-1.5 text-xs font-medium text-earth-800 hover:bg-earth-100 disabled:opacity-50"
                  >
                    {storeLinkSubmittingId === p.id ? 'Publicando...' : 'Publicar'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-medium text-earth-900">Produtos publicados na Vitrine</h3>
          {loading && <p className="mt-2 text-sm text-earth-600">Carregando...</p>}
          {!loading && storeProducts.length === 0 && (
            <p className="mt-2 text-sm text-earth-600">Nenhum produto publicado na loja.</p>
          )}
          {!loading && storeProducts.length > 0 && (
            <div className="mt-4 space-y-2">
              <ul className="space-y-2">
                {storeProducts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-earth-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-4">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-earth-200" />
                      )}
                      <div>
                        <span className="font-medium text-earth-900">{p.name}</span>
                        <span className="ml-2 text-sm text-earth-600">{formatJPY(getProductBasePriceJpy(p))}</span>
                        <span className="ml-2 text-xs text-earth-500">
                          {Number(p.weight_kg ?? 0) > 0 ? `• ${formatWeight(p.weight_kg)}` : '• peso nao definido'}
                        </span>
                        <span className="ml-2 text-xs text-earth-500">
                          • Estoque: {p.stock_quantity != null ? p.stock_quantity : 'ilimitado'}
                        </span>
                        <span className={`ml-2 rounded border px-2 py-0.5 text-xs font-medium ${getProductConditionMeta(p.item_condition).className}`}>
                          {getProductConditionMeta(p.item_condition).label}
                        </span>
                        {!p.is_active && (
                          <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs text-amber-900">
                            Inativo na base
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUnpublishFromStore(p.id)}
                        disabled={storeLinkSubmittingId === p.id}
                        className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {storeLinkSubmittingId === p.id ? 'Removendo...' : 'Remover da loja'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <PaginationControls
                page={storeProductsPage}
                hasMore={storeProductsHasMore}
                loading={loading}
                onPrev={() => setStoreProductsPage((p) => Math.max(0, p - 1))}
                onNext={() => setStoreProductsPage((p) => p + 1)}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

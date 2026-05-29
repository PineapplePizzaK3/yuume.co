import { useAdminContext } from '../AdminContext'
import CatalogSearchPanel from '../../../../components/CatalogSearchPanel'

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

  if (activeTab !== 'busca_catalogo') return null

  return (
    <CatalogSearchPanel
      headerTitle="Busca em catalogos externos"
      headerSubtitle="Piloto no Admin para consultar Amazon, Rakuma, Mercari, Yahoo Auctions, Yahoo Flea Market e SNKRDUNK em um catalogo unico."
      headerBadge="Versao de teste: somente painel admin"
      query={externalSearchQuery}
      setQuery={setExternalSearchQuery}
      onSubmit={handleExternalSearchSubmit}
      loading={externalSearchLoading}
      loadingMore={externalSearchLoadingMore}
      stores={externalSearchStores}
      toggleStore={toggleExternalStore}
      error={externalSearchError}
      meta={externalSearchMeta}
      partials={externalSearchPartials}
      results={externalSearchResults}
      canAutoLoad={externalSearchCanAutoLoad}
      loadMore={loadMoreExternalSearch}
      formatExternalPrice={formatExternalPrice}
      inputPlaceholder="Ex.: Pokemon card Pikachu, Nendoroid, Nintendo Switch..."
      showStrategyBox
      showDiagnostics
    />
  )
}

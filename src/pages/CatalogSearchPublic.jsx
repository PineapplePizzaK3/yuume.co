import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../components/PageSeo'
import CatalogSearchPanel, { CATALOG_STORE_OPTIONS } from '../components/CatalogSearchPanel'
import { LOCALE_EN } from '../lib/localeRoutes'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { searchCatalogPublic } from '../services/catalogSearchService'

export default function CatalogSearchPublic() {
  const { t } = useTranslation()
  const siteLocale = useSiteLocale()
  const isEn = siteLocale === LOCALE_EN
  const [searchParams, setSearchParams] = useSearchParams()
  const catalogQueryFromUrl = searchParams.get('catalogQuery') || ''
  const catalogStoreFromUrl = searchParams.get('catalogStore') || ''
  const [catalogQuery, setCatalogQuery] = useState(catalogQueryFromUrl)
  const [catalogStores, setCatalogStores] = useState(() =>
    CATALOG_STORE_OPTIONS.reduce((acc, row) => ({ ...acc, [row.id]: true }), {}),
  )
  const [catalogResults, setCatalogResults] = useState([])
  const [catalogMeta, setCatalogMeta] = useState(null)
  const [catalogPartials, setCatalogPartials] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false)
  const [catalogCanAutoLoad, setCatalogCanAutoLoad] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const lastCatalogQueryFromUrlRef = useRef('')

  const trackPublicSearchMetric = (eventName, payload = {}) => {
    const safePayload = { area: 'catalog-search-public', eventName, ...payload }
    if (typeof window !== 'undefined') {
      const gtag = window.gtag
      const plausible = window.plausible
      if (typeof gtag === 'function') gtag('event', 'catalog_search_public', safePayload)
      if (typeof plausible === 'function') plausible('catalog_search_public', { props: safePayload })
    }
    console.info('[catalog_search_public]', safePayload)
  }

  const formatExternalPrice = (value, currency = 'JPY') => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '----'
    const locale = isEn ? 'en-US' : 'pt-BR'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'JPY',
      maximumFractionDigits: 0,
    }).format(numeric)
  }

  useEffect(() => {
    const storeId = String(catalogStoreFromUrl || '').trim()
    if (!storeId || storeId === 'all') return
    const exists = CATALOG_STORE_OPTIONS.some((store) => store.id === storeId)
    if (!exists) return
    setCatalogStores((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) next[key] = key === storeId
      return next
    })
  }, [catalogStoreFromUrl])

  const toggleCatalogStore = (storeId) => {
    setCatalogStores((prev) => ({ ...prev, [storeId]: !prev[storeId] }))
  }

  const selectedCatalogStores = useMemo(
    () =>
      Object.entries(catalogStores)
        .filter(([, enabled]) => enabled)
        .map(([storeId]) => storeId),
    [catalogStores],
  )

  const runCatalogSearch = async (page = 1, { append = false, overrideQuery } = {}) => {
    const q = String(overrideQuery ?? catalogQuery).trim()
    if (q.length < 2) {
      setCatalogError(
        isEn ? 'Type at least 2 characters to search external catalogs.' : 'Digite ao menos 2 caracteres para buscar.',
      )
      return
    }
    if (selectedCatalogStores.length === 0) {
      setCatalogError(isEn ? 'Select at least one store.' : 'Selecione ao menos uma loja.')
      return
    }

    if (append) setCatalogLoadingMore(true)
    else {
      setCatalogLoading(true)
      setCatalogCanAutoLoad(true)
    }
    setCatalogError('')

    const { data, error } = await searchCatalogPublic({
      query: q,
      stores: selectedCatalogStores,
      page,
      pageSize: 24,
    })

    if (error) {
      setCatalogError(error.message || (isEn ? 'Failed to search external catalogs.' : 'Falha ao buscar catálogos externos.'))
      trackPublicSearchMetric('search_error', {
        query: q,
        stores: selectedCatalogStores.join(','),
        page,
        reason: error.message || 'unknown',
      })
    } else {
      const incoming = Array.isArray(data?.results) ? data.results : []
      setCatalogResults((prev) => {
        if (!append) return incoming
        const map = new Map(prev.map((item) => [item.productUrl, item]))
        for (const item of incoming) map.set(item.productUrl, item)
        const merged = [...map.values()]
        if (incoming.length > 0 && merged.length === prev.length) setCatalogCanAutoLoad(false)
        return merged
      })
      setCatalogMeta(data?.meta ?? null)
      setCatalogPartials(Array.isArray(data?.partials) ? data.partials : [])
      if (!data?.meta?.hasMore) setCatalogCanAutoLoad(false)
      trackPublicSearchMetric('search_ok', {
        query: q,
        stores: selectedCatalogStores.join(','),
        page,
        resultCount: incoming.length,
        tookMs: data?.meta?.tookMs ?? null,
      })
    }

    if (append) setCatalogLoadingMore(false)
    else setCatalogLoading(false)
  }

  const handleCatalogSubmit = async (event) => {
    event.preventDefault()
    const q = catalogQuery.trim()
    const nextParams = new URLSearchParams(searchParams)
    if (q) nextParams.set('catalogQuery', q)
    else nextParams.delete('catalogQuery')
    setSearchParams(nextParams, { replace: true })
    await runCatalogSearch(1, { append: false })
  }

  const loadMoreCatalog = async () => {
    if (catalogLoading || catalogLoadingMore || !catalogCanAutoLoad) return
    const nextPage = Number(catalogMeta?.page || 1) + 1
    await runCatalogSearch(nextPage, { append: true })
  }

  useEffect(() => {
    const fromUrl = String(catalogQueryFromUrl || '').trim()
    if (!fromUrl || fromUrl.length < 2) return
    if (lastCatalogQueryFromUrlRef.current === fromUrl) return
    lastCatalogQueryFromUrlRef.current = fromUrl
    setCatalogQuery(fromUrl)
    setCatalogCanAutoLoad(true)
    void runCatalogSearch(1, { append: false, overrideQuery: fromUrl })
  }, [catalogQueryFromUrl])

  return (
    <>
      <PageSeo
        routeKey="catalogSearchPublic"
        title={isEn ? 'Catalog Search' : 'Busca de Catalogo'}
        description={
          isEn
            ? 'Search products across external marketplaces in one place.'
            : 'Busque produtos em marketplaces externos em um único lugar.'
        }
      />
      <section className="px-4 pb-16 pt-24">
        <div className="mx-auto max-w-6xl">
          <CatalogSearchPanel
            headerTitle={isEn ? 'Search External Catalogs' : 'Busca unificada em catalogos externos'}
            headerSubtitle={
              isEn
                ? 'Search products across marketplaces and compare listings in one place.'
                : 'Pesquise produtos em varios marketplaces e compare resultados em um unico lugar.'
            }
            headerBadge={isEn ? 'Public beta' : 'Beta publica'}
            query={catalogQuery}
            setQuery={setCatalogQuery}
            onSubmit={handleCatalogSubmit}
            loading={catalogLoading}
            loadingMore={catalogLoadingMore}
            stores={catalogStores}
            toggleStore={toggleCatalogStore}
            error={catalogError}
            meta={catalogMeta}
            partials={catalogPartials}
            results={catalogResults}
            canAutoLoad={catalogCanAutoLoad}
            loadMore={loadMoreCatalog}
            formatExternalPrice={formatExternalPrice}
            inputPlaceholder="Ex.: Pokemon card Pikachu, Nendoroid, Nintendo Switch..."
            searchButtonLabel={isEn ? 'Search' : 'Buscar'}
            loadingButtonLabel={isEn ? 'Searching...' : 'Buscando...'}
            showStrategyBox={false}
            showDiagnostics={false}
            emptyLabel={
              isEn ? 'No results found with the current filters.' : 'Nenhum resultado encontrado com os filtros atuais.'
            }
            loadingLabel={isEn ? 'Searching external stores...' : 'Consultando lojas externas...'}
            loadingMoreLabel={isEn ? 'Loading more results...' : 'Carregando mais resultados...'}
            autoLoadHintLabel={isEn ? 'Scroll to load more results.' : 'Role para carregar mais resultados.'}
            endOfResultsLabel={
              isEn ? 'No more results available for this search.' : 'Fim dos resultados disponiveis para esta busca.'
            }
            storesLabel={isEn ? 'Stores:' : 'Lojas:'}
            onResultClick={(item) =>
              trackPublicSearchMetric('result_click', {
                storeId: item.storeId,
                productUrl: item.productUrl,
              })
            }
          />
        </div>
      </section>
    </>
  )
}

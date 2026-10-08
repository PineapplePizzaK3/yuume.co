import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../components/PageSeo'
import CatalogSearchPanel, { CATALOG_STORE_OPTIONS, defaultCatalogStoreSelection } from '../components/CatalogSearchPanel'
import {
  catalogSearchSessionMatches,
  readCatalogSearchSession,
  writeCatalogSearchSession,
} from '../lib/catalogSearchSession'
import {
  encodeEphemeralOpenPayload,
  stashEphemeralOpenPayload,
} from '../lib/ephemeralOpenSession'
import { LOCALE_EN, publicEphemeralOpenPath } from '../lib/localeRoutes'
import { pageShell } from '../lib/layout'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { searchCatalogPublic } from '../services/catalogSearchService'
import { searchListingIndex } from '../services/listingIndexService'
import { mergeLiveHitsWithIndex, mergeVisibleHitsWithLiveRefresh, prepareIndexSearchHits } from '../lib/listingIndex'
import {
  appendCatalogHits,
  applyCatalogFilters,
  catalogFiltersKey,
  catalogSearchMayHaveMore,
  parseCatalogFiltersFromSearchParams,
  sanitizeCatalogFilters,
  sortCatalogHits,
  tagCatalogHitBatch,
  writeCatalogFiltersToSearchParams,
} from '../lib/catalogSearchFilters'

function selectedStoreIds(stores) {
  return Object.entries(stores || {})
    .filter(([, enabled]) => enabled)
    .map(([storeId]) => storeId)
}

export default function CatalogSearchPublic() {
  const { t } = useTranslation()
  const siteLocale = useSiteLocale()
  const isEn = siteLocale === LOCALE_EN
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const catalogQueryFromUrl = searchParams.get('catalogQuery') || ''
  const catalogStoreFromUrl = searchParams.get('catalogStore') || ''

  const restoredSessionRef = useRef(null)
  if (restoredSessionRef.current === null) {
    const fromUrl = String(catalogQueryFromUrl || '').trim()
    const session = readCatalogSearchSession()
    restoredSessionRef.current =
      fromUrl.length >= 2
      && catalogSearchSessionMatches(session, {
        query: fromUrl,
        filtersKey: catalogFiltersKey(parseCatalogFiltersFromSearchParams(searchParams)),
      })
        ? session
        : false
  }
  const restoredSession = restoredSessionRef.current || null

  const [catalogQuery, setCatalogQuery] = useState(
    () => restoredSession?.query || catalogQueryFromUrl,
  )
  const [catalogStores, setCatalogStores] = useState(
    () => restoredSession?.stores || defaultCatalogStoreSelection(catalogStoreFromUrl),
  )
  const [catalogResults, setCatalogResults] = useState(() => restoredSession?.results || [])
  const [catalogMeta, setCatalogMeta] = useState(() => restoredSession?.meta ?? null)
  const [catalogPartials, setCatalogPartials] = useState(() => restoredSession?.partials || [])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [filterRefreshPending, setFilterRefreshPending] = useState(false)
  const [storesRefreshing, setStoresRefreshing] = useState(false)
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false)
  const [catalogCanAutoLoad, setCatalogCanAutoLoad] = useState(
    () => restoredSession?.canAutoLoad !== false,
  )
  const [catalogCursors, setCatalogCursors] = useState(() => restoredSession?.cursors ?? null)
  const [catalogFilters, setCatalogFilters] = useState(() =>
    sanitizeCatalogFilters(restoredSession?.filters || parseCatalogFiltersFromSearchParams(searchParams)),
  )
  const [catalogError, setCatalogError] = useState('')
  const lastCatalogQueryFromUrlRef = useRef(restoredSession ? String(restoredSession.query || '') : '')
  const skipNextUrlSearchRef = useRef(Boolean(restoredSession))
  const searchSeqRef = useRef(0)
  const lastAutoFilterKeyRef = useRef('')
  const skipFilterAutoSearchRef = useRef(true)
  const catalogQueryRef = useRef(catalogQuery)
  catalogQueryRef.current = catalogQuery
  const catalogResultsRef = useRef(catalogResults)
  catalogResultsRef.current = catalogResults
  const catalogBatchRef = useRef(0)

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
    if (restoredSession?.stores) return
    const storeId = String(catalogStoreFromUrl || '').trim()
    if (!storeId || storeId === 'all') return
    const exists = CATALOG_STORE_OPTIONS.some((store) => store.id === storeId)
    if (!exists) return
    setCatalogStores((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) next[key] = key === storeId
      return next
    })
  }, [catalogStoreFromUrl, restoredSession])

  const toggleCatalogStore = (storeId) => {
    setCatalogStores((prev) => ({ ...prev, [storeId]: !prev[storeId] }))
  }

  const selectedCatalogStores = useMemo(() => selectedStoreIds(catalogStores), [catalogStores])

  const persistSearchSession = ({
    query,
    stores,
    selectedStores,
    results,
    meta,
    partials,
    cursors,
    canAutoLoad,
    filters,
  }) => {
    writeCatalogSearchSession({
      query,
      stores,
      selectedStores,
      results,
      meta,
      partials,
      cursors,
      canAutoLoad,
      filters,
      filtersKey: catalogFiltersKey(filters),
    })
  }

  const runCatalogSearch = async (page = 1, { append = false, overrideQuery, cursors = null } = {}) => {
    const q = String(overrideQuery ?? catalogQuery).trim()
    if (q.length < 2) {
      setCatalogError(
        isEn ? 'Type at least 2 characters to search external catalogs.' : 'Digite ao menos 2 caracteres para buscar.',
      )
      setFilterRefreshPending(false)
      return
    }
    if (selectedCatalogStores.length === 0) {
      setCatalogError(isEn ? 'Select at least one store.' : 'Selecione ao menos uma loja.')
      setFilterRefreshPending(false)
      return
    }

    if (append) setCatalogLoadingMore(true)
    else {
      setCatalogLoading(true)
      setCatalogLoadingMore(false)
      setCatalogCanAutoLoad(true)
      setCatalogCursors(null)
    }
    setCatalogError('')
    const seq = ++searchSeqRef.current
    const activeFilters = sanitizeCatalogFilters(catalogFilters)
    let liveDone = false
    let indexHits = []
    const skipClientIndex = append

    const indexPromise = skipClientIndex
      ? Promise.resolve([])
      : searchListingIndex({
          query: q,
          stores: selectedCatalogStores,
          limit: 24,
        }).then(({ data: rows }) => {
          indexHits = Array.isArray(rows) ? rows : []
          if (seq !== searchSeqRef.current || liveDone) return indexHits
          const preview = prepareIndexSearchHits(indexHits, activeFilters, 0)
          if (!preview.length) return indexHits
          catalogResultsRef.current = preview
          setCatalogResults(preview)
          persistSearchSession({
            query: q,
            stores: catalogStores,
            selectedStores: selectedCatalogStores,
            results: preview,
            meta: { fromIndex: true, query: q, source: 'index', refreshPending: true },
            partials: [],
            cursors: null,
            canAutoLoad: true,
            filters: activeFilters,
          })
          return indexHits
        }).catch(() => [])

    const applyPageResults = (data, { mergeClientIndex = true, preserveVisible = false } = {}) => {
      const incomingRaw = append
        ? (Array.isArray(data?.results) ? data.results : [])
        : preserveVisible
          ? mergeVisibleHitsWithLiveRefresh(
            catalogResultsRef.current,
            Array.isArray(data?.results) ? data.results : [],
          )
          : mergeClientIndex
            ? mergeLiveHitsWithIndex(
              Array.isArray(data?.results) ? data.results : [],
              indexHits,
            )
            : (Array.isArray(data?.results) ? data.results : [])
      const incoming = preserveVisible
        ? applyCatalogFilters(incomingRaw, activeFilters)
        : sortCatalogHits(applyCatalogFilters(incomingRaw, activeFilters), activeFilters.sort)
      const serverHasMore = data?.meta?.hasMore ?? false
      let nextResults = incoming
      let addedCount = incoming.length

      if (append) {
        const nextBatch =
          catalogResultsRef.current.reduce((max, item) => Math.max(max, Number(item?.loadedBatch) || 0), 0) + 1
        catalogBatchRef.current = nextBatch
        const merged = appendCatalogHits(catalogResultsRef.current, incoming, {
          sort: activeFilters.sort,
          loadedBatch: nextBatch,
        })
        nextResults = merged.results
        addedCount = merged.addedCount
      } else if (preserveVisible) {
        nextResults = incoming
      } else {
        catalogBatchRef.current = 0
        nextResults = tagCatalogHitBatch(incoming, 0)
      }
      catalogResultsRef.current = nextResults
      setCatalogResults(nextResults)

      const nextCanAutoLoad = catalogSearchMayHaveMore({
        serverHasMore,
        returnedCount: incomingRaw.length,
        matchedCount: incoming.length,
        newItemCount: append ? addedCount : incoming.length,
        append,
        filters: activeFilters,
      })
      setCatalogCanAutoLoad(nextCanAutoLoad)

      const nextMeta = data?.meta ?? null
      const nextPartials = Array.isArray(data?.partials) ? data.partials : []
      const nextCursors = data?.meta?.cursors ?? null
      setCatalogCursors(nextCursors)
      setCatalogMeta(nextMeta)
      setCatalogPartials(nextPartials)
      persistSearchSession({
        query: q,
        stores: catalogStores,
        selectedStores: selectedCatalogStores,
        results: nextResults,
        meta: nextMeta,
        partials: nextPartials,
        cursors: nextCursors,
        canAutoLoad: nextCanAutoLoad,
        filters: sanitizeCatalogFilters(catalogFilters),
      })
      return { incoming, incomingRaw }
    }

    const { data, error } = await searchCatalogPublic({
      query: q,
      stores: selectedCatalogStores,
      page,
      pageSize: 24,
      cursors: append ? cursors ?? catalogCursors : null,
      filters: activeFilters,
    })
    liveDone = true
    await indexPromise

    if (seq !== searchSeqRef.current) return

    if (error) {
      setCatalogError(error.message || (isEn ? 'Failed to search external catalogs.' : 'Falha ao buscar catálogos externos.'))
      trackPublicSearchMetric('search_error', {
        query: q,
        stores: selectedCatalogStores.join(','),
        page,
        reason: error.message || 'unknown',
      })
    } else {
      const fromIndex = data?.meta?.source === 'index'
      const { incoming } = applyPageResults(data, { mergeClientIndex: !fromIndex })
      trackPublicSearchMetric('search_ok', {
        query: q,
        stores: selectedCatalogStores.join(','),
        page,
        resultCount: incoming.length,
        tookMs: data?.meta?.tookMs ?? null,
        source: data?.meta?.source || null,
      })

      if (!append && data?.meta?.refreshPending) {
        setStoresRefreshing(true)
        setCatalogLoading(false)
        try {
          const live = await searchCatalogPublic({
            query: q,
            stores: selectedCatalogStores,
            page: 1,
            pageSize: 24,
            filters: activeFilters,
            forceLive: true,
          })
          if (seq === searchSeqRef.current && !live.error) {
            applyPageResults(live.data, { mergeClientIndex: false, preserveVisible: true })
            trackPublicSearchMetric('search_refresh_ok', {
              query: q,
              stores: selectedCatalogStores.join(','),
              tookMs: live.data?.meta?.tookMs ?? null,
              source: live.data?.meta?.source || null,
            })
          }
        } finally {
          if (seq === searchSeqRef.current) setStoresRefreshing(false)
        }
      }
    }

    if (seq !== searchSeqRef.current) return
    if (append) setCatalogLoadingMore(false)
    else {
      setCatalogLoading(false)
      setFilterRefreshPending(false)
    }
  }

  const handleCatalogSubmit = async (event) => {
    event.preventDefault()
    const q = catalogQuery.trim()
    const nextParams = writeCatalogFiltersToSearchParams(searchParams, catalogFilters)
    if (q) nextParams.set('catalogQuery', q)
    else nextParams.delete('catalogQuery')
    setSearchParams(nextParams, { replace: true })
    lastCatalogQueryFromUrlRef.current = q
    skipNextUrlSearchRef.current = true
    lastAutoFilterKeyRef.current = `${catalogFiltersKey(catalogFilters)}|${[...selectedCatalogStores].sort().join(',')}`
    await runCatalogSearch(1, { append: false })
  }

  const loadMoreCatalog = async () => {
    if (catalogLoading || catalogLoadingMore || !catalogCanAutoLoad) return
    const nextPage = Number(catalogMeta?.page || 1) + 1
    await runCatalogSearch(nextPage, { append: true, cursors: catalogCursors })
  }

  const buildResultHref = (item) => {
    const sid = stashEphemeralOpenPayload(item)
    if (!sid) return '#'
    return publicEphemeralOpenPath(sid, siteLocale, encodeEphemeralOpenPayload(item), item?.productUrl || item?.external_url)
  }

  const handleResultClick = (item, event) => {
    // New tab / modified clicks use the real href (bridge page).
    if (
      event
      && (
        event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      )
    ) {
      stashEphemeralOpenPayload(item)
      return undefined
    }
    event?.preventDefault?.()
    const href = buildResultHref(item)
    if (!href || href === '#') {
      setCatalogError(
        isEn
          ? 'Could not open temporary product page. Please try again.'
          : 'Nao foi possivel abrir a pagina temporaria. Tente novamente.',
      )
      return false
    }
    trackPublicSearchMetric('result_click', {
      storeId: item?.storeId,
      productUrl: item?.productUrl,
    })
    // Keep current results in session so browser back restores instantly.
    persistSearchSession({
      query: String(catalogQuery || catalogQueryFromUrl || '').trim(),
      stores: catalogStores,
      selectedStores: selectedCatalogStores,
      results: catalogResults,
      meta: catalogMeta,
      partials: catalogPartials,
      cursors: catalogCursors,
      canAutoLoad: catalogCanAutoLoad,
      filters: catalogFilters,
    })
    navigate(href)
    return false
  }

  useEffect(() => {
    const fromUrl = String(catalogQueryFromUrl || '').trim()
    if (!fromUrl || fromUrl.length < 2) return
    if (skipNextUrlSearchRef.current) {
      skipNextUrlSearchRef.current = false
      lastCatalogQueryFromUrlRef.current = fromUrl
      return
    }
    if (lastCatalogQueryFromUrlRef.current === fromUrl) return

    const session = readCatalogSearchSession()
    if (catalogSearchSessionMatches(session, { query: fromUrl, filtersKey: catalogFiltersKey(catalogFilters) })) {
      lastCatalogQueryFromUrlRef.current = fromUrl
      setCatalogQuery(fromUrl)
      if (session.stores) setCatalogStores(session.stores)
      setCatalogResults(Array.isArray(session.results) ? session.results : [])
      setCatalogMeta(session.meta ?? null)
      setCatalogPartials(Array.isArray(session.partials) ? session.partials : [])
      setCatalogCursors(session.cursors ?? null)
      if (session.filters) setCatalogFilters(sanitizeCatalogFilters(session.filters))
      setCatalogCanAutoLoad(session.canAutoLoad !== false)
      setCatalogError('')
      return
    }

    lastCatalogQueryFromUrlRef.current = fromUrl
    setCatalogQuery(fromUrl)
    setCatalogCanAutoLoad(true)
    void runCatalogSearch(1, { append: false, overrideQuery: fromUrl })
  }, [catalogQueryFromUrl])

  const activeFilterKey = `${catalogFiltersKey(catalogFilters)}|${[...selectedCatalogStores].sort().join(',')}`

  useEffect(() => {
    if (skipFilterAutoSearchRef.current) {
      skipFilterAutoSearchRef.current = false
      lastAutoFilterKeyRef.current = activeFilterKey
      return undefined
    }
    if (activeFilterKey === lastAutoFilterKeyRef.current) return undefined
    const q = catalogQueryRef.current.trim()
    if (q.length < 2 || selectedCatalogStores.length === 0) return undefined
    if (!catalogMeta && catalogResults.length === 0) return undefined

    setFilterRefreshPending(true)
    const timer = window.setTimeout(() => {
      lastAutoFilterKeyRef.current = activeFilterKey
      const nextParams = writeCatalogFiltersToSearchParams(searchParams, catalogFilters)
      if (q) nextParams.set('catalogQuery', q)
      else nextParams.delete('catalogQuery')
      skipNextUrlSearchRef.current = true
      lastCatalogQueryFromUrlRef.current = q
      setSearchParams(nextParams, { replace: true })
      void runCatalogSearch(1, { append: false })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [activeFilterKey, catalogFilters, catalogMeta, catalogResults.length, searchParams, selectedCatalogStores, setSearchParams])

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
            loading={catalogLoading || filterRefreshPending || storesRefreshing}
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
            refreshingLabel={
              isEn
                ? 'Showing recent matches. Updating stores…'
                : 'Mostrando resultados recentes. Atualizando lojas…'
            }
            moreResultsLabel={isEn ? 'More results' : 'Mais resultados'}
            loadingMoreLabel={isEn ? 'Loading more results...' : 'Carregando mais resultados...'}
            autoLoadHintLabel={isEn ? 'Scroll to load more results.' : 'Role para carregar mais resultados.'}
            endOfResultsLabel={
              isEn ? 'No more results available for this search.' : 'Fim dos resultados disponiveis para esta busca.'
            }
            storesLabel={isEn ? 'Stores:' : 'Lojas:'}
            filters={catalogFilters}
            setFilters={setCatalogFilters}
            isEn={isEn}
            onPrepareResultHref={stashEphemeralOpenPayload}
            onResultClick={handleResultClick}
            buildResultHref={buildResultHref}
            resultTarget="_self"
            resultRel={undefined}
          />
        </div>
      </section>
    </>
  )
}

import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { localizedPath } from '../lib/localeRoutes'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { CATALOG_STORE_OPTIONS } from './CatalogSearchPanel'

function shouldHideShortcut(pathname) {
  const p = String(pathname || '')
  if (p.startsWith('/app') || p.startsWith('/en/app')) return true
  if (p === '/busca-catalogo' || p === '/en/catalog-search') return true
  if (/^\/(en\/)?(login|register|forgot-password|reset-password)$/.test(p.replace(/^\//, ''))) return true
  return false
}

export default function GlobalCatalogSearchShortcut() {
  const location = useLocation()
  const navigate = useNavigate()
  const locale = useSiteLocale()
  const isEn = locale === 'en'
  const [query, setQuery] = useState('')
  const [storeFilter, setStoreFilter] = useState('all')
  const inputRef = useRef(null)

  const visible = useMemo(() => !shouldHideShortcut(location.pathname), [location.pathname])
  if (!visible) return null

  const handleSubmit = (event) => {
    event.preventDefault()
    const q = query.trim()
    const store = String(storeFilter || 'all')
    const queryParts = []
    if (q) queryParts.push(`catalogQuery=${encodeURIComponent(q)}`)
    if (store !== 'all') queryParts.push(`catalogStore=${encodeURIComponent(store)}`)
    const queryString = queryParts.length ? `?${queryParts.join('&')}` : ''
    const target = localizedPath(
      'catalogSearchPublic',
      locale,
      queryString,
    )
    navigate(target)
  }

  return (
    <>
      <div className="h-12" aria-hidden />
      <div className="fixed left-0 right-0 top-[4.5rem] z-40 border-b border-earth-200 bg-earth-50/95 backdrop-blur">
        <form onSubmit={handleSubmit} className="mx-auto max-w-7xl px-3 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 rounded-lg border border-earth-200 bg-white p-1">
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="h-8 w-[140px] shrink-0 rounded border border-earth-200 bg-earth-50 px-2 text-xs font-medium text-earth-800 outline-none focus:border-earth-400 sm:h-9 sm:w-[170px] sm:text-sm"
              aria-label={isEn ? 'Marketplace filter' : 'Filtro de loja'}
            >
              <option value="all">{isEn ? 'All stores' : 'Todas as lojas'}</option>
              {CATALOG_STORE_OPTIONS.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.label}
                </option>
              ))}
            </select>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isEn
                  ? 'Type a brand, product name or item URL to search...'
                  : 'Digite o nome da marca ou o nome do item para pesquisar...'
              }
              className="h-8 min-w-0 flex-1 rounded border border-earth-200 px-2.5 text-xs text-earth-900 placeholder:text-earth-400 focus:border-earth-500 focus:outline-none sm:h-9 sm:text-sm"
              aria-label={isEn ? 'Search external marketplaces' : 'Buscar em marketplaces externos'}
            />
            <button
              type="submit"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-earth-700 text-white hover:bg-earth-900 sm:h-9 sm:w-9"
              aria-label={isEn ? 'Search' : 'Buscar'}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

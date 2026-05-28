import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LOCALE_EN } from '../../lib/localeRoutes'
import {
  normalizeSearchText,
  searchDynamicStoreIndex,
  searchStaticIndex,
} from '../../services/globalSearchService'

const DEBOUNCE_MS = 280
const MIN_QUERY_LENGTH = 2

function SearchIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  )
}

function ResultButton({ item, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-full rounded-lg border border-earth-200 bg-white px-4 py-3 text-left transition hover:border-earth-300 hover:bg-earth-50"
    >
      <p className="font-medium text-earth-900">{item.title}</p>
      {item.description ? <p className="mt-1 line-clamp-2 text-sm text-earth-600">{item.description}</p> : null}
    </button>
  )
}

function ResultSection({ title, items, onSelect }) {
  if (!items?.length) return null
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-earth-500 uppercase">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <ResultButton key={item.id} item={item} onSelect={onSelect} />
        ))}
      </div>
    </section>
  )
}

export function GlobalSearchModal({ open, onClose, staticIndex, locale = 'pt-BR', onNavigate }) {
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [loadingDynamic, setLoadingDynamic] = useState(false)
  const [dynamicResults, setDynamicResults] = useState({ products: [], groups: [], errors: [] })

  const uiText = useMemo(() => {
    if (locale === LOCALE_EN) {
      return {
        title: 'Search the site',
        placeholder: 'Search pages, help topics, products, or groups…',
        closeAria: 'Close search',
        minChars: 'Type at least 2 characters to search.',
        searching: 'Searching…',
        noResults: 'No results found for "{{query}}".',
        sections: {
          pages: 'Pages',
          faq: 'Help topics',
          directory: 'Where to buy',
          products: 'Store products',
          groups: 'Store groups',
        },
      }
    }
    return {
      title: 'Pesquisar no site',
      placeholder: 'Busque páginas, dúvidas, produtos ou grupos…',
      closeAria: 'Fechar busca',
      minChars: 'Digite pelo menos 2 caracteres para pesquisar.',
      searching: 'Buscando…',
      noResults: 'Nenhum resultado encontrado para "{{query}}".',
      sections: {
        pages: 'Páginas',
        faq: 'Dúvidas',
        directory: 'Onde comprar',
        products: 'Produtos da loja',
        groups: 'Grupos da loja',
      },
    }
  }, [locale])

  useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebouncedQuery('')
      setDynamicResults({ products: [], groups: [], errors: [] })
      setLoadingDynamic(false)
      return
    }
    const timer = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [open, query])

  const normalizedQuery = useMemo(() => normalizeSearchText(debouncedQuery), [debouncedQuery])
  const canSearch = normalizedQuery.length >= MIN_QUERY_LENGTH

  const staticResults = useMemo(() => {
    if (!canSearch) return []
    return searchStaticIndex(staticIndex, normalizedQuery, { limit: 18 })
  }, [staticIndex, normalizedQuery, canSearch])

  useEffect(() => {
    if (!open || !canSearch) {
      setDynamicResults({ products: [], groups: [], errors: [] })
      setLoadingDynamic(false)
      return
    }
    let cancelled = false
    setLoadingDynamic(true)
    ;(async () => {
      const response = await searchDynamicStoreIndex(normalizedQuery, { locale })
      if (!cancelled) {
        setDynamicResults(response)
        setLoadingDynamic(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, canSearch, normalizedQuery, locale])

  const groupedResults = useMemo(() => {
    const pages = staticResults.filter((item) => item.group === 'pages').slice(0, 6)
    const faq = staticResults.filter((item) => item.group === 'faq').slice(0, 5)
    const directory = staticResults.filter((item) => item.group === 'directory').slice(0, 5)
    const products = (dynamicResults.products ?? []).slice(0, 6)
    const groups = (dynamicResults.groups ?? []).slice(0, 4)
    return { pages, faq, directory, products, groups }
  }, [staticResults, dynamicResults])

  const totalResults = useMemo(
    () =>
      groupedResults.pages.length +
      groupedResults.faq.length +
      groupedResults.directory.length +
      groupedResults.products.length +
      groupedResults.groups.length,
    [groupedResults]
  )

  const hasError = (dynamicResults.errors ?? []).length > 0

  if (!open) return null

  const handleSelect = (item) => {
    onNavigate?.(item.to)
    onClose?.()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center bg-black/50 p-4 pt-[6rem] sm:pt-[7rem]"
      onClick={() => onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-search-title"
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-earth-200 bg-earth-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-earth-200 bg-white px-4 py-3 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 id="global-search-title" className="text-sm font-semibold text-earth-800 sm:text-base">
              {uiText.title}
            </h3>
            <button
              type="button"
              onClick={() => onClose?.()}
              className="rounded-md p-1 text-earth-500 transition hover:bg-earth-100 hover:text-earth-800"
              aria-label={uiText.closeAria}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-earth-400" aria-hidden>
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={uiText.placeholder}
              className="w-full rounded-lg border border-earth-200 bg-white py-3 pr-4 pl-11 text-earth-900 placeholder:text-earth-400 focus:border-earth-400 focus:outline-none focus:ring-2 focus:ring-earth-300"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-4 sm:p-5">
          {!canSearch ? (
            <p className="text-sm text-earth-600">{uiText.minChars}</p>
          ) : loadingDynamic ? (
            <p className="text-sm text-earth-600">{uiText.searching}</p>
          ) : totalResults === 0 ? (
            <p className="text-sm text-earth-600">
              {uiText.noResults.replace('{{query}}', query.trim())}
            </p>
          ) : (
            <div className="space-y-5">
              <ResultSection title={uiText.sections.pages} items={groupedResults.pages} onSelect={handleSelect} />
              <ResultSection title={uiText.sections.faq} items={groupedResults.faq} onSelect={handleSelect} />
              <ResultSection
                title={uiText.sections.directory}
                items={groupedResults.directory}
                onSelect={handleSelect}
              />
              <ResultSection
                title={uiText.sections.products}
                items={groupedResults.products}
                onSelect={handleSelect}
              />
              <ResultSection title={uiText.sections.groups} items={groupedResults.groups} onSelect={handleSelect} />
            </div>
          )}
          {hasError ? (
            <p className="mt-4 text-xs text-amber-700">
              {locale === LOCALE_EN
                ? 'Some dynamic results could not be loaded right now.'
                : 'Alguns resultados dinâmicos não puderam ser carregados agora.'}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}

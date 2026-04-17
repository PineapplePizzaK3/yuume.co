import { useEffect, useMemo, useState } from 'react'

const UNCATEGORIZED_KEY = '__uncategorized__'

function buildCategoryGroups(products, uncategorizedLabel) {
  const map = new Map()
  for (const p of products) {
    const raw = p?.category
    const has = raw != null && String(raw).trim() !== ''
    const key = has ? String(raw).trim() : UNCATEGORIZED_KEY
    const label = has ? String(raw).trim() : uncategorizedLabel
    if (!map.has(key)) map.set(key, { label, items: [] })
    map.get(key).items.push(p)
  }
  const entries = [...map.entries()].sort((a, b) => {
    if (a[0] === UNCATEGORIZED_KEY) return 1
    if (b[0] === UNCATEGORIZED_KEY) return -1
    return String(a[1].label).localeCompare(String(b[1].label), 'pt-BR')
  })
  return entries
}

/**
 * Agrupa produtos por campo `category`, com busca, chips de filtro por categoria e blocos colapsáveis.
 */
export default function StoreProductCategorySection({
  products = [],
  uncategorizedLabel = 'Sem categoria',
  searchPlaceholder = 'Buscar produto ou categoria…',
  filterAllLabel = 'Todas',
  gridClassName = 'grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  renderProduct,
}) {
  const [query, setQuery] = useState('')
  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  /** Chaves de categoria recolhidas pelo usuário; vazio = todas abertas (estado inicial). */
  const [collapsedCategoryKeys, setCollapsedCategoryKeys] = useState(() => new Set())

  const filteredBySearch = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => {
      const name = String(p.name || '').toLowerCase()
      const desc = String(p.description || '').toLowerCase()
      const cat = String(p.category || '').toLowerCase()
      return name.includes(q) || desc.includes(q) || cat.includes(q)
    })
  }, [products, query])

  const groupsFromSearch = useMemo(
    () => buildCategoryGroups(filteredBySearch, uncategorizedLabel),
    [filteredBySearch, uncategorizedLabel]
  )

  const allGroupsMeta = useMemo(
    () => buildCategoryGroups(products, uncategorizedLabel),
    [products, uncategorizedLabel]
  )

  const visibleGroups = useMemo(() => {
    if (selectedKeys.size === 0) return groupsFromSearch
    return groupsFromSearch.filter(([key]) => selectedKeys.has(key))
  }, [groupsFromSearch, selectedKeys])

  const toggleKey = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const clearFilter = () => setSelectedKeys(new Set())

  const visibleCategoryKeys = useMemo(() => visibleGroups.map(([k]) => k), [visibleGroups])

  useEffect(() => {
    const allowed = new Set(visibleCategoryKeys)
    setCollapsedCategoryKeys((prev) => {
      const next = new Set()
      for (const k of prev) {
        if (allowed.has(k)) next.add(k)
      }
      if (next.size === prev.size && [...prev].every((k) => next.has(k))) return prev
      return next
    })
  }, [visibleCategoryKeys])

  if (!products.length) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="min-w-[200px] flex-1 rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm text-earth-900"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearFilter}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              selectedKeys.size === 0
                ? 'border-earth-800 bg-earth-900 text-white'
                : 'border-earth-300 bg-white text-earth-700 hover:bg-earth-100'
            }`}
          >
            {filterAllLabel}
          </button>
          {allGroupsMeta.map(([key, { label }]) => {
            const filterActive = selectedKeys.size > 0
            const inFilter = selectedKeys.has(key)
            const dimmed = filterActive && !inFilter
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleKey(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  dimmed
                    ? 'border-earth-200 bg-earth-50 text-earth-400 opacity-60'
                    : filterActive && inFilter
                      ? 'border-earth-800 bg-earth-900 text-white'
                      : 'border-earth-200 bg-earth-100 text-earth-800'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <p className="text-sm text-earth-600">Nenhum produto corresponde aos filtros.</p>
      ) : (
        <div className="space-y-8">
          {visibleGroups.map(([key, { label, items }]) => {
            const isOpen = !collapsedCategoryKeys.has(key)
            return (
              <details
                key={key}
                open={isOpen}
                className="group"
                onToggle={(e) => {
                  const nextOpen = e.currentTarget.open
                  setCollapsedCategoryKeys((prev) => {
                    const next = new Set(prev)
                    if (nextOpen) next.delete(key)
                    else next.add(key)
                    return next
                  })
                }}
              >
                <summary className="cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-earth-800">
                    <span
                      className={`inline-block text-earth-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                      aria-hidden
                    >
                      ▸
                    </span>
                    <span>{label}</span>
                    <span className="text-xs font-normal text-earth-500">({items.length})</span>
                  </span>
                </summary>
                <div className={`mt-3 ${gridClassName}`}>{items.map((p) => renderProduct(p))}</div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}

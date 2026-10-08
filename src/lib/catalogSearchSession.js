const SESSION_KEY = 'catalog_search_public_session_v2'

function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function readCatalogSearchSession() {
  if (typeof window === 'undefined') return null
  try {
    return safeParse(window.sessionStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export function writeCatalogSearchSession(payload) {
  if (typeof window === 'undefined') return
  try {
    const query = String(payload?.query || '').trim()
    if (!query) return
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        query,
        stores: payload.stores || null,
        selectedStores: Array.isArray(payload.selectedStores) ? payload.selectedStores : [],
        results: Array.isArray(payload.results) ? payload.results : [],
        meta: payload.meta ?? null,
        partials: Array.isArray(payload.partials) ? payload.partials : [],
        cursors: payload.cursors ?? null,
        filters: payload.filters ?? null,
        filtersKey: payload.filtersKey || '',
        canAutoLoad: payload.canAutoLoad !== false,
        savedAt: Date.now(),
      }),
    )
  } catch {
    // ignore quota / private mode
  }
}

export function clearCatalogSearchSession() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

export function catalogSearchSessionMatches(session, { query, selectedStores, filtersKey } = {}) {
  if (!session) return false
  const q = String(query || '').trim()
  if (!q || session.query !== q) return false
  if (!Array.isArray(session.results)) return false
  if (Array.isArray(selectedStores) && selectedStores.length > 0) {
    const cached = Array.isArray(session.selectedStores) ? [...session.selectedStores].sort() : []
    const next = [...selectedStores].sort()
    if (cached.length && (cached.length !== next.length || cached.some((id, i) => id !== next[i]))) {
      return false
    }
  }
  if (filtersKey) {
    const saved = session.filtersKey || ''
    if (saved && saved !== filtersKey) return false
  }
  return true
}

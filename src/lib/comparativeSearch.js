/**
 * URLs de pesquisa comparativa por título do produto (abre em novas abas).
 */

function normalizeSearchQuery(title) {
  return String(title || '').trim().replace(/\s+/g, ' ')
}

function mercadoLivreSlug(query) {
  return encodeURIComponent(query)
    .replace(/%20/g, '-')
    .replace(/%2F/g, '-')
}

export const COMPARATIVE_SEARCH_SITES = [
  {
    id: 'olx',
    label: 'OLX',
    buildUrl: (query) => `https://www.olx.com.br/brasil?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'mercadolivre',
    label: 'Mercado Livre',
    buildUrl: (query) => `https://lista.mercadolivre.com.br/${mercadoLivreSlug(query)}`,
  },
  {
    id: 'google',
    label: 'Google',
    buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
]

export function buildComparativeSearchUrls(title) {
  const query = normalizeSearchQuery(title)
  if (!query) return []
  return COMPARATIVE_SEARCH_SITES.map((site) => ({
    id: site.id,
    label: site.label,
    url: site.buildUrl(query),
    query,
  }))
}

/** Abre pesquisas comparativas em novas abas. Retorna quantas abas tentou abrir. */
export function openComparativeSearchTabs(title) {
  const links = buildComparativeSearchUrls(title)
  for (const link of links) {
    window.open(link.url, '_blank', 'noopener,noreferrer')
  }
  return links.length
}

const OPENINGS_EXACT_PATHS = new Set([
  '/',
  '/en',
  '/rips',
  '/batches',
  '/lives',
  '/openings',
  '/colecao',
  '/item',
  '/explorar',
  '/japan-search',
  '/en/rips',
  '/en/batches',
  '/en/lives',
  '/en/openings',
  '/en/collection',
  '/en/item',
  '/en/explore',
  '/en/japan-search',
])

const OPENINGS_PREFIX_PATHS = [
  '/rips/',
  '/batches/',
  '/lives/',
  '/openings/',
  '/colecao/',
  '/item/',
  '/explorar/',
  '/en/rips/',
  '/en/batches/',
  '/en/lives/',
  '/en/openings/',
  '/en/collection/',
  '/en/item/',
  '/en/explore/',
]

export function isOpeningsPath(pathname = '') {
  const path = String(pathname || '').trim()
  if (OPENINGS_EXACT_PATHS.has(path)) return true
  return OPENINGS_PREFIX_PATHS.some((prefix) => path.startsWith(prefix))
}


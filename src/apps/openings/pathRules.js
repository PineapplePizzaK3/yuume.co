const OPENINGS_EXACT_PATHS = new Set([
  '/',
  '/en',
  '/rips',
  '/batches',
  '/lives',
  '/openings',
  '/colecao',
  '/japan-search',
  '/en/rips',
  '/en/batches',
  '/en/lives',
  '/en/openings',
  '/en/collection',
  '/en/japan-search',
])

const OPENINGS_PREFIX_PATHS = [
  '/rips/',
  '/batches/',
  '/lives/',
  '/openings/',
  '/colecao/',
  '/en/rips/',
  '/en/batches/',
  '/en/lives/',
  '/en/openings/',
  '/en/collection/',
]

export function isOpeningsPath(pathname = '') {
  const path = String(pathname || '').trim()
  if (OPENINGS_EXACT_PATHS.has(path)) return true
  return OPENINGS_PREFIX_PATHS.some((prefix) => path.startsWith(prefix))
}


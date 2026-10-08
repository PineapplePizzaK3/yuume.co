/**
 * Re-search the hottest catalog queries when their listing_index rows are stale.
 * Uses catalog-search (singleflight + store caps) so this does not duplicate user scrapes.
 *
 * Usage:
 *   node --env-file=.env scripts/catalog/refresh-hot-queries.mjs
 *   node --env-file=.env scripts/catalog/refresh-hot-queries.mjs --limit=10
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const limit = Math.min(40, Math.max(1, Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1]) || 15))
const DEFAULT_STORES = ['mercari', 'yahoo', 'yahoo_flea']

if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const fnUrl = `${String(url).replace(/\/$/, '')}/functions/v1/catalog-search`

const { data: rows, error } = await supabase.rpc('list_hot_search_queries', {
  p_limit: limit,
  p_stale_minutes: 30,
})
if (error) {
  console.error(error.message)
  process.exit(1)
}

const queries = Array.isArray(rows) ? rows : []
console.log(`hot queries to refresh: ${queries.length}`)

let ok = 0
let failed = 0
for (const row of queries) {
  const query = String(row.query_raw || row.query_norm || '').trim()
  if (query.length < 2) continue
  const stores = Array.isArray(row.stores) && row.stores.length ? row.stores : DEFAULT_STORES
  try {
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        stores,
        page: 1,
        pageSize: 24,
        mode: 'public',
        context: 'legacy',
        forceLive: true,
      }),
    })
    if (!response.ok) {
      failed += 1
      const text = await response.text()
      console.warn(`fail ${query}: HTTP ${response.status} ${text.slice(0, 180)}`)
      continue
    }
    ok += 1
    const payload = await response.json().catch(() => ({}))
    console.log(`ok ${query} (${stores.join(',')}) results=${Array.isArray(payload.results) ? payload.results.length : '?'}`)
  } catch (err) {
    failed += 1
    console.warn(`fail ${query}: ${err instanceof Error ? err.message : err}`)
  }
}

console.log(JSON.stringify({ refreshed: ok, failed, requested: queries.length }))

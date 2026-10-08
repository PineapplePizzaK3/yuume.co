/**
 * Drop expired listing_index rows, ephemeral snapshots, and search scale leftovers.
 *
 * Usage:
 *   node --env-file=.env scripts/catalog/cleanup-listing-index.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function runCleanup(name) {
  const { data, error } = await supabase.rpc(name)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}

const listing = await runCleanup('cleanup_expired_listing_index')
const ephemeral = await runCleanup('cleanup_expired_ephemeral_products')
const scale = await runCleanup('cleanup_search_scale_tables')

console.log(JSON.stringify({
  listing_index_deleted: listing,
  ephemeral_deleted: ephemeral,
  scale,
}, null, 2))

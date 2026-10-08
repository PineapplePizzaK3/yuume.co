/**
 * Step 10: refresh market_snapshots for wishlist + missing checklist items.
 * Only sources with can_automate_snapshots + cleared review_status (today: own_stock).
 *
 * Usage:
 *   node --env-file=.env scripts/catalog/refresh-market-snapshots.mjs
 *   node --env-file=.env scripts/catalog/refresh-market-snapshots.mjs --limit=40
 */
import { createClient } from '@supabase/supabase-js'
import { buildMarketQuery, classifyMatch } from '../../src/lib/market/marketQuery.js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const limit = Math.min(200, Math.max(1, Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1]) || 60))

if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function loadSnapshotSources() {
  const { data, error } = await supabase
    .from('market_sources')
    .select('id, enabled, review_status, can_automate_snapshots, max_cache_hours')
    .eq('enabled', true)
    .eq('can_automate_snapshots', true)
    .eq('review_status', 'cleared')
  if (error) throw error
  return data || []
}

async function loadTargetItems(max) {
  const { data: wish, error: wErr } = await supabase
    .from('wishlist_items')
    .select('catalog_item_id')
    .limit(max)
  if (wErr) throw wErr

  const ids = new Set((wish || []).map((r) => r.catalog_item_id).filter(Boolean))

  // Missing from tracked VERIFIED sets (bounded)
  const { data: tracked } = await supabase.from('tracked_sets').select('set_id').limit(40)
  const setIds = [...new Set((tracked || []).map((t) => t.set_id))]
  if (setIds.length) {
    const { data: sets } = await supabase
      .from('catalog_sets')
      .select('id')
      .in('id', setIds)
      .eq('status', 'VERIFIED')
    const verified = (sets || []).map((s) => s.id)
    if (verified.length) {
      const { data: items } = await supabase
        .from('catalog_items')
        .select('id')
        .in('set_id', verified)
        .eq('in_checklist', true)
        .limit(max)
      for (const row of items || []) ids.add(row.id)
    }
  }

  const list = [...ids].slice(0, max)
  if (!list.length) return []

  const { data: catalog, error } = await supabase
    .from('catalog_items')
    .select('id, number, name_ja, name_en, set:catalog_sets(set_code)')
    .in('id', list)
  if (error) throw error
  return catalog || []
}

async function matchOwnStock(item) {
  const q = buildMarketQuery({
    nameJa: item.name_ja,
    number: item.number,
    setCode: item.set?.set_code,
  })
  const term = (q.positive || item.name_ja || item.name_en || '').slice(0, 80)
  if (!term) {
    return { refresh_status: 'empty', listing_count: 0, query_used: q.query, match_quality: 'loose' }
  }

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, price_jpy, store_linked, is_active')
    .eq('store_linked', true)
    .ilike('name', `%${term.split(/\s+/)[0]}%`)
    .limit(20)

  if (error) {
    return { refresh_status: 'error', listing_count: 0, query_used: q.query, match_quality: 'loose' }
  }

  const scored = (products || [])
    .map((p) => {
      const price = Number(p.price_jpy ?? p.price) || null
      const quality = classifyMatch({ title: p.name }, item)
      return { ...p, price, quality }
    })
    .filter((p) => p.quality !== 'loose' && p.price != null)
    .sort((a, b) => a.price - b.price)

  if (!scored.length) {
    return {
      refresh_status: 'empty',
      listing_count: 0,
      query_used: q.query,
      match_quality: 'likely',
      best_price_jpy: null,
      median_price_jpy: null,
      best_url: null,
    }
  }

  const prices = scored.map((s) => s.price).sort((a, b) => a - b)
  const mid = prices[Math.floor(prices.length / 2)]
  return {
    refresh_status: 'ok',
    listing_count: scored.length,
    query_used: q.query,
    match_quality: scored[0].quality,
    best_price_jpy: prices[0],
    median_price_jpy: mid,
    best_url: null,
    acquisition_method: 'own_data',
  }
}

async function upsertSnapshot(catalogItemId, sourceId, payload) {
  const { data, error } = await supabase.rpc('service_market_upsert_snapshot', {
    p_payload: {
      catalog_item_id: catalogItemId,
      source_id: sourceId,
      fetched_by: 'snapshot_job',
      condition_scope: 'ungraded',
      ...payload,
    },
  })
  if (error) throw error
  return data
}

export async function runMarketSnapshotRefresh({ maxItems = limit } = {}) {
  const sources = await loadSnapshotSources()
  if (!sources.length) {
    return { ok: true, skipped: true, reason: 'no_snapshot_sources', upserted: 0 }
  }
  const items = await loadTargetItems(maxItems)
  let upserted = 0
  const errors = []

  for (const item of items) {
    for (const source of sources) {
      try {
        let payload
        if (source.id === 'own_stock') payload = await matchOwnStock(item)
        else {
          // Other cleared snapshot sources would plug in here after D1.
          payload = {
            refresh_status: 'blocked',
            listing_count: 0,
            match_quality: 'loose',
            query_used: null,
          }
        }
        if (payload.refresh_status === 'blocked') continue
        await upsertSnapshot(item.id, source.id, payload)
        upserted += 1
      } catch (e) {
        errors.push({ item: item.id, source: source.id, message: e?.message || String(e) })
      }
    }
  }

  return { ok: errors.length === 0, upserted, items: items.length, sources: sources.map((s) => s.id), errors }
}

const isMain = process.argv[1] && String(process.argv[1]).includes('refresh-market-snapshots')
if (isMain) {
  runMarketSnapshotRefresh()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2))
      if (!r.ok) process.exit(1)
    })
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}

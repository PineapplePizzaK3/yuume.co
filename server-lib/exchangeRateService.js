/**
 * Serviço de câmbio com BASE USD:
 * - USD_JPY
 * - USD_BRL
 *
 * Requisições da aplicação SEMPRE usam cache/memória ou banco.
 * Chamadas externas só no job de atualização.
 */

import { createClient } from '@supabase/supabase-js'

const MIN_REFRESH_INTERVAL_MS = Math.max(
  Number(process.env.EXCHANGE_RATE_MIN_REFRESH_MS) || (4 * 60 * 60 * 1000),
  5 * 60 * 1000
)

const g = globalThis.__exchangeRateServiceCache ?? {
  usd_jpy: null,
  usd_brl: null,
  updatedAt: 0,
  source: null,
}
globalThis.__exchangeRateServiceCache = g

function numOrNull(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function jpyUsdFromUsdJpy(usdJpy) {
  const n = numOrNull(usdJpy)
  if (!n) return null
  return 1 / n
}

function normalizeRates(raw) {
  const usd_jpy = numOrNull(raw?.usd_jpy)
  const usd_brl = numOrNull(raw?.usd_brl)
  if (!usd_jpy || !usd_brl) return null
  const updated_at = typeof raw?.updated_at === 'string' && raw.updated_at.trim()
    ? raw.updated_at.trim()
    : new Date().toISOString()
  const source = typeof raw?.source === 'string' && raw.source.trim()
    ? raw.source.trim()
    : 'unknown'
  const jpy_usd = jpyUsdFromUsdJpy(usd_jpy)
  if (!jpy_usd) return null
  return {
    USD_JPY: usd_jpy,
    USD_BRL: usd_brl,
    updated_at,
    source,
    // compatibilidade legada (checkout/SQL atual)
    usd_jpy,
    usd_brl,
    jpy_usd,
  }
}

async function fetchCurrencyApiUsdBase() {
  const apiKey = String(process.env.CURRENCYAPI_KEY || '').trim()
  if (!apiKey) return null
  const url = `https://api.currencyapi.com/v3/latest?apikey=${encodeURIComponent(apiKey)}&base_currency=USD&currencies=JPY,BRL`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return normalizeRates({
    usd_jpy: data?.data?.JPY?.value,
    usd_brl: data?.data?.BRL?.value,
    updated_at: new Date().toISOString(),
    source: 'currencyapi',
  })
}

async function fetchFrankfurterUsdBase() {
  const url = 'https://api.frankfurter.app/latest?from=USD&to=JPY,BRL'
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return normalizeRates({
    usd_jpy: data?.rates?.JPY,
    usd_brl: data?.rates?.BRL,
    updated_at: new Date().toISOString(),
    source: 'frankfurter_fallback',
  })
}

/**
 * Busca cotações externas (uso recomendado: apenas no job).
 */
export async function fetchCommercialRatesFromApis() {
  const primary = await fetchCurrencyApiUsdBase()
  if (primary) return primary
  return fetchFrankfurterUsdBase()
}

function envFallbackRates() {
  const usd_jpy = numOrNull(process.env.FALLBACK_FX_USD_JPY)
  const usd_brl = numOrNull(process.env.FALLBACK_FX_USD_BRL)
  if (usd_jpy && usd_brl) {
    return normalizeRates({
      usd_jpy,
      usd_brl,
      updated_at: new Date().toISOString(),
      source: 'env_fallback',
    })
  }

  // compatibilidade com env antigo
  const legacyJpyUsd = numOrNull(process.env.FALLBACK_FX_JPY_USD)
  const legacyUsdBrl = numOrNull(process.env.FALLBACK_FX_USD_BRL)
  if (legacyJpyUsd && legacyUsdBrl) {
    return normalizeRates({
      usd_jpy: 1 / legacyJpyUsd,
      usd_brl: legacyUsdBrl,
      updated_at: new Date().toISOString(),
      source: 'env_fallback_legacy',
    })
  }
  return null
}

async function loadRatesFromSupabase(supabase) {
  if (!supabase) return null
  try {
    const { data: rows } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['fx_usd_jpy', 'fx_usd_brl', 'fx_jpy_usd', 'fx_rates_updated_at', 'fx_rates_source'])
    if (!rows?.length) return null

    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    const usd_jpy_direct = numOrNull(map.fx_usd_jpy?.amount)
    const usd_brl = numOrNull(map.fx_usd_brl?.amount)
    const legacy_jpy_usd = numOrNull(map.fx_jpy_usd?.amount)
    const usd_jpy = usd_jpy_direct || (legacy_jpy_usd ? 1 / legacy_jpy_usd : null)
    if (!usd_jpy || !usd_brl) return null

    const updated_at = typeof map.fx_rates_updated_at?.text === 'string' && map.fx_rates_updated_at.text.trim()
      ? map.fx_rates_updated_at.text.trim()
      : new Date(0).toISOString()
    const source = typeof map.fx_rates_source?.text === 'string' && map.fx_rates_source.text.trim()
      ? map.fx_rates_source.text.trim()
      : 'supabase'

    return normalizeRates({ usd_jpy, usd_brl, updated_at, source })
  } catch (e) {
    console.error('loadRatesFromSupabase:', e?.message || e)
    return null
  }
}

function getSupabaseServiceRoleClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    return createClient(url, key)
  } catch {
    return null
  }
}

function setMemoryCache(rates) {
  if (!rates?.usd_jpy || !rates?.usd_brl) return
  g.usd_jpy = rates.usd_jpy
  g.usd_brl = rates.usd_brl
  g.updatedAt = Date.parse(rates.updated_at) || Date.now()
  g.source = rates.source
}

function getMemoryCache() {
  if (!g.usd_jpy || !g.usd_brl) return null
  return normalizeRates({
    usd_jpy: g.usd_jpy,
    usd_brl: g.usd_brl,
    updated_at: new Date(g.updatedAt || Date.now()).toISOString(),
    source: g.source || 'memory',
  })
}

export async function persistRatesToSupabase(supabase, rates) {
  if (!supabase || !rates?.usd_jpy || !rates?.usd_brl) return
  const ts = rates.updated_at || new Date().toISOString()
  const source = rates.source || 'unknown'
  const payload = [
    { key: 'fx_usd_jpy', value: { amount: rates.usd_jpy } },
    { key: 'fx_usd_brl', value: { amount: rates.usd_brl } },
    // compatibilidade com SQL legado enquanto migra
    { key: 'fx_jpy_usd', value: { amount: rates.jpy_usd } },
    { key: 'fx_rates_updated_at', value: { text: ts } },
    { key: 'fx_rates_source', value: { text: source } },
  ]

  for (const row of payload) {
    await supabase.from('system_settings').upsert(
      { key: row.key, value: row.value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  }
}

/**
 * Grava cotações no Supabase preferindo service role.
 */
export async function persistRatesToSupabasePreferAdmin(supabase, rates) {
  if (!rates?.usd_jpy || !rates?.usd_brl) return
  const admin = getSupabaseServiceRoleClient()
  const client = admin || supabase
  if (!client) return
  try {
    await persistRatesToSupabase(client, rates)
  } catch (e) {
    console.error('persistRatesToSupabase:', e?.message || e)
  }
}

/**
 * Atualiza cotações (uso no job/cron). Em caso de falha, mantém último valor disponível.
 */
export async function refreshExchangeRatesJob(supabase) {
  const current = getMemoryCache() || await loadRatesFromSupabase(supabase)
  if (current) {
    setMemoryCache(current)
    const updatedAtMs = Date.parse(current.updated_at) || 0
    const ageMs = updatedAtMs > 0 ? (Date.now() - updatedAtMs) : Number.POSITIVE_INFINITY
    if (ageMs >= 0 && ageMs < MIN_REFRESH_INTERVAL_MS) {
      return normalizeRates({ ...current, source: `${current.source}_within_refresh_window` })
    }
  }

  const live = await fetchCommercialRatesFromApis()
  if (live) {
    setMemoryCache(live)
    await persistRatesToSupabasePreferAdmin(supabase, live)
    return live
  }

  console.error('refreshExchangeRatesJob: provider unavailable, using stale cached rates')
  const fromDb = await loadRatesFromSupabase(supabase)
  if (fromDb) {
    setMemoryCache(fromDb)
    return normalizeRates({ ...fromDb, source: `${fromDb.source}_stale` })
  }

  const fallback = envFallbackRates()
  if (fallback) {
    setMemoryCache(fallback)
    return fallback
  }
  return null
}

/**
 * Interface de leitura: sempre retorna de memória/db/env (sem chamada externa).
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {{ forceRefresh?: boolean }} opts
 */
export async function getExchangeRates(supabase, opts = {}) {
  if (opts.forceRefresh) {
    return refreshExchangeRatesJob(supabase)
  }

  const mem = getMemoryCache()
  if (mem) return mem

  const db = await loadRatesFromSupabase(supabase)
  if (db) {
    setMemoryCache(db)
    return db
  }

  const fb = envFallbackRates()
  if (fb) {
    setMemoryCache(fb)
    return fb
  }

  return null
}

export async function getExchangeRatesOrThrow(supabase) {
  const r = await getExchangeRates(supabase)
  if (!r?.usd_jpy || !r?.usd_brl) {
    throw new Error(
      'Câmbio indisponível. Rode o cron de atualização ou configure FALLBACK_FX_USD_JPY/FALLBACK_FX_USD_BRL.'
    )
  }
  return r
}

/**
 * Cotações comerciais JPY→USD e USD→BRL, cache 15 min, fallback a último valor (memória / env / Supabase).
 */

const TTL_MS = Math.min(Math.max(Number(process.env.EXCHANGE_RATE_TTL_MS) || 900000, 60000), 3600000)

const g = globalThis.__exchangeRateServiceCache ?? {
  jpy_usd: null,
  usd_brl: null,
  updatedAt: 0,
  source: null,
}
globalThis.__exchangeRateServiceCache = g

function numOrNull(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function fetchFrankfurter(from, to) {
  const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  const rate = numOrNull(data?.rates?.[to])
  return rate
}

/**
 * Tenta provedores comerciais (Frankfurter ECB-based).
 * jpy_usd = USD por 1 JPY. usd_brl = BRL por 1 USD.
 */
export async function fetchCommercialRatesFromApis() {
  const [jpyUsd, usdBrl] = await Promise.all([
    fetchFrankfurter('JPY', 'USD'),
    fetchFrankfurter('USD', 'BRL'),
  ])
  if (!jpyUsd || !usdBrl) return null
  return {
    jpy_usd: jpyUsd,
    usd_brl: usdBrl,
    updated_at: new Date().toISOString(),
    source: 'frankfurter',
  }
}

function envFallbackRates() {
  const jpy_usd = numOrNull(process.env.FALLBACK_FX_JPY_USD)
  const usd_brl = numOrNull(process.env.FALLBACK_FX_USD_BRL)
  if (!jpy_usd || !usd_brl) return null
  return {
    jpy_usd,
    usd_brl,
    updated_at: new Date().toISOString(),
    source: 'env_fallback',
  }
}

async function loadRatesFromSupabase(supabase) {
  if (!supabase) return null
  try {
    const { data: rows } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['fx_jpy_usd', 'fx_usd_brl', 'fx_rates_updated_at'])
    if (!rows?.length) return null
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    const jpy_usd = numOrNull(map.fx_jpy_usd?.amount)
    const usd_brl = numOrNull(map.fx_usd_brl?.amount)
    if (!jpy_usd || !usd_brl) return null
    const updated_at =
      typeof map.fx_rates_updated_at?.text === 'string' && map.fx_rates_updated_at.text.trim()
        ? map.fx_rates_updated_at.text.trim()
        : new Date(0).toISOString()
    return { jpy_usd, usd_brl, updated_at, source: 'supabase' }
  } catch {
    return null
  }
}

export async function persistRatesToSupabase(supabase, rates) {
  if (!supabase || !rates?.jpy_usd || !rates?.usd_brl) return
  const ts = rates.updated_at || new Date().toISOString()
  const payload = [
    { key: 'fx_jpy_usd', value: { amount: rates.jpy_usd } },
    { key: 'fx_usd_brl', value: { amount: rates.usd_brl } },
    { key: 'fx_rates_updated_at', value: { text: ts } },
  ]
  for (const row of payload) {
    await supabase.from('system_settings').upsert(
      { key: row.key, value: row.value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  }
}

/**
 * Retorna cotações válidas (cache 15 min) ou busca / fallback.
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {{ forceRefresh?: boolean }} opts
 */
export async function getExchangeRates(supabase, opts = {}) {
  const now = Date.now()
  if (
    !opts.forceRefresh
    && g.jpy_usd
    && g.usd_brl
    && now - g.updatedAt < TTL_MS
  ) {
    return {
      jpy_usd: g.jpy_usd,
      usd_brl: g.usd_brl,
      updated_at: new Date(g.updatedAt).toISOString(),
      source: g.source || 'memory',
    }
  }

  const live = await fetchCommercialRatesFromApis()
  if (live) {
    g.jpy_usd = live.jpy_usd
    g.usd_brl = live.usd_brl
    g.updatedAt = Date.now()
    g.source = live.source
    if (supabase) await persistRatesToSupabase(supabase, live).catch(() => null)
    return live
  }

  const db = await loadRatesFromSupabase(supabase)
  if (db) {
    g.jpy_usd = db.jpy_usd
    g.usd_brl = db.usd_brl
    g.updatedAt = Date.parse(db.updated_at) || now
    g.source = db.source
    return db
  }

  const fb = envFallbackRates()
  if (fb) {
    g.jpy_usd = fb.jpy_usd
    g.usd_brl = fb.usd_brl
    g.updatedAt = now
    g.source = fb.source
    return fb
  }

  return null
}

/**
 * Para checkout: falha se não houver nenhuma cotação utilizável.
 */
export async function getExchangeRatesOrThrow(supabase) {
  const r = await getExchangeRates(supabase)
  if (!r?.jpy_usd || !r?.usd_brl) {
    throw new Error(
      'Câmbio indisponível. Aguarde alguns minutos ou configure FALLBACK_FX_JPY_USD e FALLBACK_FX_USD_BRL no servidor.'
    )
  }
  return r
}

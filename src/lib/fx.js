const DEFAULT_FX_BRL_PER_JPY = 0.033
/** USD per 1 JPY (e.g. ~0.0067 @ ¥150/USD) */
const DEFAULT_FX_USD_PER_JPY = 0.0067
const FX_CACHE_KEY = 'fx_brl_per_jpy_cache_v1'
const FX_REFRESH_MS = 1000 * 60 * 60 // 1h

const envRate = Number(import.meta.env.VITE_FX_BRL_PER_JPY)
const envUsdPerJpy = Number(import.meta.env.VITE_FX_USD_PER_JPY)
function normalizeBrlPerJpy(rawRate) {
  const n = Number(rawRate)
  if (!Number.isFinite(n) || n <= 0) return null
  // Normal esperado: BRL por 1 JPY (~0.02 a ~0.20).
  if (n >= 0.002 && n <= 0.5) return n
  // Se vier invertido (JPY por 1 BRL, ex: ~30), inverte.
  if (n > 1) {
    const inv = 1 / n
    if (inv >= 0.002 && inv <= 0.5) return inv
  }
  return null
}

function normalizeUsdPerJpy(rawRate) {
  const n = Number(rawRate)
  if (!Number.isFinite(n) || n <= 0) return null
  // Normal: USD per 1 JPY (~0.004–0.02).
  if (n >= 0.003 && n <= 0.03) return n
  // Invertido: JPY por 1 USD (~100–200).
  if (n >= 50 && n <= 250) {
    const inv = 1 / n
    if (inv >= 0.003 && inv <= 0.03) return inv
  }
  return null
}

const initialRate = normalizeBrlPerJpy(envRate) ?? DEFAULT_FX_BRL_PER_JPY
const initialUsdPerJpy = normalizeUsdPerJpy(envUsdPerJpy) ?? DEFAULT_FX_USD_PER_JPY
let currentFxBrlPerJpy = initialRate
let currentFxUsdPerJpy = initialUsdPerJpy
let lastFxUpdatedAt = 0
let refreshInFlight = null

function getDayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10)
}

if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem(FX_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const rate = normalizeBrlPerJpy(parsed?.rate)
      const usdRate = normalizeUsdPerJpy(parsed?.usdPerJpy)
      const updatedAt = Number(parsed?.updatedAt)
      if (rate) currentFxBrlPerJpy = rate
      if (usdRate) currentFxUsdPerJpy = usdRate
      if (updatedAt > 0) lastFxUpdatedAt = updatedAt
    }
  } catch {
    // noop
  }
}

function persistFxRates(brlRate, usdPerJpyRate) {
  if (typeof window === 'undefined') return
  const brl = normalizeBrlPerJpy(brlRate)
  const usd = normalizeUsdPerJpy(usdPerJpyRate)
  if (!brl && !usd) return
  try {
    window.localStorage.setItem(
      FX_CACHE_KEY,
      JSON.stringify({
        rate: brl ?? currentFxBrlPerJpy,
        usdPerJpy: usd ?? currentFxUsdPerJpy,
        updatedAt: Date.now(),
      }),
    )
  } catch {
    // noop
  }
}

async function fetchBrlPerJpyFromProviders() {
  const providers = [
    {
      url: 'https://api.frankfurter.app/latest?from=JPY&to=BRL',
      read: (json) => Number(json?.rates?.BRL),
    },
    {
      url: 'https://economia.awesomeapi.com.br/json/last/JPY-BRL',
      read: (json) => Number(json?.JPYBRL?.bid),
    },
  ]

  for (const provider of providers) {
    try {
      const res = await fetch(provider.url, { cache: 'no-store' })
      if (!res.ok) continue
      const data = await res.json()
      const rate = normalizeBrlPerJpy(provider.read(data))
      if (rate) return rate
    } catch {
      // try next provider
    }
  }
  return null
}

async function fetchUsdPerJpyFromProviders() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=JPY&to=USD', {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return normalizeUsdPerJpy(data?.rates?.USD)
  } catch {
    return null
  }
}

export async function refreshFxRate(force = false) {
  const now = Date.now()
  const dayChanged = lastFxUpdatedAt > 0 && getDayKey(now) !== getDayKey(lastFxUpdatedAt)
  if (!force && !dayChanged && now - lastFxUpdatedAt < FX_REFRESH_MS) return currentFxBrlPerJpy
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const [liveBrl, liveUsd] = await Promise.all([
      fetchBrlPerJpyFromProviders(),
      fetchUsdPerJpyFromProviders(),
    ])
    let touched = false
    if (liveBrl) {
      currentFxBrlPerJpy = liveBrl
      touched = true
    }
    if (liveUsd) {
      currentFxUsdPerJpy = liveUsd
      touched = true
    }
    if (touched) {
      lastFxUpdatedAt = Date.now()
      persistFxRates(currentFxBrlPerJpy, currentFxUsdPerJpy)
    } else if (!lastFxUpdatedAt) {
      currentFxBrlPerJpy = initialRate
      currentFxUsdPerJpy = initialUsdPerJpy
    }
    return currentFxBrlPerJpy
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

export function getFxBrlPerJpy() {
  if (typeof window !== 'undefined') {
    const now = Date.now()
    const dayChanged = lastFxUpdatedAt > 0 && getDayKey(now) !== getDayKey(lastFxUpdatedAt)
    if (dayChanged || now - lastFxUpdatedAt >= FX_REFRESH_MS) {
      void refreshFxRate(dayChanged)
    }
  }
  return currentFxBrlPerJpy
}

export function getFxUsdPerJpy() {
  if (typeof window !== 'undefined') {
    const now = Date.now()
    const dayChanged = lastFxUpdatedAt > 0 && getDayKey(now) !== getDayKey(lastFxUpdatedAt)
    if (dayChanged || now - lastFxUpdatedAt >= FX_REFRESH_MS) {
      void refreshFxRate(dayChanged)
    }
  }
  return currentFxUsdPerJpy
}

export function jpyToApproxUsd(jpy) {
  const n = Number(jpy) || 0
  return n * getFxUsdPerJpy()
}

export function brlToApproxUsd(brl) {
  return jpyToApproxUsd(brlToJpy(brl))
}

export function brlToJpy(brl) {
  const fx = getFxBrlPerJpy()
  const n = Number(brl) || 0
  return n / fx
}

export function jpyToBrl(jpy) {
  const fx = getFxBrlPerJpy()
  const n = Number(jpy) || 0
  return n * fx
}

export function formatJPY(v) {
  return Number(v)?.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY' }) ?? '—'
}

export function formatBRL(v) {
  return Number(v)?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
}

/** Converte BRL → JPY usando a taxa BRL por 1 JPY. */
export function brlToYen(brl, brlPerJpy) {
  const rate = Number(brlPerJpy) || 0
  const v = Number(brl) || 0
  if (rate <= 0) return 0
  return Math.round(v / rate)
}

/** Converte JPY → BRL usando a taxa BRL por 1 JPY. */
export function yenToBrl(yen, brlPerJpy) {
  return (Number(yen) || 0) * (Number(brlPerJpy) || 0)
}

/** Exibe valor em JPY e BRL (ex.: "¥1,000 · R$ 35,00"). */
export function formatJpyBrlPair(yen, brl) {
  return `${formatJPY(yen)} · ${formatBRL(brl)}`
}

export function formatPairFromYen(yen, brlPerJpy) {
  return formatJpyBrlPair(yen, yenToBrl(yen, brlPerJpy))
}

export function formatPairFromBrl(brl, brlPerJpy) {
  return formatJpyBrlPair(brlToYen(brl, brlPerJpy), brl)
}

export function formatUSD(v) {
  return Number(v)?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) ?? '—'
}

/** Formata peso em kg para exibição (usa g se < 1 kg). */
export function formatWeight(weightKg) {
  const kg = Number(weightKg)
  if (!Number.isFinite(kg) || kg <= 0) return '—'
  if (kg < 1) return `${Math.round(kg * 1000)} g`
  return `${kg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`
}


const DEFAULT_FX_BRL_PER_JPY = 0.033
const FX_CACHE_KEY = 'fx_brl_per_jpy_cache_v1'
const FX_REFRESH_MS = 1000 * 60 * 60 // 1h

const envRate = Number(import.meta.env.VITE_FX_BRL_PER_JPY)
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

const initialRate = normalizeBrlPerJpy(envRate) ?? DEFAULT_FX_BRL_PER_JPY
let currentFxBrlPerJpy = initialRate
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
      const updatedAt = Number(parsed?.updatedAt)
      if (rate) currentFxBrlPerJpy = rate
      if (updatedAt > 0) lastFxUpdatedAt = updatedAt
    }
  } catch {
    // noop
  }
}

function persistFxRate(rate) {
  const normalized = normalizeBrlPerJpy(rate)
  if (!normalized) return
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      FX_CACHE_KEY,
      JSON.stringify({ rate: normalized, updatedAt: Date.now() })
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

export async function refreshFxRate(force = false) {
  const now = Date.now()
  const dayChanged = lastFxUpdatedAt > 0 && getDayKey(now) !== getDayKey(lastFxUpdatedAt)
  if (!force && !dayChanged && now - lastFxUpdatedAt < FX_REFRESH_MS) return currentFxBrlPerJpy
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const liveRate = normalizeBrlPerJpy(await fetchBrlPerJpyFromProviders())
    if (liveRate) {
      currentFxBrlPerJpy = liveRate
      lastFxUpdatedAt = Date.now()
      persistFxRate(liveRate)
    } else if (!lastFxUpdatedAt) {
      // Mantém fallback da env/default quando não houver cache/local.
      currentFxBrlPerJpy = initialRate
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

/** Formata peso em kg para exibição (usa g se < 1 kg). */
export function formatWeight(weightKg) {
  const kg = Number(weightKg)
  if (!Number.isFinite(kg) || kg <= 0) return '—'
  if (kg < 1) return `${Math.round(kg * 1000)} g`
  return `${kg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`
}


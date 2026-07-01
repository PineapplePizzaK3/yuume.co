import { useEffect, useState } from 'react'
import { fetchExchangeRates } from '../services/paymentService'
import { normalizePricingRates } from '../lib/productSalePrice'

let cachedRates = null
let cacheAt = 0
let inflight = null
const CACHE_MS = 5 * 60 * 1000

async function loadExchangeRates(force = false) {
  const now = Date.now()
  if (!force && cachedRates && now - cacheAt < CACHE_MS) {
    return cachedRates
  }
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const res = await fetchExchangeRates()
      if (res?.ok !== false && Number(res?.usd_brl) > 0) {
        cachedRates = normalizePricingRates(res)
        cacheAt = Date.now()
        return cachedRates
      }
    } catch {
      // keep stale cache if any
    } finally {
      inflight = null
    }
    return cachedRates
  })()

  return inflight
}

/**
 * Cotações para precificação (jpy_usd_charge, effective_brl_per_jpy, etc.).
 * @param {{ enabled?: boolean }} [opts]
 */
export function useExchangeRates({ enabled = true } = {}) {
  const [rates, setRates] = useState(cachedRates)
  const [loading, setLoading] = useState(enabled && !cachedRates)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) return
    let active = true
    setLoading(!cachedRates)
    void loadExchangeRates()
      .then((next) => {
        if (!active) return
        if (next) {
          setRates(next)
          setError(null)
        } else {
          setError('Câmbio indisponível')
        }
      })
      .catch((e) => {
        if (!active) return
        setError(e?.message || 'Câmbio indisponível')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [enabled])

  return { rates, loading, error, refresh: () => loadExchangeRates(true) }
}

export { loadExchangeRates }

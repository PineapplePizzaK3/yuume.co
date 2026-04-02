import { createClient } from '@supabase/supabase-js'
import { getExchangeRates } from './exchangeRateService.js'
import {
  effectiveBrlPerJpy,
  getPricingPercentsFromEnv,
  pricingMultiplierFromPercents,
} from './pricingEngine.js'

function getSupabaseAnon() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function handleExchangeRatesGet(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const supabase = getSupabaseAnon()
    const rates = await getExchangeRates(supabase)
    if (!rates) {
      return res.status(503).json({
        error: 'Câmbio temporariamente indisponível',
        jpy_usd: null,
        usd_brl: null,
        updated_at: null,
      })
    }
    const mult = pricingMultiplierFromPercents(getPricingPercentsFromEnv())
    const effective_brl_per_jpy = effectiveBrlPerJpy(rates.jpy_usd, rates.usd_brl, mult)
    return res.status(200).json({
      jpy_usd: rates.jpy_usd,
      usd_brl: rates.usd_brl,
      updated_at: rates.updated_at,
      source: rates.source,
      effective_brl_per_jpy: effective_brl_per_jpy || null,
    })
  } catch (e) {
    console.error('exchange-rates:', e)
    return res.status(500).json({ error: e?.message || 'Erro interno' })
  }
}

import { createClient } from '@supabase/supabase-js'
import { fetchCommercialRatesFromApis, persistRatesToSupabase } from './exchangeRateService.js'
import { jpyToFinalUsd, usdToBrlDisplay } from './pricingEngine.js'

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function authorizeCron(req) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return true
  const auth = String(req.headers?.authorization || '').trim()
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const header = String(req.headers?.['x-cron-secret'] || '').trim()
  return bearer === secret || header === secret
}

export async function handleCronRefreshExchangeRates(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!authorizeCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase admin not configured' })
  }

  try {
    let rates = await fetchCommercialRatesFromApis()
    if (!rates) {
      const { data: rows } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['fx_jpy_usd', 'fx_usd_brl'])
      const map = Object.fromEntries((rows || []).map((r) => [r.key, r.value]))
      const jpy_usd = Number(map.fx_jpy_usd?.amount)
      const usd_brl = Number(map.fx_usd_brl?.amount)
      if (Number.isFinite(jpy_usd) && jpy_usd > 0 && Number.isFinite(usd_brl) && usd_brl > 0) {
        rates = {
          jpy_usd,
          usd_brl,
          updated_at: new Date().toISOString(),
          source: 'supabase_stale',
        }
      }
    } else {
      await persistRatesToSupabase(supabase, rates)
    }

    if (!rates) {
      return res.status(500).json({ ok: false, error: 'No exchange rates available' })
    }

    const pageSize = 500
    let offset = 0
    let updated = 0
    for (;;) {
      const { data: batch, error } = await supabase
        .from('products')
        .select('id, price, price_jpy')
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1)
      if (error) throw error
      if (!batch?.length) break
      for (const row of batch) {
        const jpy = Number(row.price_jpy ?? row.price) || 0
        if (jpy <= 0) continue
        const usd = jpyToFinalUsd(jpy, rates.jpy_usd)
        const brl = usdToBrlDisplay(usd, rates.usd_brl)
        await supabase
          .from('products')
          .update({
            price_usd: Number(usd.toFixed(4)),
            price_brl: Number(brl.toFixed(2)),
          })
          .eq('id', row.id)
        updated += 1
      }
      if (batch.length < pageSize) break
      offset += pageSize
    }

    return res.status(200).json({
      ok: true,
      rates: { jpy_usd: rates.jpy_usd, usd_brl: rates.usd_brl },
      products_updated: updated,
    })
  } catch (e) {
    console.error('cron-refresh-exchange-rates:', e)
    return res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
}

import { createClient } from '@supabase/supabase-js'
import { refreshExchangeRatesJob } from './exchangeRateService.js'
import { jpyToFinalUsd, usdToBrlDisplay } from './pricingEngine.js'
import { resolveWiseWithdrawalMarkupPercent } from './wiseWithdrawalMarkup.js'

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
    const rates = await refreshExchangeRatesJob(supabase)

    if (!rates) {
      return res.status(500).json({ ok: false, error: 'No exchange rates available' })
    }

    const wiseMarkup = await resolveWiseWithdrawalMarkupPercent(supabase)

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
        const usd = jpyToFinalUsd(jpy, rates.jpy_usd, wiseMarkup)
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
      rates: {
        USD_JPY: rates.usd_jpy,
        USD_BRL: rates.usd_brl,
        jpy_usd: rates.jpy_usd,
        usd_brl: rates.usd_brl,
      },
      updated_at: rates.updated_at,
      source: rates.source,
      products_updated: updated,
    })
  } catch (e) {
    console.error('cron-refresh-exchange-rates:', e)
    return res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
}

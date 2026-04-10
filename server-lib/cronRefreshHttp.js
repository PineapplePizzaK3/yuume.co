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

function readForceExternal(req) {
  const h = String(req.headers?.['x-cron-force-external'] || '').trim().toLowerCase()
  if (h === '1' || h === 'true' || h === 'yes') return true
  const q = req.query?.force_external
  const raw = Array.isArray(q) ? q[0] : q
  const s = String(raw ?? '').trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

function readForceRun(req) {
  const h = String(req.headers?.['x-cron-force'] || '').trim().toLowerCase()
  if (h === '1' || h === 'true' || h === 'yes') return true
  const q = req.query?.force
  const raw = Array.isArray(q) ? q[0] : q
  const s = String(raw ?? '').trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

async function scrapeProductViaEdge(url) {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  if (!supabaseUrl) throw new Error('SUPABASE_URL não configurado')
  const authToken = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim()
  if (!authToken) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/scrape-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    })
    let payload = null
    try {
      payload = await res.json()
    } catch {
      payload = null
    }
    if (!res.ok || payload?.error) {
      throw new Error(payload?.error || `scrape-product HTTP ${res.status}`)
    }
    return payload || null
  } finally {
    clearTimeout(timeout)
  }
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
    const secretConfigured = String(process.env.CRON_SECRET || '').trim()
    const forceExternal =
      !!secretConfigured && authorizeCron(req) && readForceExternal(req)
    const rates = await refreshExchangeRatesJob(supabase, { forceExternal })

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

export async function handleCronRefreshOnlineGroupPrices(req, res) {
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
    const stateKey = 'cron_online_group_prices_last_run_at'
    const minIntervalMs = 6 * 60 * 60 * 1000
    const forceRun = readForceRun(req)
    const { data: stateRow } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', stateKey)
      .maybeSingle()
    const lastRunAt = stateRow?.value?.last_run_at ? Date.parse(String(stateRow.value.last_run_at)) : NaN
    if (!forceRun && Number.isFinite(lastRunAt)) {
      const elapsedMs = Date.now() - lastRunAt
      if (elapsedMs >= 0 && elapsedMs < minIntervalMs) {
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: 'min_interval_not_reached',
          next_run_in_ms: minIntervalMs - elapsedMs,
        })
      }
    }

    const { data: groups, error: groupsError } = await supabase
      .from('purchase_groups')
      .select('id')
      .eq('is_active', true)
      .eq('source', 'scheduled')
      .eq('destination', 'online')
    if (groupsError) throw groupsError

    const groupIds = (groups ?? []).map((g) => g.id).filter(Boolean)
    if (!groupIds.length) {
      return res.status(200).json({ ok: true, message: 'No online groups found', checked: 0, updated: 0, failed: 0 })
    }

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, purchase_group_id, source_url, price, price_jpy')
      .eq('is_active', true)
      .in('purchase_group_id', groupIds)
      .not('source_url', 'is', null)
    if (productsError) throw productsError

    const candidates = (products ?? []).filter((p) => /^https?:\/\//i.test(String(p?.source_url || '').trim()))
    const concurrency = 3
    let index = 0
    let checked = 0
    let updated = 0
    let failed = 0
    const failures = []

    const worker = async () => {
      while (index < candidates.length) {
        const current = candidates[index]
        index += 1
        checked += 1
        try {
          const data = await scrapeProductViaEdge(String(current.source_url).trim())
          const nextPrice = Number(data?.price)
          if (!Number.isFinite(nextPrice) || nextPrice <= 0) continue
          const normalizedPrice = Math.round(nextPrice)
          const nextImage = data?.imageUrl ? String(data.imageUrl).trim() : null
          const patch = {
            price: normalizedPrice,
            price_jpy: normalizedPrice,
          }
          if (nextImage) patch.image_url = nextImage
          const { error: updateError } = await supabase
            .from('products')
            .update(patch)
            .eq('id', current.id)
          if (updateError) throw updateError
          updated += 1
        } catch (e) {
          failed += 1
          if (failures.length < 20) {
            failures.push({
              product_id: current.id,
              source_url: current.source_url,
              error: e?.message || String(e),
            })
          }
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    await supabase
      .from('system_settings')
      .upsert(
        {
          key: stateKey,
          value: {
            last_run_at: new Date().toISOString(),
            checked,
            updated,
            failed,
          },
        },
        { onConflict: 'key' }
      )

    return res.status(200).json({
      ok: true,
      checked,
      updated,
      failed,
      failures,
    })
  } catch (e) {
    console.error('cron-refresh-online-group-prices:', e)
    return res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
}

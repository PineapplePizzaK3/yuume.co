import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'

export async function getOrCreateMyAffiliate(userId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('get_or_create_affiliate', { p_user_id: userId || null })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function recordAffiliateClick({
  code,
  sessionKey = null,
  source = null,
  utm = {},
  timezone = null,
  pagesVisited = null,
  geoCountry = null,
  ipCountry = null,
}) {
  try {
    const res = await fetch('/api/affiliate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'track_click',
        code,
        sessionKey,
        source,
        utm: utm || {},
        timezone,
        pagesVisited,
        geoCountry,
        ipCountry,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: { message: json?.error || 'Erro ao registrar clique de afiliado' } }
    return { data: json ?? null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function trackAffiliateOrder({
  orderId,
  code,
  accessToken,
  timezone = null,
  pagesVisited = null,
  geoCountry = null,
  ipCountry = null,
}) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    const res = await fetch('/api/affiliate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'track_order',
        orderId,
        code,
        timezone,
        pagesVisited,
        geoCountry,
        ipCountry,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: { message: json?.error || 'Erro ao vincular pedido ao afiliado' } }
    return { data: json ?? null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function getMyAffiliateDashboard(userId) {
  try {
    const { data: affiliateData, error: affiliateErr } = await getOrCreateMyAffiliate(userId)
    if (affiliateErr || !affiliateData?.id) return { data: null, error: affiliateErr || { message: 'Afiliado não encontrado' } }

    const affiliateId = affiliateData.id
    const [clicksRes, ordersRes, payoutsRes] = await Promise.all([
      withDbTimeout(
        supabase
          .from('affiliate_clicks')
          .select('id, source, created_at')
          .eq('affiliate_id', affiliateId)
          .order('created_at', { ascending: false })
          .limit(200)
      ),
      withDbTimeout(
        supabase
          .from('affiliate_orders')
          .select('id, order_id, service_fee_amount, commission_rate, commission_amount, status, finalized_at, created_at')
          .eq('affiliate_id', affiliateId)
          .order('created_at', { ascending: false })
          .limit(200)
      ),
      withDbTimeout(
        supabase
          .from('affiliate_payouts')
          .select('id, amount, status, mode, paid_at, created_at')
          .eq('affiliate_id', affiliateId)
          .order('created_at', { ascending: false })
          .limit(200)
      ),
    ])

    const orders = ordersRes.data ?? []
    const clicks = clicksRes.data ?? []
    const payouts = payoutsRes.data ?? []
    const earnings = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (Number(o.commission_amount) || 0), 0)

    return {
      data: {
        affiliate: affiliateData,
        clicks,
        orders,
        payouts,
        metrics: {
          clicks: clicks.length,
          conversions: orders.length,
          earnings,
          pending: orders.filter((o) => o.status === 'pending').length,
        },
      },
      error: clicksRes.error || ordersRes.error || payoutsRes.error || null,
    }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function getAffiliateAdminOverview() {
  try {
    const [affiliatesRes, ordersRes, payoutsRes] = await Promise.all([
      withDbTimeout(
        supabase
          .from('affiliates')
          .select('id, user_id, code, commission_rate, status, created_at')
          .order('created_at', { ascending: false })
          .limit(300)
      ),
      withDbTimeout(
        supabase
          .from('affiliate_orders')
          .select('id, affiliate_id, order_id, commission_amount, status, created_at, finalized_at')
          .order('created_at', { ascending: false })
          .limit(500)
      ),
      withDbTimeout(
        supabase
          .from('affiliate_payouts')
          .select('id, affiliate_id, amount, status, mode, paid_at, created_at')
          .order('created_at', { ascending: false })
          .limit(300)
      ),
    ])
    return {
      data: {
        affiliates: affiliatesRes.data ?? [],
        affiliateOrders: ordersRes.data ?? [],
        payouts: payoutsRes.data ?? [],
      },
      error: affiliatesRes.error || ordersRes.error || payoutsRes.error || null,
    }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function createAffiliatePayoutCandidates() {
  try {
    const { data, error } = await withDbTimeout(callAdminRpc('create_affiliate_payout_candidates'))
    return { data: Number(data) || 0, error }
  } catch (e) {
    return { data: 0, error: toServiceError(e) }
  }
}

export async function processAffiliateAutoPayouts() {
  try {
    const { data, error } = await withDbTimeout(callAdminRpc('admin_process_affiliate_auto_payouts'))
    return { data: Number(data) || 0, error }
  } catch (e) {
    return { data: 0, error: toServiceError(e) }
  }
}

export async function updateAffiliatePayoutStatus(payoutId, status) {
  try {
    const next = String(status || '').toLowerCase()
    if (!['pending', 'approved', 'paid', 'rejected'].includes(next)) {
      return { error: { message: 'Status inválido' } }
    }
    const patch = { status: next, updated_at: new Date().toISOString() }
    if (next === 'paid') patch.paid_at = new Date().toISOString()
    const { error } = await withDbTimeout(
      supabase.from('affiliate_payouts').update(patch).eq('id', payoutId)
    )
    if (error) return { error }

    if (next === 'paid') {
      await withDbTimeout(
        supabase.from('affiliate_orders').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('payout_id', payoutId)
      )
    }
    if (next === 'rejected') {
      await withDbTimeout(
        supabase
          .from('affiliate_orders')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('payout_id', payoutId)
      )
    }
    return { error: null }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}


import {
  evaluateRisk,
  generateFingerprint,
  getAuthenticatedUser,
  getClientIp,
  getProxyHeuristic,
  getSupabaseAdmin,
  hashText,
  insertFraudLog,
  loadFraudConfig,
  updateUserSecurity,
} from '../server-lib/antiFraud.js'

function pickOrderAmount(order) {
  const amount = Number(order?.total_amount ?? order?.quote_amount ?? order?.shipping_cost ?? 0)
  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}

async function handleTrackClick(req, res, supabase) {
  const code = String(req.body?.code || '').trim().toLowerCase()
  if (!code) return res.status(400).json({ error: 'Affiliate code is required' })

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id, user_id, code, status')
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle()
  if (!affiliate?.id) return res.status(404).json({ error: 'Affiliate not found' })

  const ip = getClientIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  const fingerprint = generateFingerprint(req, { timezone: req.body?.timezone })
  const cfg = await loadFraudConfig(supabase)

  const risk = await evaluateRisk({
    supabaseAdmin: supabase,
    config: cfg,
    ip,
    fingerprint,
    pagesVisited: req.body?.pagesVisited,
    geoCountry: req.body?.geoCountry,
    ipCountry: req.body?.ipCountry,
    proxySuspected: getProxyHeuristic(req),
  })

  const { data: click, error } = await supabase
    .from('affiliate_clicks')
    .insert({
      affiliate_id: affiliate.id,
      session_key: req.body?.sessionKey || null,
      source: req.body?.source || null,
      utm: req.body?.utm || {},
      ip_hash: hashText(ip),
      user_agent_hash: hashText(userAgent),
      ip,
      device_fingerprint: fingerprint,
      risk_score: risk.score,
      flags: risk.flags,
    })
    .select('id, affiliate_id, created_at, risk_score')
    .single()

  if (error) return res.status(400).json({ error: error.message || 'Failed to track click' })

  await insertFraudLog(supabase, {
    userId: affiliate.user_id || null,
    actionType: 'affiliate_track_click',
    riskScore: risk.score,
    flags: { ...risk.flags, affiliate_id: affiliate.id, click_id: click.id },
  })

  return res.status(200).json({
    ok: true,
    click,
    decision: risk.decision,
  })
}

async function handleTrackOrder(req, res, supabase) {
  const { user, error: authError } = await getAuthenticatedUser(req, supabase)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const orderId = String(req.body?.orderId || '').trim()
  const affiliateCode = String(req.body?.code || '').trim().toLowerCase()
  if (!orderId || !affiliateCode) {
    return res.status(400).json({ error: 'orderId and code are required' })
  }

  const [{ data: affiliate }, { data: order }] = await Promise.all([
    supabase
      .from('affiliates')
      .select('id, user_id, code, commission_rate, status')
      .eq('code', affiliateCode)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('orders')
      .select('id, user_id, status, total_amount, quote_amount, shipping_cost, affiliate_id, acquisition_mode')
      .eq('id', orderId)
      .maybeSingle(),
  ])

  if (!affiliate?.id) return res.status(404).json({ error: 'Affiliate not found' })
  if (!order?.id) return res.status(404).json({ error: 'Order not found' })
  if (order.user_id !== user.id) return res.status(403).json({ error: 'Order does not belong to user' })

  const cfg = await loadFraudConfig(supabase)
  const ip = getClientIp(req)
  const fingerprint = generateFingerprint(req, { timezone: req.body?.timezone })
  await updateUserSecurity(supabase, user.id, ip, fingerprint)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (affiliate.user_id && affiliate.user_id === user.id) {
    const flags = { self_purchase_blocked: true, affiliate_id: affiliate.id, order_id: order.id }
    await supabase
      .from('affiliate_orders')
      .upsert({
        affiliate_id: affiliate.id,
        order_id: order.id,
        commission_amount: 0,
        commission_rate: 0,
        service_fee_amount: 0,
        status: 'rejected',
        risk_score: 100,
        flags,
        reviewed_at: new Date().toISOString(),
      }, { onConflict: 'order_id' })
    await insertFraudLog(supabase, {
      userId: user.id,
      actionType: 'affiliate_self_purchase',
      riskScore: 100,
      flags,
    })
    return res.status(200).json({ ok: true, status: 'rejected', reason: 'Affiliate self-purchase blocked' })
  }

  const orderAmount = pickOrderAmount(order)
  const risk = await evaluateRisk({
    supabaseAdmin: supabase,
    config: cfg,
    userId: user.id,
    ip,
    fingerprint,
    signupAt: profile?.created_at || user.created_at,
    pagesVisited: req.body?.pagesVisited,
    orderValue: orderAmount,
    geoCountry: req.body?.geoCountry,
    ipCountry: req.body?.ipCountry,
    proxySuspected: getProxyHeuristic(req),
  })

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { count: conversionsToday = 0 } = await supabase
    .from('affiliate_orders')
    .select('id', { count: 'exact', head: true })
    .eq('affiliate_id', affiliate.id)
    .gte('created_at', todayStart.toISOString())

  const { data: pendingOrders = [] } = await supabase
    .from('affiliate_orders')
    .select('commission_amount')
    .eq('affiliate_id', affiliate.id)
    .in('status', ['pending', 'approved'])
  const currentPendingCommission = pendingOrders.reduce((sum, row) => sum + (Number(row.commission_amount) || 0), 0)

  const serviceFeePercent = Number(cfg.service_fee_percent || 8)
  const rate = Number(affiliate.commission_rate ?? cfg.default_commission_rate ?? 10)
  const serviceFeeAmount = Math.max(0, orderAmount * (serviceFeePercent / 100))
  const commissionAmount = Math.max(0, serviceFeeAmount * (rate / 100))

  const exceededDailyConversions = conversionsToday >= Number(cfg.fraud_affiliate_max_conversions_per_day)
  const exceededCommissionCap = currentPendingCommission + commissionAmount > Number(cfg.fraud_affiliate_max_commission_before_review)
  const finalDecision = (risk.decision === 'reject')
    ? 'reject'
    : (risk.decision === 'review' || exceededDailyConversions || exceededCommissionCap)
      ? 'review'
      : 'approve'

  let status = 'pending'
  if (finalDecision === 'reject') status = 'rejected'
  if (finalDecision === 'review') status = 'flagged'

  const holdDays = Math.max(0, Number(cfg.fraud_reward_hold_days) || 7)
  const delivered = ['completed', 'delivered', 'shipped'].includes(String(order.status || '').toLowerCase())
  const rewardReleaseAt = delivered
    ? new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  await supabase
    .from('orders')
    .update({
      acquisition_mode: 'affiliate',
      affiliate_id: affiliate.id,
    })
    .eq('id', order.id)
    .eq('user_id', user.id)

  const flags = {
    ...risk.flags,
    exceeded_daily_conversions: exceededDailyConversions,
    exceeded_commission_cap: exceededCommissionCap,
    conversions_today: conversionsToday,
    projected_pending_commission: currentPendingCommission + commissionAmount,
  }

  const { data: tracked, error: upsertError } = await supabase
    .from('affiliate_orders')
    .upsert({
      affiliate_id: affiliate.id,
      order_id: order.id,
      service_fee_amount: Number(serviceFeeAmount.toFixed(2)),
      commission_rate: Number(rate.toFixed(4)),
      commission_amount: Number(commissionAmount.toFixed(2)),
      status,
      risk_score: risk.score,
      flags,
      reward_release_at: rewardReleaseAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'order_id' })
    .select('id, status, risk_score, commission_amount, reward_release_at')
    .single()

  if (upsertError) {
    return res.status(400).json({ error: upsertError.message || 'Failed to track affiliate order' })
  }

  await insertFraudLog(supabase, {
    userId: user.id,
    actionType: 'affiliate_track_order',
    riskScore: risk.score,
    flags: { ...flags, affiliate_id: affiliate.id, order_id: order.id, status },
  })

  return res.status(200).json({
    ok: true,
    order: tracked,
    decision: finalDecision,
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })

  try {
    const action = String(req.body?.action || '').trim().toLowerCase()
    if (action === 'track_click') return await handleTrackClick(req, res, supabase)
    if (action === 'track_order') return await handleTrackOrder(req, res, supabase)
    return res.status(400).json({ error: 'Unsupported action' })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal server error' })
  }
}

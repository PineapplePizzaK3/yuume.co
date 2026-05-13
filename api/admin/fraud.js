import {
  getAuthenticatedUser,
  getSupabaseAdmin,
  insertFraudLog,
  isAdminUser,
  loadFraudConfig,
} from '../../server-lib/antiFraud.js'

async function ensureAdmin(req, res, supabase) {
  const { user, error: authError } = await getAuthenticatedUser(req, supabase)
  if (authError || !user) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  if (!(await isAdminUser(supabase, user.id))) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return user
}

async function handleReview(req, res, supabase) {
  const limit = Math.max(1, Math.min(300, Number(req.query.limit) || 100))
  const [affiliateOrdersRes, logsRes] = await Promise.all([
    supabase
      .from('affiliate_orders')
      .select('id, affiliate_id, order_id, status, risk_score, flags, commission_amount, reward_release_at, created_at')
      .in('status', ['pending', 'flagged', 'rejected'])
      .order('risk_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('fraud_logs')
      .select('id, user_id, action_type, risk_score, flags, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  return res.status(200).json({
    ok: true,
    referrals: [],
    affiliate_orders: affiliateOrdersRes.data || [],
    fraud_logs: logsRes.data || [],
  })
}

async function handleDecision(req, res, supabase, user) {
  const entityType = String(req.body?.entityType || '').trim()
  const entityId = String(req.body?.id || '').trim()
  const decision = String(req.body?.decision || '').trim().toLowerCase()
  const note = String(req.body?.note || '').trim()

  if (!entityType || !entityId || !decision) {
    return res.status(400).json({ error: 'entityType, id and decision are required' })
  }
  if (!['approve', 'reject', 'flag', 'pending'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision' })
  }

  const nowIso = new Date().toISOString()
  const cfg = await loadFraudConfig(supabase)
  const holdDays = Math.max(0, Number(cfg.fraud_reward_hold_days) || 7)
  const releaseAtIso = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString()

  if (entityType === 'referral') {
    return res.status(503).json({ error: 'Referral system is temporarily disabled' })
  }

  if (entityType === 'affiliate_order') {
    const status = decision === 'approve'
      ? 'approved'
      : decision === 'reject'
        ? 'rejected'
        : decision === 'flag'
          ? 'flagged'
          : 'pending'

    const { data: updated, error } = await supabase
      .from('affiliate_orders')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: nowIso,
        reward_release_at: decision === 'approve' ? releaseAtIso : null,
        flags: note ? { admin_note: note } : undefined,
        updated_at: nowIso,
      })
      .eq('id', entityId)
      .select('id, status, risk_score, reviewed_by, reviewed_at')
      .single()

    if (error) return res.status(400).json({ error: error.message || 'Failed to update affiliate order' })
    await insertFraudLog(supabase, {
      userId: null,
      actionType: 'admin_fraud_decision_affiliate_order',
      riskScore: Number(updated?.risk_score || 0),
      flags: { entity_id: entityId, decision, note },
    })
    return res.status(200).json({ ok: true, entity: updated })
  }

  return res.status(400).json({ error: 'Unsupported entityType' })
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })

  try {
    const user = await ensureAdmin(req, res, supabase)
    if (!user) return

    if (req.method === 'GET') {
      return await handleReview(req, res, supabase)
    }

    const action = String(req.body?.action || '').trim().toLowerCase()
    if (action && action !== 'decision') {
      return res.status(400).json({ error: 'Unsupported action' })
    }
    return await handleDecision(req, res, supabase, user)
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal server error' })
  }
}

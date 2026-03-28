import {
  getAuthenticatedUser,
  getSupabaseAdmin,
  insertFraudLog,
  isAdminUser,
  loadFraudConfig,
} from '../../_antiFraud.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })

  const { user, error: authError } = await getAuthenticatedUser(req, supabase)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })
  if (!(await isAdminUser(supabase, user.id))) return res.status(403).json({ error: 'Forbidden' })

  try {
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
      const status = decision === 'approve'
        ? 'approved'
        : decision === 'reject'
          ? 'rejected'
          : decision === 'flag'
            ? 'flagged'
            : 'pending'

      const { data: updated, error } = await supabase
        .from('referrals')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: nowIso,
          reward_release_at: decision === 'approve' ? releaseAtIso : null,
          fraud_flags: note ? { admin_note: note } : undefined,
          updated_at: nowIso,
        })
        .eq('id', entityId)
        .select('id, status, risk_score, reviewed_by, reviewed_at, referred_id')
        .single()

      if (error) return res.status(400).json({ error: error.message || 'Failed to update referral' })
      await insertFraudLog(supabase, {
        userId: updated?.referred_id || null,
        actionType: 'admin_fraud_decision_referral',
        riskScore: Number(updated?.risk_score || 0),
        flags: { entity_id: entityId, decision, note },
      })
      return res.status(200).json({ ok: true, entity: updated })
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
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal server error' })
  }
}

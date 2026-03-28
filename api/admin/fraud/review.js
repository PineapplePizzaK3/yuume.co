import {
  getAuthenticatedUser,
  getSupabaseAdmin,
  isAdminUser,
} from '../../_antiFraud.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })

  const { user, error: authError } = await getAuthenticatedUser(req, supabase)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })
  if (!(await isAdminUser(supabase, user.id))) return res.status(403).json({ error: 'Forbidden' })

  try {
    const limit = Math.max(1, Math.min(300, Number(req.query.limit) || 100))
    const [referralsRes, affiliateOrdersRes, logsRes] = await Promise.all([
      supabase
        .from('referrals')
        .select('id, referrer_id, referred_id, status, risk_score, fraud_flags, reward_given, reward_release_at, created_at')
        .in('status', ['pending', 'flagged', 'rejected'])
        .order('risk_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit),
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
      referrals: referralsRes.data || [],
      affiliate_orders: affiliateOrdersRes.data || [],
      fraud_logs: logsRes.data || [],
    })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal server error' })
  }
}

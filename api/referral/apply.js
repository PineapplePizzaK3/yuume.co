import {
  evaluateRisk,
  generateFingerprint,
  getAuthenticatedUser,
  getClientIp,
  getProxyHeuristic,
  getSupabaseAdmin,
  insertFraudLog,
  loadFraudConfig,
  updateUserSecurity,
} from '../_antiFraud.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })

  const { user, error: authError } = await getAuthenticatedUser(req, supabase)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const codeRaw = String(req.body?.code || '').trim()
    if (!codeRaw) return res.status(400).json({ error: 'Referral code is required' })
    const code = codeRaw.toUpperCase()

    const ip = getClientIp(req)
    const fingerprint = generateFingerprint(req, { timezone: req.body?.timezone })
    const cfg = await loadFraudConfig(supabase)

    await updateUserSecurity(supabase, user.id, ip, fingerprint)

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id, phone, created_at')
      .eq('id', user.id)
      .maybeSingle()

    const { data: refCodeRow } = await supabase
      .from('user_referral_codes')
      .select('user_id, code')
      .eq('code', code)
      .maybeSingle()
    if (!refCodeRow?.user_id) return res.status(400).json({ error: 'Invalid referral code' })

    const referrerId = refCodeRow.user_id
    if (referrerId === user.id) return res.status(400).json({ error: 'Self-referral is not allowed' })

    const [{ data: referrerProfile }, { data: existingReferral }] = await Promise.all([
      supabase.from('profiles').select('id, phone').eq('id', referrerId).maybeSingle(),
      supabase.from('referrals').select('id').eq('referred_id', user.id).maybeSingle(),
    ])
    if (existingReferral?.id) return res.status(400).json({ error: 'User already has a referral' })

    const [referrerAuth, referredAuth] = await Promise.all([
      supabase.auth.admin.getUserById(referrerId),
      supabase.auth.admin.getUserById(user.id),
    ])
    const referrerEmail = String(referrerAuth?.data?.user?.email || '').toLowerCase()
    const referredEmail = String(referredAuth?.data?.user?.email || '').toLowerCase()
    const referrerPhone = String(referrerProfile?.phone || '').trim()
    const referredPhone = String(myProfile?.phone || '').trim()

    if (referrerEmail && referredEmail && referrerEmail === referredEmail) {
      return res.status(400).json({ error: 'Same email is not allowed for referral' })
    }
    if (referrerPhone && referredPhone && referrerPhone === referredPhone) {
      return res.status(400).json({ error: 'Same phone is not allowed for referral' })
    }

    const risk = await evaluateRisk({
      supabaseAdmin: supabase,
      config: cfg,
      userId: user.id,
      ip,
      fingerprint,
      signupAt: myProfile?.created_at || user.created_at,
      pagesVisited: req.body?.pagesVisited,
      geoCountry: req.body?.geoCountry,
      ipCountry: req.body?.ipCountry,
      proxySuspected: getProxyHeuristic(req),
    })

    const referralStatus = risk.decision === 'reject'
      ? 'rejected'
      : risk.decision === 'review'
        ? 'flagged'
        : 'pending'

    const { data: inserted, error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        referred_id: user.id,
        code_used: code,
        status: referralStatus,
        reward_given: false,
        risk_score: risk.score,
        fraud_flags: risk.flags,
      })
      .select('id, status, risk_score')
      .single()

    if (insertError) {
      return res.status(400).json({ error: insertError.message || 'Failed to apply referral' })
    }

    await insertFraudLog(supabase, {
      userId: user.id,
      actionType: 'referral_apply',
      riskScore: risk.score,
      flags: { ...risk.flags, referral_status: referralStatus },
    })

    return res.status(200).json({
      ok: true,
      referral: inserted,
      decision: risk.decision,
      message: referralStatus === 'pending'
        ? 'Referral applied and pending qualification.'
        : referralStatus === 'flagged'
          ? 'Referral flagged for manual review.'
          : 'Referral rejected by anti-fraud validation.',
    })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Internal server error' })
  }
}

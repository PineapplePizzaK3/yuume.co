import {
  evaluateRisk,
  generateFingerprint,
  getClientIp,
  getProxyHeuristic,
  getSupabaseAdmin,
  hashText,
  insertFraudLog,
  loadFraudConfig,
} from '../_antiFraud.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })

  try {
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
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal server error' })
  }
}

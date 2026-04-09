import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_CONFIG = {
  fraud_same_ip_score: 30,
  fraud_same_fingerprint_score: 40,
  fraud_fast_purchase_score: 20,
  fraud_no_browsing_score: 10,
  fraud_geo_mismatch_score: 15,
  fraud_proxy_score: 20,
  fraud_threshold_approve_max: 30,
  fraud_threshold_review_max: 60,
  fraud_max_accounts_per_ip_window: 3,
  fraud_ip_window_minutes: 30,
  fraud_referral_max_per_month: 30,
  fraud_referral_max_reward_amount: 1000,
  fraud_affiliate_max_conversions_per_day: 50,
  fraud_affiliate_max_commission_before_review: 3000,
  fraud_reward_hold_days: 7,
  fraud_min_order_threshold: 5,
  fraud_min_order_repeats: 3,
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function getAuthenticatedUser(req, supabaseAdmin) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return { user: null, error: 'missing_auth' }
  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return { user: null, error: 'invalid_auth' }
  return { user: data.user, error: null }
}

export async function isAdminUser(supabaseAdmin, userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return data?.role === 'admin'
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

function inferDeviceType(userAgent = '') {
  const ua = String(userAgent || '').toLowerCase()
  if (/ipad|tablet/.test(ua)) return 'tablet'
  if (/mobi|iphone|android/.test(ua)) return 'mobile'
  return 'desktop'
}

function inferOs(userAgent = '') {
  const ua = String(userAgent || '').toLowerCase()
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos'
  if (ua.includes('android')) return 'android'
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

export function generateFingerprint(req, extra = {}) {
  const ip = getClientIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  const deviceType = String(extra.deviceType || inferDeviceType(userAgent))
  const os = String(extra.os || inferOs(userAgent))
  const timezone = String(extra.timezone || req.headers['x-timezone'] || 'unknown')
  const base = [ip, userAgent, deviceType, os, timezone].join('|').toLowerCase()
  return crypto.createHash('sha256').update(base).digest('hex')
}

export function hashText(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export async function loadFraudConfig(supabaseAdmin) {
  const keys = Object.keys(DEFAULT_CONFIG)
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('key, value')
    .in('key', keys)

  const out = { ...DEFAULT_CONFIG }
  for (const row of data || []) {
    const key = row?.key
    if (!key || !(key in out)) continue
    const amount = Number(row?.value?.amount ?? row?.value?.percent ?? row?.value?.value)
    if (Number.isFinite(amount)) out[key] = amount
  }
  return out
}

function getDecision(score, cfg) {
  if (score < Number(cfg.fraud_threshold_approve_max)) return 'approve'
  if (score <= Number(cfg.fraud_threshold_review_max)) return 'review'
  return 'reject'
}

export async function evaluateRisk({
  supabaseAdmin,
  config,
  userId = null,
  ip,
  fingerprint,
  signupAt = null,
  pagesVisited = null,
  orderValue = null,
  geoCountry = null,
  ipCountry = null,
  proxySuspected = false,
}) {
  let score = 0
  const flags = {}
  const now = Date.now()
  const windowMinutes = Math.max(1, Number(config.fraud_ip_window_minutes) || 30)
  const sinceIso = new Date(now - windowMinutes * 60 * 1000).toISOString()

  if (ip && ip !== 'unknown') {
    const { count: accountsPerIp = 0 } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('last_login_ip', ip)
      .gte('created_at', sinceIso)
    flags.accounts_per_ip_window = accountsPerIp
    if (accountsPerIp > Number(config.fraud_max_accounts_per_ip_window)) {
      score += Number(config.fraud_same_ip_score)
      flags.same_ip = true
    }
  }

  if (fingerprint) {
    let q = supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('device_fingerprint', fingerprint)
    if (userId) q = q.neq('id', userId)
    const { count: fingerprintUsers = 0 } = await q
    flags.accounts_per_fingerprint = fingerprintUsers
    if (fingerprintUsers > 0) {
      score += Number(config.fraud_same_fingerprint_score)
      flags.same_fingerprint = true
    }
  }

  if (signupAt) {
    const deltaMs = now - new Date(signupAt).getTime()
    flags.time_between_signup_and_purchase_ms = deltaMs
    if (Number.isFinite(deltaMs) && deltaMs >= 0 && deltaMs < 2 * 60 * 1000) {
      score += Number(config.fraud_fast_purchase_score)
      flags.fast_purchase = true
    }
  }

  if (pagesVisited != null) {
    const pages = Number(pagesVisited) || 0
    flags.pages_visited = pages
    if (pages <= 0) {
      score += Number(config.fraud_no_browsing_score)
      flags.no_browsing = true
    }
  }

  if (geoCountry && ipCountry && String(geoCountry).toLowerCase() !== String(ipCountry).toLowerCase()) {
    score += Number(config.fraud_geo_mismatch_score)
    flags.geo_mismatch = true
  }

  if (proxySuspected) {
    score += Number(config.fraud_proxy_score)
    flags.proxy_suspected = true
  }

  if (userId) {
    const minThreshold = Math.max(0, Number(config.fraud_min_order_threshold) || 5)
    const minRepeats = Math.max(1, Number(config.fraud_min_order_repeats) || 3)
    const { data: orders = [] } = await supabaseAdmin
      .from('orders')
      .select('total_amount, quote_amount, shipping_cost, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    const lowPatternCount = orders.filter((o) => {
      const amount = Number(o.total_amount ?? o.quote_amount ?? o.shipping_cost ?? 0)
      return amount > 0 && amount <= minThreshold
    }).length
    flags.low_value_repeat_count = lowPatternCount
    if (lowPatternCount >= minRepeats) {
      score += Number(config.fraud_no_browsing_score)
      flags.minimum_order_pattern = true
    }
  }

  if (orderValue != null) flags.order_value = Number(orderValue) || 0
  return { score, flags, decision: getDecision(score, config) }
}

export async function updateUserSecurity(supabaseAdmin, userId, ip, fingerprint) {
  if (!userId) return
  await supabaseAdmin
    .from('profiles')
    .update({
      last_login_ip: ip || null,
      device_fingerprint: fingerprint || null,
    })
    .eq('id', userId)
}

export async function insertFraudLog(supabaseAdmin, payload) {
  await supabaseAdmin.from('fraud_logs').insert({
    user_id: payload.userId || null,
    action_type: String(payload.actionType || 'unknown'),
    risk_score: Number(payload.riskScore || 0),
    flags: payload.flags || {},
  })
}

export function getProxyHeuristic(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
  const via = String(req.headers['via'] || '')
  const hops = forwarded ? forwarded.split(',').map((x) => x.trim()).filter(Boolean).length : 0
  return hops > 2 || /proxy|vpn|tor/i.test(via)
}

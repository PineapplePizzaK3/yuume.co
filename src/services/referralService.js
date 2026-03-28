import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

export async function getOrCreateMyReferralCode(userId) {
  try {
    // Caminho principal: RPC.
    const rpcRes = await withDbTimeout(
      supabase.rpc('get_or_create_referral_code', { p_user_id: userId || null })
    )
    const rpcCode =
      typeof rpcRes?.data === 'string' && rpcRes.data.trim()
        ? rpcRes.data.trim().toUpperCase()
        : null
    if (rpcCode) return { data: rpcCode, error: null }

    // Fallback 1: leitura direta do código já existente.
    const directRes = await withDbTimeout(
      supabase
        .from('user_referral_codes')
        .select('code')
        .eq('user_id', userId)
        .maybeSingle()
    )
    const directCode =
      typeof directRes?.data?.code === 'string' && directRes.data.code.trim()
        ? directRes.data.code.trim().toUpperCase()
        : null
    if (directCode) return { data: directCode, error: null }

    // Fallback 2: RPC sem userId explícito (usa auth.uid no banco).
    const rpcAuthRes = await withDbTimeout(
      supabase.rpc('get_or_create_referral_code', { p_user_id: null })
    )
    const rpcAuthCode =
      typeof rpcAuthRes?.data === 'string' && rpcAuthRes.data.trim()
        ? rpcAuthRes.data.trim().toUpperCase()
        : null
    if (rpcAuthCode) return { data: rpcAuthCode, error: null }

    // Se chegou aqui, reporta erro explícito para não mascarar no UI.
    return {
      data: null,
      error:
        rpcRes?.error ||
        directRes?.error ||
        rpcAuthRes?.error ||
        { message: 'Não foi possível carregar/gerar o código de indicação.' },
    }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function bindReferralOnSignup(referredUserId, code) {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    if (accessToken) {
      const res = await fetch('/api/referral/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          code,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return { data: null, error: { message: json?.error || 'Erro ao aplicar referral' } }
      return { data: json ?? null, error: null }
    }

    // Fallback legado para fluxos sem sessão ativa.
    const { data, error } = await withDbTimeout(
      supabase.rpc('bind_referral_on_signup', {
        p_referred_user_id: referredUserId,
        p_code: code,
      })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function getMyReferralOverview(userId) {
  try {
    const [rpcRes, refsRes, creditRes] = await Promise.all([
      getOrCreateMyReferralCode(userId),
      withDbTimeout(
        supabase
          .from('referrals')
          .select('id, referred_id, status, reward_given, created_at, qualified_at')
          .eq('referrer_id', userId)
          .order('created_at', { ascending: false })
      ),
      withDbTimeout(
        supabase
          .from('user_credits')
          .select('balance, updated_at')
          .eq('user_id', userId)
          .maybeSingle()
      ),
    ])

    const code = typeof rpcRes.data === 'string' && rpcRes.data.trim() ? rpcRes.data.trim() : null
    const referrals = refsRes.data ?? []
    const credits = creditRes.data?.balance ?? 0
    return {
      data: {
        code,
        referrals,
        credits,
        stats: {
          total: referrals.length,
          /** Indicações em que o crédito ao indicador ainda não foi pago (ex.: aguardando envio do indicado). */
          awaitingReferrerCredit: referrals.filter(
            (r) => !r.reward_given && r.status !== 'cancelled'
          ).length,
          rewarded: referrals.filter((r) => r.reward_given).length,
        },
      },
      error: rpcRes.error || refsRes.error || creditRes.error || null,
    }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}


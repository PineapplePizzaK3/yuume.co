/**
 * Markup sobre JPY→USD para cobrir custo efetivo de retirada/conversão (ex.: Wise USD→JPY).
 * Padrão ~0,73% como referência de ordem de grandeza (ajuste via env ou system_settings).
 */
export const DEFAULT_WISE_USD_JPY_WITHDRAWAL_MARKUP_PERCENT = 0.73

function numOrDefault(n, fallback) {
  const x = Number(n)
  return Number.isFinite(x) && x >= 0 ? x : fallback
}

/** Vercel/env: força o % sem consultar o banco. */
export function resolveWiseWithdrawalMarkupPercentSync() {
  const raw = process.env.WISE_USD_TO_JPY_WITHDRAWAL_MARKUP_PERCENT
  if (raw !== undefined && String(raw).trim() !== '') {
    return numOrDefault(raw, DEFAULT_WISE_USD_JPY_WITHDRAWAL_MARKUP_PERCENT)
  }
  return DEFAULT_WISE_USD_JPY_WITHDRAWAL_MARKUP_PERCENT
}

/**
 * Env tem prioridade; senão system_settings.wise_usd_jpy_withdrawal_markup_percent (amount);
 * senão default.
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 */
export async function resolveWiseWithdrawalMarkupPercent(supabase) {
  const raw = process.env.WISE_USD_TO_JPY_WITHDRAWAL_MARKUP_PERCENT
  if (raw !== undefined && String(raw).trim() !== '') {
    return numOrDefault(raw, DEFAULT_WISE_USD_JPY_WITHDRAWAL_MARKUP_PERCENT)
  }
  if (supabase) {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'wise_usd_jpy_withdrawal_markup_percent')
        .maybeSingle()
      const a = numOrDefault(data?.value?.amount, NaN)
      if (Number.isFinite(a)) return a
    } catch {
      // ignore
    }
  }
  return DEFAULT_WISE_USD_JPY_WITHDRAWAL_MARKUP_PERCENT
}

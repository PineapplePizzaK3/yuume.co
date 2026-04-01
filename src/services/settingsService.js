import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

const SETTINGS_KEYS = [
  'referral_discount_value',
  'referral_credit_value',
  'default_commission_rate',
  'minimum_payout',
  'affiliate_enabled',
  'service_fee_percent',
  'affiliate_payout_mode',
  'fx_brl_per_jpy',
  'fx_jpy_usd',
  'fx_usd_brl',
  'pricing_margin_percent',
  'pricing_platform_fee_percent',
  'pricing_jpy_usd_buffer_percent',
  'grupo_compras_fee_per_unit_usd',
]

export async function getSystemSettings() {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('system_settings')
        .select('key, value, updated_at')
        .in('key', SETTINGS_KEYS)
    )
    if (error) return { data: null, error }
    const map = {}
    for (const row of data ?? []) map[row.key] = row.value
    return { data: map, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function saveSystemSettingsAdmin(payload) {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('admin_save_system_settings', { p_payload: payload || {} })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}


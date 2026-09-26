import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'

export const STORE_VITRINE_ENABLED_KEY = 'store_vitrine_enabled'
export const STORE_VITRINE_CHANGED_EVENT = 'yuume:store-vitrine-enabled'

const SETTINGS_KEYS = [
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
  'wise_usd_jpy_withdrawal_markup_percent',
  'on_demand_price_multiplier',
  STORE_VITRINE_ENABLED_KEY,
]

export function parseSettingEnabled(value, fallback = false) {
  if (value == null) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'object') {
    if (typeof value.enabled === 'boolean') return value.enabled
    if (typeof value.value === 'boolean') return value.value
  }
  const raw = String(value?.enabled ?? value?.value ?? value ?? '').trim().toLowerCase()
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return fallback
}

/** Default false: Vitrine tab stays off until an admin re-enables it. */
export async function getStoreVitrineEnabled() {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('system_settings')
        .select('value')
        .eq('key', STORE_VITRINE_ENABLED_KEY)
        .maybeSingle()
    )
    if (error) return false
    return parseSettingEnabled(data?.value, false)
  } catch {
    return false
  }
}

export async function setStoreVitrineEnabledAdmin(enabled) {
  const next = Boolean(enabled)
  const { error } = await saveSystemSettingsAdmin({
    [STORE_VITRINE_ENABLED_KEY]: { enabled: next },
  })
  if (!error && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORE_VITRINE_CHANGED_EVENT, { detail: { enabled: next } }))
  }
  return { error }
}

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
      callAdminRpc('admin_save_system_settings', { p_payload: payload || {} })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}


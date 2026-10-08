import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { parseSettingEnabled } from './settingsService'

export const COLLECTOR_HOME_V2_KEY = 'collector_home_v2_enabled'
export const COLLECTOR_MARKET_KEY = 'collector_market_enabled'
export const COLLECTOR_RECS_KEY = 'collector_recommendations_enabled'
export const MODULE_OPENINGS_KEY = 'module_openings_enabled'
export const MODULE_LIVE_RIPS_KEY = 'module_live_rips_enabled'

export const COLLECTOR_FLAGS_CHANGED_EVENT = 'yuume:collector-flags'

const FLAG_KEYS = [
  COLLECTOR_HOME_V2_KEY,
  COLLECTOR_MARKET_KEY,
  COLLECTOR_RECS_KEY,
  MODULE_OPENINGS_KEY,
  MODULE_LIVE_RIPS_KEY,
]

const DEFAULTS = {
  [COLLECTOR_HOME_V2_KEY]: false,
  [COLLECTOR_MARKET_KEY]: false,
  [COLLECTOR_RECS_KEY]: false,
  [MODULE_OPENINGS_KEY]: true,
  [MODULE_LIVE_RIPS_KEY]: true,
}

async function readFlag(key, fallback) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.from('system_settings').select('value').eq('key', key).maybeSingle()
    )
    if (error) return fallback
    return parseSettingEnabled(data?.value, fallback)
  } catch {
    return fallback
  }
}

export async function getCollectorFeatureFlags() {
  try {
    const { data, error } = await withDbTimeout(
      supabase.from('system_settings').select('key, value').in('key', FLAG_KEYS)
    )
    if (error) {
      return { data: { ...DEFAULTS }, error: toServiceError(error) }
    }
    const map = { ...DEFAULTS }
    for (const row of data || []) {
      map[row.key] = parseSettingEnabled(row.value, DEFAULTS[row.key])
    }
    return { data: map, error: null }
  } catch (e) {
    return { data: { ...DEFAULTS }, error: toServiceError(e) }
  }
}

export async function getCollectorHomeV2Enabled() {
  return readFlag(COLLECTOR_HOME_V2_KEY, false)
}

export async function getCollectorMarketEnabled() {
  return readFlag(COLLECTOR_MARKET_KEY, false)
}

export async function getCollectorRecommendationsEnabled() {
  return readFlag(COLLECTOR_RECS_KEY, false)
}

export async function getModuleOpeningsEnabled() {
  return readFlag(MODULE_OPENINGS_KEY, true)
}

export async function getModuleLiveRipsEnabled() {
  return readFlag(MODULE_LIVE_RIPS_KEY, true)
}

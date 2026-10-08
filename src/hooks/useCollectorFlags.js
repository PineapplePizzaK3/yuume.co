import { useEffect, useState } from 'react'
import {
  COLLECTOR_FLAGS_CHANGED_EVENT,
  getCollectorFeatureFlags,
} from '../services/collectorFlagsService'

const INITIAL = {
  collector_home_v2_enabled: false,
  collector_market_enabled: false,
  collector_recommendations_enabled: false,
  module_openings_enabled: true,
  module_live_rips_enabled: true,
}

/**
 * Collector / module feature flags from system_settings.
 * New home / market / recs default off; openings + live-rips default on.
 */
export function useCollectorFlags() {
  const [flags, setFlags] = useState(INITIAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void getCollectorFeatureFlags().then((res) => {
      if (!active) return
      setFlags(res.data || INITIAL)
      setLoading(false)
    })
    const onChange = (event) => {
      if (event?.detail && typeof event.detail === 'object') {
        setFlags((prev) => ({ ...prev, ...event.detail }))
      }
      setLoading(false)
    }
    window.addEventListener(COLLECTOR_FLAGS_CHANGED_EVENT, onChange)
    return () => {
      active = false
      window.removeEventListener(COLLECTOR_FLAGS_CHANGED_EVENT, onChange)
    }
  }, [])

  return {
    loading,
    flags,
    homeV2: Boolean(flags.collector_home_v2_enabled),
    market: Boolean(flags.collector_market_enabled),
    recommendations: Boolean(flags.collector_recommendations_enabled),
    openings: flags.module_openings_enabled !== false,
    liveRips: flags.module_live_rips_enabled !== false,
  }
}

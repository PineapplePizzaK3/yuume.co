/**
 * Database kill switch for CI scraping jobs (market_sources.legacy_automation_allowed, migration 151).
 * Fails open when the registry is not configured or unreachable so existing jobs keep today's behavior;
 * only an explicit "not allowed" from the database stops a job.
 */

const DEFAULT_TIMEOUT_MS = 5000

export async function checkLegacyAutomationAllowed(sourceId, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const key = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '')
  if (!url || !key) return { allowed: true, reason: 'registry_not_configured' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`${url}/rest/v1/rpc/service_market_sources_public`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    })
    if (!response.ok) return { allowed: true, reason: `registry_http_${response.status}` }
    const rows = await response.json()
    const row = Array.isArray(rows) ? rows.find((r) => r?.id === sourceId) : null
    if (!row) return { allowed: true, reason: 'source_not_registered' }
    return row.legacy_automation_allowed === false
      ? { allowed: false, reason: 'disabled_in_registry' }
      : { allowed: true, reason: 'allowed_in_registry' }
  } catch {
    return { allowed: true, reason: 'registry_unreachable' }
  } finally {
    clearTimeout(timer)
  }
}

/** Exits the process with code 0 (job skipped, not failed) when the registry disables the source. */
export async function exitIfAutomationDisabled(sourceId, jobName) {
  const result = await checkLegacyAutomationAllowed(sourceId)
  if (!result.allowed) {
    console.log(`[${jobName}] Skipped: automation for "${sourceId}" is disabled in market_sources.`)
    process.exit(0)
  }
  if (result.reason !== 'allowed_in_registry') {
    console.log(`[${jobName}] market_sources check: ${result.reason} (continuing with legacy behavior).`)
  }
}

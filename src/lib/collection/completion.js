/** Pure completion helpers for tracked sets. Mirror service_collector_set_progress rules. */

export function isCompletionAvailable(setStatus) {
  return String(setStatus || '') === 'VERIFIED'
}

/**
 * @param {{ total: number, owned: number, setStatus: string }} input
 * @returns {{ total: number, owned: number, missing: number|null, percentage: number|null, available: boolean }}
 */
export function computeSetProgress({ total = 0, owned = 0, setStatus }) {
  const safeTotal = Math.max(0, Number(total) || 0)
  const safeOwned = Math.max(0, Math.min(safeTotal, Number(owned) || 0))
  const available = isCompletionAvailable(setStatus)
  if (!available) {
    return { total: safeTotal, owned: safeOwned, missing: null, percentage: null, available: false }
  }
  const missing = Math.max(safeTotal - safeOwned, 0)
  const percentage = safeTotal > 0 ? Math.round((safeOwned / safeTotal) * 1000) / 10 : 0
  return { total: safeTotal, owned: safeOwned, missing, percentage, available: true }
}

/** Status chip for explore / set pages. */
export function setStatusLabelKey(setStatus) {
  switch (String(setStatus || '')) {
    case 'VERIFIED':
      return 'collector.setStatus.VERIFIED'
    case 'VALIDATING':
      return 'collector.setStatus.VALIDATING'
    case 'IMPORTED':
      return 'collector.setStatus.IMPORTED'
    case 'PENDING':
      return 'collector.setStatus.PENDING'
    default:
      return 'collector.setStatus.unknown'
  }
}

export function completionUnavailableMessageKey() {
  return 'collector.progress.checklistPending'
}

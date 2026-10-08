import { useMemo } from 'react'
import { LiveRipStatusTimeline } from '../live-rips/LiveRipStatusTimeline'
import { liveBatchProgressItems } from '../../lib/liveRipBatchStatus'

export function RipProgress({ rip, labels }) {
  const planned = Number(rip?.totalPacks ?? rip?.packsPlanned ?? 0)
  const reserved = Number(rip?.reservedPositions ?? rip?.packsOpened ?? 0)
  const remaining = Math.max(0, Number(rip?.availablePositions ?? planned - reserved))
  const percentage = planned > 0 ? Math.min(100, Math.round((remaining / planned) * 100)) : 0

  const timelineItems = useMemo(
    () => liveBatchProgressItems(rip, labels),
    [labels, rip]
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-earth-200 bg-earth-50 p-4">
        <div className="mb-2 flex items-center justify-between text-sm font-medium text-earth-800">
          <span>{labels?.packs || 'Posicoes disponiveis'}</span>
          <span>
            {remaining}/{planned}
          </span>
        </div>
        <div className="h-2 rounded-full bg-earth-200">
          <div className="h-2 rounded-full bg-collector-600 transition-[width] duration-300" style={{ width: `${percentage}%` }} />
        </div>
      </div>
      <LiveRipStatusTimeline items={timelineItems} />
    </div>
  )
}

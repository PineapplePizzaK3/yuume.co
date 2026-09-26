import { useMemo } from 'react'
import { LiveRipStatusTimeline } from '../live-rips/LiveRipStatusTimeline'

const STATUS_ORDER = ['OPEN', 'SCHEDULED', 'OPENING', 'COMPLETED', 'FULFILLING']

export function RipProgress({ rip, labels }) {
  const opened = Number(rip?.packsOpened ?? rip?.reservedPositions ?? 0)
  const planned = Number(rip?.packsPlanned ?? rip?.totalPacks ?? 0)
  const percentage = planned > 0 ? Math.min(100, Math.round((opened / planned) * 100)) : 0

  const timelineItems = useMemo(() => {
    const index = STATUS_ORDER.indexOf(rip?.status || 'OPEN')
    return STATUS_ORDER.map((status, idx) => ({
      id: status,
      done: idx <= (index < 0 ? 0 : index),
      label: labels?.[status] || status,
    }))
  }, [labels, rip?.status])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-earth-200 bg-earth-50 p-4">
        <div className="mb-2 flex items-center justify-between text-sm font-medium text-earth-800">
          <span>{labels?.packs || 'Packs abertos'}</span>
          <span>
            {opened}/{planned}
          </span>
        </div>
        <div className="h-2 rounded-full bg-earth-200">
          <div className="h-2 rounded-full bg-collector-600" style={{ width: `${percentage}%` }} />
        </div>
      </div>
      <LiveRipStatusTimeline items={timelineItems} />
    </div>
  )
}

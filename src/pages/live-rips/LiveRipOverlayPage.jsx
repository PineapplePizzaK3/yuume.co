import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LiveRipPullReveal from '../../components/live-rips/LiveRipPullReveal'
import { supabase } from '../../lib/supabase'
import { getLiveRipPulls, getLiveRipQueue } from '../../services/liveRipService'

function LiveRipOverlayPage() {
  const [searchParams] = useSearchParams()
  const theme = String(searchParams.get('theme') || 'dark').toLowerCase() === 'light' ? 'light' : 'dark'
  const [queueData, setQueueData] = useState({ event: null, rows: [] })
  const [pulls, setPulls] = useState([])
  const [realtimeOk, setRealtimeOk] = useState(false)

  useEffect(() => {
    let mounted = true
    let timerId = null

    const load = async () => {
      const [queueResult, pullsResult] = await Promise.all([getLiveRipQueue(), getLiveRipPulls()])
      if (!mounted) return
      if (queueResult?.data) setQueueData(queueResult.data)
      if (Array.isArray(pullsResult?.data)) setPulls(pullsResult.data)
      timerId = window.setTimeout(load, 20000)
    }

    load()

    const channel = supabase
      .channel('live-rips-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_rip_pulls' }, () => {
        void load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_rip_reservations' }, () => {
        void load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_events' }, () => {
        void load()
      })
      .subscribe((status) => setRealtimeOk(status === 'SUBSCRIBED'))

    return () => {
      mounted = false
      if (timerId) window.clearTimeout(timerId)
      supabase.removeChannel(channel)
    }
  }, [])

  const latestPull = pulls[0] || null
  const recentPulls = useMemo(() => pulls.slice(0, 4), [pulls])
  const opening = queueData.rows?.find((row) => row.status === 'opening') || queueData.rows?.[0] || null

  const shellClass =
    theme === 'light'
      ? 'min-h-screen bg-transparent text-earth-900'
      : 'min-h-screen bg-transparent text-white'

  const panelClass =
    theme === 'light'
      ? 'rounded-2xl border border-earth-200/80 bg-white/90 p-4 shadow-lg backdrop-blur'
      : 'rounded-2xl border border-white/20 bg-black/55 p-4 shadow-lg backdrop-blur'

  return (
    <div className={shellClass}>
      <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className={panelClass}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {queueData?.event?.title || 'Live Rips'}
          </p>
          <h1 className="mt-1 text-2xl font-bold">Último pull</h1>
          <div className="mt-4 max-w-sm">
            <LiveRipPullReveal pull={latestPull} emptyLabel="Aguardando reveal..." />
          </div>
          <p className="mt-3 text-[11px] opacity-70">
            {realtimeOk ? 'Realtime conectado' : 'Fallback polling ativo'}
          </p>
        </section>

        <aside className="space-y-4">
          <section className={panelClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Agora abrindo</p>
            <p className="mt-2 text-lg font-semibold">
              {opening?.rip_code || '-'} {opening?.customer_name || opening?.customerName || ''}
            </p>
            <p className="text-sm opacity-80">
              {opening?.product_name_en || opening?.product_name || '-'}
            </p>
          </section>

          <section className={panelClass}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Pulls recentes</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {recentPulls.map((pull) => (
                <LiveRipPullReveal key={pull.id} pull={pull} compact />
              ))}
              {!recentPulls.length ? (
                <p className="col-span-2 text-sm opacity-70">Nenhum pull registrado ainda.</p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default LiveRipOverlayPage

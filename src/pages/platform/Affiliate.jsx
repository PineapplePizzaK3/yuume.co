import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { getMyAffiliateDashboard } from '../../services/affiliateService'

function formatMoney(value, currency = 'BRL') {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency })
}

export default function Affiliate() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) return
      setLoading(true)
      const { data: dashboard, error } = await getMyAffiliateDashboard(user.id)
      if (!isActive) return
      if (error) setFeedback(error.message || 'Erro ao carregar afiliado')
      setData(dashboard)
      setLoading(false)
    }
    run()
    return () => { isActive = false }
  }, [user?.id])

  const affiliateLink = useMemo(() => {
    const code = data?.affiliate?.code
    if (!code) return ''
    return `${window.location.origin}/?ref=${code}`
  }, [data?.affiliate?.code])

  return (
    <>
      <Helmet>
        <title>Affiliate | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Affiliate</h1>
        <p className="mt-2 text-earth-600">
          Promova a plataforma com seu link e acompanhe cliques, conversões e comissões.
        </p>

        {feedback && (
          <p className="mt-4 rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800">{feedback}</p>
        )}

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}

        {!loading && data && (
          <div className="mt-6 space-y-5">
            <section className="rounded-xl border border-earth-200 bg-earth-50 p-4">
              <p className="text-sm text-earth-600">Seu código</p>
              <p className="text-xl font-semibold text-earth-900">{data.affiliate?.code || '—'}</p>
              <p className="mt-2 text-sm text-earth-600">Seu link de afiliado</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="max-w-full truncate rounded bg-white px-2 py-1 text-sm text-earth-800 border border-earth-200">
                  {affiliateLink || '—'}
                </code>
                {affiliateLink && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(affiliateLink)}
                    className="rounded border border-earth-300 bg-white px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100"
                  >
                    Copiar
                  </button>
                )}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-earth-200 bg-white p-4">
                <p className="text-xs text-earth-500">Cliques</p>
                <p className="text-2xl font-bold text-earth-900">{data.metrics?.clicks || 0}</p>
              </div>
              <div className="rounded-lg border border-earth-200 bg-white p-4">
                <p className="text-xs text-earth-500">Conversões</p>
                <p className="text-2xl font-bold text-earth-900">{data.metrics?.conversions || 0}</p>
              </div>
              <div className="rounded-lg border border-earth-200 bg-white p-4">
                <p className="text-xs text-earth-500">Ganhos</p>
                <p className="text-2xl font-bold text-earth-900">{formatMoney(data.metrics?.earnings || 0, 'BRL')}</p>
              </div>
              <div className="rounded-lg border border-earth-200 bg-white p-4">
                <p className="text-xs text-earth-500">Comissões pendentes</p>
                <p className="text-2xl font-bold text-earth-900">{data.metrics?.pending || 0}</p>
              </div>
            </section>

            <section className="rounded-xl border border-earth-200 bg-white p-4">
              <h2 className="font-semibold text-earth-900">Comissões por pedido</h2>
              {data.orders?.length === 0 ? (
                <p className="mt-2 text-sm text-earth-600">Nenhuma comissão registrada ainda.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.orders.slice(0, 40).map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-earth-200 bg-earth-50 px-3 py-2 text-sm">
                      <span className="text-earth-700">
                        Pedido {String(row.order_id).slice(0, 8)}… • {row.status}
                      </span>
                      <span className="font-medium text-earth-900">{formatMoney(row.commission_amount || 0, 'BRL')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-earth-200 bg-white p-4">
              <h2 className="font-semibold text-earth-900">Payouts</h2>
              {data.payouts?.length === 0 ? (
                <p className="mt-2 text-sm text-earth-600">Nenhum payout ainda.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.payouts.slice(0, 30).map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-earth-200 bg-earth-50 px-3 py-2 text-sm">
                      <span className="text-earth-700">
                        {p.status} • {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}
                      </span>
                      <span className="font-medium text-earth-900">{formatMoney(p.amount || 0, 'BRL')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  )
}


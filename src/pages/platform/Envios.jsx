/**
 * Envios - acompanhamento de solicitações de envio (shipments).
 * Mostra solicitados → aguardando pagamento → pagos → enviados → finalizados.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getMyShipments, cancelShipment } from '../../services/inventoryService'
import { cacheKey, readCache, writeCache } from '../../lib/cache'
import { formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'

const SHIPMENT_STATUS_LABELS = {
  requested: 'Solicitado',
  awaiting_payment: 'Aguardando pagamento do frete',
  paid: 'Frete pago',
  shipped: 'Enviado',
  completed: 'Finalizado',
}

export default function Envios() {
  const { user } = useAuth()
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [cancellingId, setCancellingId] = useState(null)

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) {
        if (isActive) setLoading(false)
        return
      }
      const k = cacheKey(user.id, 'shipments_page_v1')
      const cached = readCache(k, 1000 * 60 * 30)
      if (cached && isActive) {
        setShipments(cached.shipments ?? [])
        setLoading(false)
      }

      try {
        if (isActive) setLoading(true)
        const { data, error } = await getMyShipments(user.id)
        if (!isActive) return
        setShipments(data ?? [])
        if (error) setFeedback(error.message)
        writeCache(k, { shipments: data ?? [] })
      } catch (e) {
        if (isActive) setFeedback(e?.message || 'Erro ao carregar envios')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id])

  const refreshShipments = async () => {
    if (!user?.id) return
    const { data } = await getMyShipments(user.id)
    setShipments(data ?? [])
    writeCache(cacheKey(user.id, 'shipments_page_v1'), { shipments: data ?? [] })
  }

  const handleCancel = async (s) => {
    if (s.status !== 'requested') return
    setCancellingId(s.id)
    setFeedback('')
    const { error } = await cancelShipment(user.id, s.id)
    setCancellingId(null)
    if (error) {
      setFeedback(error.message || 'Erro ao cancelar envio')
      return
    }
    setFeedback('Envio cancelado.')
    await refreshShipments()
  }

  if (!user) {
    return (
      <div className="py-8">
        <p className="text-earth-600">
          <Link to="/login" className="font-medium text-earth-900 underline">
            Faça login
          </Link>{' '}
          para acessar seus envios.
        </p>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Envios | Plataforma</title>
      </Helmet>

      <div>
        <h1 className="text-2xl font-bold text-earth-900">Envios</h1>
        <p className="mt-2 text-earth-600">
          Acompanhe seus envios solicitados, em execução e finalizados.
        </p>

        {feedback && (
          <p className="mt-4 rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800">
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}

        {!loading && shipments.length === 0 && (
          <p className="mt-6 text-earth-600">Você ainda não solicitou envios.</p>
        )}

        {!loading && shipments.length > 0 && (
          <div className="mt-6 space-y-4">
            {shipments.map((s) => {
              const statusLabel = SHIPMENT_STATUS_LABELS[s.status] || s.status || '—'
              const currency = (s.shipping_currency || 'JPY').toUpperCase()
              const cost = s.shipping_cost != null ? Number(s.shipping_cost) : null

              return (
                <section key={s.id} className="rounded-xl border border-earth-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-earth-900">
                        Envio {String(s.id).slice(0, 8)}
                      </h2>
                      <p className="mt-1 text-sm text-earth-600">
                        Status: <span className="font-medium text-earth-800">{statusLabel}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {s.status === 'requested' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(s)}
                          disabled={cancellingId === s.id}
                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          {cancellingId === s.id ? 'Cancelando...' : 'Cancelar envio'}
                        </button>
                      )}
                      {cost != null && cost > 0 && (
                        <p className="text-sm font-medium text-earth-700">
                          Frete:{' '}
                          {currency === 'BRL' ? (
                            formatBRL(cost)
                          ) : (
                            formatJPY(cost)
                          )}
                        </p>
                      )}
                      {cost != null && cost > 0 && currency !== 'BRL' && (
                        <p className="text-xs text-earth-600">
                          Aproximado em BRL: {formatBRL(jpyToBrl(cost))}
                        </p>
                      )}
                    </div>
                  </div>

                  {s.tracking_code && (
                    <div className="mt-3 rounded-lg border border-earth-100 bg-earth-50 p-3">
                      <p className="text-sm font-medium text-earth-800">Rastreio</p>
                      <p className="mt-1 text-sm text-earth-600">{s.tracking_code}</p>
                    </div>
                  )}

                  {s.extra_services && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.extra_services.photos && (
                        <span className="rounded bg-earth-100 px-2 py-0.5 text-xs text-earth-700">
                          Fotos
                        </span>
                      )}
                      {s.extra_services.video && (
                        <span className="rounded bg-earth-100 px-2 py-0.5 text-xs text-earth-700">
                          Vídeo
                        </span>
                      )}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}


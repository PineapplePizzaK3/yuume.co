/**
 * Payments - Histórico de pagamentos do usuário.
 * Exibe pagamentos de frete (cartão e carteira) vinculados aos pedidos.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getMyPayments } from '../../services/paymentService'
import { formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'

const STATUS_LABELS = {
  pending: 'Pendente',
  completed: 'Concluído',
  failed: 'Falhou',
  refunded: 'Reembolsado',
}

export default function Payments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) {
        if (isActive) setLoading(false)
        return
      }
      try {
        const { data, error } = await getMyPayments()
        if (!isActive) return
        setPayments(data ?? [])
        if (error) setFeedback(error.message)
      } catch (e) {
        if (isActive) setFeedback(e?.message || 'Erro ao carregar pagamentos')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => { isActive = false }
  }, [user?.id])

  const paymentMethod = (p) => {
    const raw = String(p?.stripe_payment_id || '').trim()
    if (!raw) return '—'
    const id = raw.toLowerCase()
    if (id.startsWith('wallet')) return 'Carteira'
    if (id === 'referral_discount') return 'Desconto'
    if (id.startsWith('parcelow')) return 'Parcelow'
    if (id.includes('pix')) return 'PIX'
    if (id.startsWith('pi_') || id.startsWith('cs_') || id.startsWith('ch_')) return 'Cartão'
    if (id.includes('manual')) return 'Manual'
    if (raw) return 'Cartão'
    return '—'
  }
  const paymentKind = (p) => {
    const o = order(p)
    const id = String(p?.stripe_payment_id || '').toLowerCase()
    if (id === 'referral_discount') return 'Desconto'
    if (o?.order_source === 'store') return 'Loja'
    if (Number(o?.quote_amount) > 0) return 'Serviço'
    if (Number(o?.shipping_cost) > 0) return 'Frete'
    if (p?.order_id) return 'Pedido'
    return 'Pagamento'
  }

  const order = (p) => {
    const o = p.orders ?? p.order
    return o != null && !Array.isArray(o) ? o : null
  }
  const serviceName = (p) => {
    const o = order(p)
    if (!o) return ''
    const svc = o.service
    return (svc && (svc.name ?? (Array.isArray(svc) ? svc[0]?.name : null))) ?? ''
  }
  // Diretriz de moeda: JPY é valor base; BRL é sempre derivado por conversão.
  const amountDisplay = (p) => {
    const amount = Number(p?.amount) || 0
    const currency = String(p?.currency || 'JPY').toUpperCase()
    if (currency === 'BRL') {
      return {
        primary: formatBRL(amount),
        secondary: 'registro legado em BRL',
      }
    }
    return {
      primary: formatJPY(amount),
      secondary: `${formatBRL(jpyToBrl(amount))} convertido`,
    }
  }

  return (
    <>
      <Helmet>
        <title>Pagamentos | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Pagamentos</h1>
        <p className="mt-2 text-earth-600">
          Histórico de pagamentos de frete e serviços. Recargas da carteira aparecem em{' '}
          <Link to="/app/lounge" className="font-medium text-earth-900 underline hover:no-underline">
            Carteira
          </Link>
          .
        </p>

        {feedback && (
          <p className="mt-4 rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800">
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">Carregando pagamentos...</p>}

        {!loading && payments.length === 0 && (
          <p className="mt-6 text-earth-600">Nenhum pagamento registrado.</p>
        )}

        {!loading && payments.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-xl border border-earth-200">
            <div className="hidden bg-earth-100 sm:grid sm:grid-cols-12 sm:gap-4 sm:px-4 sm:py-3 sm:text-xs sm:font-semibold sm:uppercase sm:tracking-wide sm:text-earth-600">
              <div className="sm:col-span-3">Data</div>
              <div className="sm:col-span-3">Descrição</div>
              <div className="sm:col-span-2">Valor</div>
              <div className="sm:col-span-2">Método</div>
              <div className="sm:col-span-2">Status</div>
            </div>
            <ul className="divide-y divide-earth-200">
              {payments.map((p) => {
                const o = order(p)
                const orderId = o?.id ?? p.order_id
                const display = amountDisplay(p)
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-2 bg-white px-4 py-4 sm:grid sm:grid-cols-12 sm:gap-4 sm:py-3"
                  >
                    <div className="w-full text-earth-700 sm:col-span-3 sm:w-auto">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </div>
                    <div className="w-full sm:col-span-3 sm:w-auto">
                      {orderId ? (
                        <Link
                          to={`/app/lounge?tab=pedidos&orderId=${encodeURIComponent(orderId)}`}
                          className="text-earth-900 underline decoration-earth-300 underline-offset-2 hover:decoration-earth-700"
                        >
                          {paymentKind(p)} · Pedido {String(orderId).slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="text-earth-900">{paymentKind(p)}</span>
                      )}
                      {serviceName(p) && (
                        <p className="text-sm text-earth-500">{serviceName(p)}</p>
                      )}
                    </div>
                    <div className="w-full font-medium text-earth-900 sm:col-span-2 sm:w-auto">
                      <div>{display.primary}</div>
                      <p className="text-xs font-normal text-earth-500">{display.secondary}</p>
                    </div>
                    <div className="w-full text-earth-600 sm:col-span-2 sm:w-auto">
                      {paymentMethod(p)}
                    </div>
                    <div className="w-full sm:col-span-2 sm:w-auto">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : p.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-earth-100 text-earth-700'
                        }`}
                      >
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

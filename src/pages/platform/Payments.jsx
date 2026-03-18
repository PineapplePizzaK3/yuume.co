/**
 * Payments - Histórico de pagamentos do usuário.
 * Exibe pagamentos de frete (cartão e carteira) vinculados aos pedidos.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getMyPayments } from '../../services/paymentService'

function formatMoney(value, currency = 'BRL') {
  return Number(value)?.toLocaleString('pt-BR', { style: 'currency', currency }) ?? '—'
}

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
    if (p.stripe_payment_id === 'wallet') return 'Carteira'
    if (p.stripe_payment_id) return 'Cartão'
    return '—'
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
  const currency = (p) => {
    const o = order(p)
    return (o && o.shipping_currency) ? o.shipping_currency : 'BRL'
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
          <Link to="/app/wallet" className="font-medium text-earth-900 underline hover:no-underline">
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
                      <span className="text-earth-900">
                        Frete
                        {orderId ? ` · Pedido ${String(orderId).slice(0, 8)}…` : ''}
                      </span>
                      {serviceName(p) && (
                        <p className="text-sm text-earth-500">{serviceName(p)}</p>
                      )}
                    </div>
                    <div className="w-full font-medium text-earth-900 sm:col-span-2 sm:w-auto">
                      {formatMoney(p.amount, currency(p))}
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
                    {orderId && (
                      <div className="w-full sm:col-span-12 sm:mt-1 sm:flex sm:justify-end">
                        <Link
                          to="/app/orders"
                          className="text-sm font-medium text-earth-700 hover:text-earth-900"
                        >
                          Ver pedido →
                        </Link>
                      </div>
                    )}
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

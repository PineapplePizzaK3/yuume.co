/**
 * Orders - Pedidos do usuário.
 * Fluxo: pedido → pagamento do pedido → recebimento (serviços extras) →
 * consolidamos e definimos frete → cliente paga frete → enviamos.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { deleteMyOrder, getMyOrders, requestOrderExtraServices, ORDER_STATUS_LABELS, updateMyOrder } from '../../services/orderService'
import { createCheckoutSession, createKomojuSession } from '../../services/paymentService'
import { getWallet, payOrderWithWallet } from '../../services/walletService'
import { cacheKey, readCache, writeCache } from '../../lib/cache'
import { brlToJpy, formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'

export default function Orders() {
  const { user, session } = useAuth()
  const [orders, setOrders] = useState([])
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [payModal, setPayModal] = useState({ open: false, order: null, useWallet: true })
  const [extraServicesOrderId, setExtraServicesOrderId] = useState(null)
  const [extraServices, setExtraServices] = useState({ photos: false, video: false })
  const [editModal, setEditModal] = useState({ open: false, orderId: null, message: '' })
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setFeedback('Pagamento realizado com sucesso!')
      window.history.replaceState({}, '', '/app/orders')
    }
    if (params.get('canceled') === 'true') {
      setFeedback('Pagamento cancelado.')
      window.history.replaceState({}, '', '/app/orders')
    }
  }, [])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) {
        if (isActive) setLoading(false)
        return
      }
      const k = cacheKey(user.id, 'orders_page_v1')
      const cached = readCache(k, 1000 * 60 * 30)
      if (cached && isActive) {
        setOrders(cached.orders ?? [])
        setWallet(cached.wallet ?? null)
        setLoading(false)
      }
      try {
        const [ordersRes, walletRes] = await Promise.all([
          getMyOrders(user.id),
          getWallet(user.id),
        ])
        if (!isActive) return
        setOrders(ordersRes.data ?? [])
        setWallet(walletRes.data ?? null)
        if (ordersRes.error) setFeedback(ordersRes.error.message)
        writeCache(k, { orders: ordersRes.data ?? [], wallet: walletRes.data ?? null })
      } catch (e) {
        if (isActive) setFeedback(e?.message || 'Erro ao carregar pedidos')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id])

  const getPayableAmount = (order) => {
    if (order.status !== 'awaiting_payment') return null
    if (order.quote_amount != null && Number(order.quote_amount) > 0) {
      return { amount: Number(order.quote_amount), currency: order.quote_currency || 'BRL', label: 'Orçamento' }
    }
    if (order.total_amount != null && Number(order.total_amount) > 0) {
      return { amount: Number(order.total_amount), currency: 'BRL', label: 'Total' }
    }
    if (order.shipping_cost != null && Number(order.shipping_cost) > 0) {
      return { amount: Number(order.shipping_cost), currency: order.shipping_currency || 'JPY', label: 'Frete' }
    }
    return null
  }

  const getChargeJpy = (order) => {
    const p = getPayableAmount(order)
    if (!p) return null
    const c = (p.currency || 'JPY').toUpperCase()
    const amountJpy = c === 'BRL' ? brlToJpy(p.amount) : p.amount
    const roundedJpy = Math.round(Number(amountJpy) || 0)
    return { amountJpy: roundedJpy, approxBrl: jpyToBrl(roundedJpy), label: p.label }
  }

  const shouldShowEditDelete = (order) => {
    // Após pagamento, removemos os botões (pedido entra em execução operacional).
    return !['paid', 'products_paid', 'shipped', 'completed'].includes(order.status)
  }

  const refreshOrders = async () => {
    if (!user?.id) return
    const [ordersRes, walletRes] = await Promise.all([getMyOrders(user.id), getWallet(user.id)])
    setOrders(ordersRes.data ?? [])
    setWallet(walletRes.data ?? null)
    const k = cacheKey(user.id, 'orders_page_v1')
    writeCache(k, { orders: ordersRes.data ?? [], wallet: walletRes.data ?? null })
  }

  const handlePayShipping = async (order, { useWallet = false } = {}) => {
    const payable = getPayableAmount(order)
    if (!payable) return
    setPayingId(order.id)
    setFeedback('')
    try {
      const accessToken = session?.access_token
      if (!accessToken) {
        setFeedback('Faça login novamente para pagar')
        setPayingId(null)
        return
      }
      const result = await createCheckoutSession(order.id, accessToken, { useWallet })
      if (result?.paid) {
        setFeedback('Pagamento realizado com sucesso!')
        await refreshOrders()
        setPayModal({ open: false, order: null, useWallet: true })
        return
      }
      const url = result?.url
      if (url) window.location.href = url
      else setFeedback('Erro ao criar sessão de pagamento')
    } catch (err) {
      setFeedback(err.message || 'Erro ao processar pagamento')
    } finally {
      setPayingId(null)
    }
  }

  const handlePayWithKomoju = async (order, paymentType) => {
    const payable = getPayableAmount(order)
    if (!payable) return
    setPayingId(order.id)
    setFeedback('')
    try {
      const accessToken = session?.access_token
      if (!accessToken) {
        setFeedback('Faça login novamente para pagar')
        setPayingId(null)
        return
      }
      const { url } = await createKomojuSession(order.id, paymentType, accessToken)
      if (url) window.location.href = url
      else setFeedback('Erro ao criar sessão de pagamento (KOMOJU)')
    } catch (err) {
      setFeedback(err.message || 'Erro ao processar pagamento (KOMOJU)')
    } finally {
      setPayingId(null)
    }
  }

  const getExtraServicesForOrder = (order) => {
    if (extraServicesOrderId === order.id) return extraServices
    return {
      photos: !!order.extra_services?.photos,
      video: !!order.extra_services?.video,
    }
  }

  const handleRequestExtraServices = async (order) => {
    if (order.status !== 'item_received') return
    const toSend = getExtraServicesForOrder(order)
    if (!toSend.photos && !toSend.video) {
      setFeedback('Marque pelo menos uma opção (fotos ou vídeo).')
      return
    }
    setFeedback('')
    try {
      const { error } = await requestOrderExtraServices(order.id, toSend)
      if (error) {
        setFeedback(error.message || 'Erro ao solicitar serviços')
        return
      }
      setFeedback('Solicitação de serviços extras enviada!')
      const { data: ordersData } = await getMyOrders(user.id)
      setOrders(ordersData ?? [])
      setExtraServicesOrderId(null)
      setExtraServices({ photos: false, video: false })
    } catch (err) {
      setFeedback(err?.message || 'Erro ao solicitar')
    }
  }

  const handlePayWithWallet = async (order) => {
    const payable = getPayableAmount(order)
    if (!payable) return
    if (payable.currency !== 'BRL') {
      setFeedback('Pagamento com carteira disponível apenas para valores em R$ (BRL).')
      return
    }
    const balance = wallet?.balance ?? 0
    if (balance < payable.amount) {
      setFeedback('Saldo insuficiente na carteira. Adicione saldo em Carteira ou pague com cartão.')
      return
    }
    setPayingId(order.id)
    setFeedback('')
    try {
      const { data, error } = await payOrderWithWallet(order.id, user.id)
      if (error) {
        setFeedback(error.message || 'Erro ao pagar com carteira')
        return
      }
      setFeedback('Pagamento realizado com carteira!')
      const { data: ordersData } = await getMyOrders(user.id)
      setOrders(ordersData ?? [])
      const { data: walletData } = await getWallet(user.id)
      setWallet(walletData ?? null)
    } catch (err) {
      setFeedback(err.message || 'Erro ao processar pagamento')
    } finally {
      setPayingId(null)
    }
  }

  return (
    <>
      <Helmet>
        <title>Pedidos | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Pedidos</h1>
        <p className="mt-2 text-earth-600">
          Acompanhe seus pedidos: criação → aguardando chegada → item recebido → armazenado → pronto para envio → aguardando pagamento do frete → enviado → finalizado. Os itens recebidos aparecem em Meus Produtos, onde você pode solicitar a consolidação e o envio.
        </p>

        {feedback && (
          <p
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              feedback.includes('sucesso')
                ? 'bg-green-100 text-green-800'
                : feedback.includes('cancelado')
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">Carregando pedidos...</p>}

        {!loading && orders.length === 0 && (
          <p className="mt-6 text-earth-600">Você ainda não tem pedidos.</p>
        )}

        {!loading && orders.length > 0 && (
          <div className="mt-6 space-y-4">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-earth-200 bg-earth-50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="font-medium text-earth-900">
                      Pedido {o.id?.slice(0, 8)}…
                    </span>
                    <span className="ml-2 rounded bg-earth-200 px-2 py-0.5 text-xs text-earth-700">
                      {ORDER_STATUS_LABELS[o.status] ?? o.status}
                    </span>
                    {o.service?.name && (
                      <p className="mt-1 text-sm text-earth-600">{o.service.name}</p>
                    )}
                    {o.message && (
                      <p className="mt-1 text-sm text-earth-500 italic">{o.message}</p>
                    )}
                    {(() => {
                      const c = getChargeJpy(o)
                      return c && (
                        <div className="mt-2">
                          <p className="text-lg font-semibold text-earth-900">
                            {c.label}: {formatJPY(c.amountJpy)}
                          </p>
                          <p className="text-xs text-earth-600">
                            Aproximado em BRL: {formatBRL(c.approxBrl)}
                          </p>
                        </div>
                      )
                    })()}
                    {o.status === 'item_received' && (
                      <div className="mt-3 rounded-lg border border-earth-200 bg-white p-3">
                        <p className="text-sm font-medium text-earth-800">Serviços extras</p>
                        <p className="mt-1 text-xs text-earth-600">
                          Solicite fotos e/ou vídeo do produto recebido.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={o.id === extraServicesOrderId ? extraServices.photos : (o.extra_services?.photos ?? false)}
                              onChange={(e) => {
                                if (o.id !== extraServicesOrderId) {
                                  setExtraServicesOrderId(o.id)
                                  setExtraServices({ photos: e.target.checked, video: o.extra_services?.video ?? false })
                                } else {
                                  setExtraServices((s) => ({ ...s, photos: e.target.checked }))
                                }
                              }}
                              className="rounded border-earth-300"
                            />
                            <span className="text-sm text-earth-700">Fotos</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={o.id === extraServicesOrderId ? extraServices.video : (o.extra_services?.video ?? false)}
                              onChange={(e) => {
                                if (o.id !== extraServicesOrderId) {
                                  setExtraServicesOrderId(o.id)
                                  setExtraServices({ photos: o.extra_services?.photos ?? false, video: e.target.checked })
                                } else {
                                  setExtraServices((s) => ({ ...s, video: e.target.checked }))
                                }
                              }}
                              className="rounded border-earth-300"
                            />
                            <span className="text-sm text-earth-700">Vídeo</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRequestExtraServices(o)}
                            disabled={!(getExtraServicesForOrder(o).photos || getExtraServicesForOrder(o).video)}
                            className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-50"
                          >
                            Solicitar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {shouldShowEditDelete(o) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditModal({ open: true, orderId: o.id, message: o.message ?? '' })}
                          className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 font-medium text-earth-800 hover:bg-earth-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Remover este pedido?')) return
                            setDeletingId(o.id)
                            setFeedback('')
                            const { error } = await deleteMyOrder(user.id, o.id)
                            setDeletingId(null)
                            if (error) setFeedback(error.message || 'Erro ao remover pedido')
                            else {
                              setFeedback('Pedido removido.')
                              await refreshOrders()
                            }
                          }}
                          disabled={deletingId === o.id}
                          className="rounded-lg border border-red-300 bg-white px-4 py-2.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingId === o.id ? 'Removendo...' : 'Remover'}
                        </button>
                      </>
                    )}
                    {getPayableAmount(o) && (
                      <>
                      {getPayableAmount(o).currency === 'BRL' &&
                        (wallet?.balance ?? 0) >= getPayableAmount(o).amount && (
                        <button
                          type="button"
                          onClick={() => handlePayWithWallet(o)}
                          disabled={payingId === o.id}
                          className="rounded-lg bg-earth-800 px-4 py-2.5 font-medium text-earth-50 hover:bg-earth-700 disabled:opacity-60"
                        >
                          {payingId === o.id ? 'Processando...' : 'Pagar com carteira'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPayModal({ open: true, order: o, useWallet: true })}
                        disabled={payingId === o.id}
                        className="rounded-lg bg-earth-900 px-4 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                      >
                        {payingId === o.id ? 'Redirecionando...' : 'Pagar'}
                      </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editModal.open && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setFeedback('')
            const { error } = await updateMyOrder(user.id, editModal.orderId, { message: editModal.message })
            if (error) {
              setFeedback(error.message || 'Erro ao salvar')
              return
            }
            setEditModal({ open: false, orderId: null, message: '' })
            setFeedback('Pedido atualizado.')
            await refreshOrders()
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditModal({ open: false, orderId: null, message: '' })}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-earth-900">Editar pedido</h3>
            <p className="mt-1 text-sm text-earth-600">
              Você pode editar a mensagem do pedido enquanto o pagamento não tiver sido realizado.
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-earth-700">Mensagem</label>
              <textarea
                value={editModal.message}
                onChange={(e) => setEditModal((m) => ({ ...m, message: e.target.value }))}
                rows={4}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              />
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setEditModal({ open: false, orderId: null, message: '' })}
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {payModal.open && payModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
            <h3 className="font-semibold text-earth-900">Pagamento</h3>
            <p className="mt-1 text-sm text-earth-600">
              Escolha como deseja pagar este pedido.
            </p>

            {(() => {
              const p = getChargeJpy(payModal.order)
              const balance = wallet?.balance ?? 0
              const canUseWallet = false
              return (
                <div className="mt-4 space-y-4">
                  {p && (
                    <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
                      <p className="text-sm text-earth-700">
                        <span className="font-medium text-earth-900">{p.label}</span>: {formatJPY(p.amountJpy)}
                      </p>
                      <p className="mt-1 text-xs text-earth-600">
                        Aproximado em BRL: {formatBRL(p.approxBrl)}
                      </p>
                    </div>
                  )}

                  <label className={`flex items-start gap-3 rounded-lg border p-4 ${canUseWallet ? 'border-earth-200 bg-white' : 'border-earth-100 bg-earth-50 opacity-70'}`}>
                    <input
                      type="checkbox"
                      checked={!!payModal.useWallet}
                      disabled={!canUseWallet}
                      onChange={(e) => setPayModal((m) => ({ ...m, useWallet: e.target.checked }))}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-earth-900">Usar saldo da carteira</p>
                      <p className="text-sm text-earth-600">
                        Cobrança é sempre em JPY. A carteira (BRL) ficará disponível quando ativarmos conversão por saldo.
                      </p>
                    </div>
                  </label>

                  <div className="rounded-lg border border-earth-200 bg-white p-4">
                    <p className="text-sm font-medium text-earth-800">Opções de pagamento</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handlePayShipping(payModal.order, { useWallet: !!payModal.useWallet })}
                        disabled={payingId === payModal.order.id}
                        className="rounded-lg bg-earth-900 px-4 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                      >
                        {payingId === payModal.order.id ? 'Processando...' : 'Cartão'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePayWithKomoju(payModal.order, 'pix')}
                        disabled={payingId === payModal.order.id}
                        className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                      >
                        PIX
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayModal({ open: false, order: null, useWallet: true })}
                        className="rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-100"
                      >
                        Cancelar
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-earth-500">
                      Cartão: Stripe (principal) com fallback automático para KOMOJU em caso de falha.
                    </p>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </>
  )
}

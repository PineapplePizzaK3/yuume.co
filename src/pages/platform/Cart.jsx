/**
 * Carrinho - Checkout da loja virtual.
 * Produtos comprados vão para Meus Produtos; o cliente solicita o envio quando quiser.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getCart, updateCartItem, removeFromCart, createStoreOrder } from '../../services/cartService'
import { createCheckoutSession, createKomojuSession } from '../../services/paymentService'
import { getWallet } from '../../services/walletService'
import { brlToJpy, formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'

function formatPriceBrlAsJpy(brl) {
  const jpy = Math.round(brlToJpy(brl))
  const approxBrl = jpyToBrl(jpy)
  return { jpy, approxBrl }
}

export default function Cart() {
  const { user, session } = useAuth()
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [payModal, setPayModal] = useState({ open: false, order: null, useWallet: true })
  const [feedback, setFeedback] = useState('')

  const success = searchParams.get('success') === 'true'
  const canceled = searchParams.get('canceled') === 'true'

  const loadCart = async () => {
    if (!user?.id) return
    setLoading(true)
    const { data, error } = await getCart(user.id)
    setItems(data ?? [])
    if (error) setFeedback(error.message)
    setLoading(false)
  }

  useEffect(() => {
    loadCart()
  }, [user?.id])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) return
      const { data } = await getWallet(user.id)
      if (!isActive) return
      setWallet(data ?? null)
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id])

  useEffect(() => {
    if (success) setFeedback('Compra realizada com sucesso! Os produtos estão em Meus Produtos.')
    if (canceled) setFeedback('Pagamento cancelado.')
  }, [success, canceled])

  const totalBrl = items.reduce((sum, i) => sum + (Number(i.products?.price ?? 0) * (i.quantity || 1)), 0)
  const totalJpy = Math.round(brlToJpy(totalBrl))

  const handleUpdateQty = async (productId, quantity) => {
    const qty = Math.max(1, Math.min(99, Number(quantity) || 1))
    const { error } = await updateCartItem(user.id, productId, qty)
    if (error) setFeedback(error.message)
    else {
      loadCart()
    }
  }

  const handleRemove = async (productId) => {
    const { error } = await removeFromCart(user.id, productId)
    if (error) setFeedback(error.message)
    else {
      loadCart()
    }
  }

  const handleCheckout = async () => {
    if (items.length === 0) {
      setFeedback('Carrinho vazio.')
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      const { data: order, error } = await createStoreOrder(
        user.id,
        false,
        null,
        null
      )
      if (error) {
        setFeedback(error.message || 'Erro ao criar pedido')
        setSubmitting(false)
        return
      }
      // Pedido criado: abre modal de pagamento (Stripe / PIX / carteira)
      setPayModal({ open: true, order, useWallet: true })
      setFeedback('')
    } catch (e) {
      setFeedback(e?.message || 'Erro ao processar')
    } finally {
      setSubmitting(false)
    }
  }

  const getOrderChargeJpy = (order) => {
    if (!order?.total_amount) return null
    const totalBrl = Number(order.total_amount)
    if (!totalBrl || totalBrl <= 0) return null
    const jpy = Math.round(brlToJpy(totalBrl))
    return { jpy, approxBrl: totalBrl }
  }

  const handlePayCard = async () => {
    if (!payModal.order) return
    const accessToken = session?.access_token
    if (!accessToken) {
      setFeedback('Faça login novamente para pagar.')
      return
    }
    const orderId = payModal.order.id
    try {
      setSubmitting(true)
      setFeedback('')
      const result = await createCheckoutSession(orderId, accessToken, { useWallet: !!payModal.useWallet })
      if (result?.paid) {
        setPayModal({ open: false, order: null, useWallet: true })
        setFeedback('Pagamento realizado com carteira.')
        window.location.href = '/app/orders?success=true'
        return
      }
      if (result?.url) window.location.href = result.url
      else setFeedback('Erro ao redirecionar para pagamento.')
    } catch (err) {
      setFeedback(err.message || 'Erro ao processar pagamento.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayPix = async () => {
    if (!payModal.order) return
    const accessToken = session?.access_token
    if (!accessToken) {
      setFeedback('Faça login novamente para pagar.')
      return
    }
    try {
      setSubmitting(true)
      setFeedback('')
      const { url } = await createKomojuSession(payModal.order.id, 'pix', accessToken)
      if (url) window.location.href = url
      else setFeedback('Erro ao redirecionar para PIX.')
    } catch (err) {
      setFeedback(err.message || 'Erro ao processar PIX.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="py-8">
        <p className="text-earth-600">
          <Link to="/login" className="font-medium text-earth-900 underline">Faça login</Link> para acessar o carrinho.
        </p>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Carrinho | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Carrinho</h1>
        <p className="mt-2 text-earth-600">
          Revise seus itens e finalize a compra. Os produtos irão para Meus Produtos; solicite o envio quando quiser.
        </p>

        {feedback && (
          <p
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              feedback.includes('sucesso') ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}

        {!loading && items.length === 0 && (
          <p className="mt-6 text-earth-600">
            Carrinho vazio. <Link to="/app/loja" className="font-medium text-earth-900 underline">Compre na loja</Link>.
          </p>
        )}

        {!loading && items.length > 0 && (
          <div className="mt-6 space-y-6">
            <div className="space-y-4">
              {items.map((item) => {
                const p = item.products
                if (!p) return null
                const subtotal = Number(p.price) * (item.quantity || 1)
                const unit = formatPriceBrlAsJpy(p.price)
                const sub = formatPriceBrlAsJpy(subtotal)
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border border-earth-200 bg-earth-50 p-4"
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-20 w-20 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-earth-200 text-earth-500 text-sm">
                        Sem imagem
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-earth-900">{p.name}</h3>
                      <p className="text-sm text-earth-600">
                        {formatJPY(unit.jpy)} cada <span className="text-xs">({formatBRL(unit.approxBrl)} aprox.)</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={item.quantity}
                        onChange={(e) => handleUpdateQty(item.product_id, e.target.value)}
                        onBlur={(e) => handleUpdateQty(item.product_id, e.target.value)}
                        className="w-16 rounded border border-earth-300 px-2 py-1 text-center text-earth-900"
                      />
                      <span className="font-semibold text-earth-900">{formatJPY(sub.jpy)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.product_id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-earth-200 bg-earth-50 p-6">
              <div>
                <p className="text-xl font-bold text-earth-900">Total: {formatJPY(totalJpy)}</p>
                <p className="text-sm text-earth-600">Aprox.: {formatBRL(jpyToBrl(totalJpy))}</p>
              </div>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={submitting}
                className="rounded-lg bg-earth-900 px-6 py-3 font-medium text-white hover:bg-earth-800 disabled:opacity-60"
              >
                {submitting ? 'Processando...' : 'Finalizar compra'}
              </button>
            </div>
          </div>
        )}
      </div>

      

      {payModal.open && payModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
            <h3 className="font-semibold text-earth-900">Pagamento</h3>
            <p className="mt-1 text-sm text-earth-600">Escolha a forma de pagamento.</p>

            {(() => {
              const charge = getOrderChargeJpy(payModal.order)
              const balance = wallet?.balance ?? 0
              const canUseWallet = balance > 0 && (wallet?.currency || 'JPY') === 'JPY'

              return (
                <div className="mt-4 space-y-4">
                  {charge && (
                    <div className="rounded-lg border border-earth-200 bg-earth-50 p-4">
                      <p className="text-sm text-earth-700">
                        <span className="font-medium text-earth-900">Valor (JPY)</span>: {formatJPY(charge.jpy)}
                      </p>
                      <p className="mt-1 text-xs text-earth-600">
                        Aprox. em BRL: {formatBRL(charge.approxBrl)}
                      </p>
                    </div>
                  )}

                  <label
                    className={`flex items-start gap-3 rounded-lg border p-4 ${
                      canUseWallet ? 'border-earth-200 bg-white' : 'border-earth-100 bg-earth-50 opacity-70'
                    }`}
                  >
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
                        Aplicaremos seu saldo (JPY) e o restante será pago.
                      </p>
                    </div>
                  </label>

                  <div className="rounded-lg border border-earth-200 bg-white p-4">
                    <p className="text-sm font-medium text-earth-800">Formas de pagamento</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handlePayCard}
                        disabled={submitting}
                        className="rounded-lg bg-earth-900 px-4 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                      >
                        {submitting ? 'Processando...' : 'Cartão'}
                      </button>
                      <button
                        type="button"
                        onClick={handlePayPix}
                        disabled={submitting}
                        className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                      >
                        PIX
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayModal({ open: false, order: null, useWallet: true })}
                        disabled={submitting}
                        className="rounded-lg border border-earth-300 px-4 py-2.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                      >
                        Fechar
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-earth-500">
                      Cartão: Stripe (principal) com fallback para KOMOJU.
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

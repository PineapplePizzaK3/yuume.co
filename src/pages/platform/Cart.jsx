/**
 * Carrinho - Checkout da loja virtual.
 * Produtos comprados vão para Meus Produtos; o cliente solicita o envio quando quiser.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getCart, updateCartItem, removeFromCart, createStoreOrder } from '../../services/cartService'
import { validateCoupon } from '../../services/couponService'
import { createCheckoutSession } from '../../services/paymentService'
import PixManualModal from '../../components/PixManualModal'
import { getWallet } from '../../services/walletService'
import { brlToJpy, formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'

function formatPriceBrlAsJpy(brl) {
  const jpy = Math.round(brlToJpy(brl))
  const approxBrl = jpyToBrl(jpy)
  return { jpy, approxBrl }
}

function Cart() {
  const { user, session } = useAuth()
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [payModal, setPayModal] = useState({ open: false, order: null, useWallet: true })
  const [pixModal, setPixModal] = useState({ open: false, order: null })
  const [feedback, setFeedback] = useState('')
  const [couponInput, setCouponInput] = useState('')
  const [couponApplied, setCouponApplied] = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)

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
  const discountBrl = couponApplied?.discount_brl ?? 0
  const totalAfterDiscountBrl = Math.max(0, totalBrl - discountBrl)
  const totalJpy = Math.round(brlToJpy(totalAfterDiscountBrl))

  const handleApplyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) {
      setFeedback('Digite um código de cupom.')
      return
    }
    setCouponLoading(true)
    setFeedback('')
    const { data, error } = await validateCoupon(code, totalBrl)
    setCouponLoading(false)
    if (error) {
      setCouponApplied(null)
      setFeedback(error.message)
      return
    }
    setCouponApplied(data)
    setFeedback('')
  }

  const handleRemoveCoupon = () => {
    setCouponApplied(null)
    setCouponInput('')
    setFeedback('')
  }

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
        null,
        couponApplied ? couponInput.trim() : null
      )
      if (error) {
        setFeedback(error.message || 'Erro ao criar pedido')
        setSubmitting(false)
        return
      }
      // Pedido criado: abre modal de pagamento (Stripe / PIX / carteira)
      setPayModal({ open: true, order, useWallet: true })
      setCouponApplied(null)
      setCouponInput('')
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
    // Mantemos o valor em JPY sem arredondar para reduzir divergências com o backend.
    const jpy = brlToJpy(totalBrl)
    return { jpy, approxBrl: totalBrl }
  }

  const getPaymentBreakdown = (order, useWallet) => {
    const charge = getOrderChargeJpy(order)
    const balance = wallet?.balance ?? 0
    const canUseWallet = balance > 0 && (wallet?.currency || 'JPY') === 'JPY'
    const totalJpy = charge?.jpy ?? 0

    // Se a carteira já foi aplicada ao pedido antes, isso vem em `order.wallet_applied_amount`.
    // Usamos esse valor para evitar que o PIX continue mostrando o valor inteiro.
    const alreadyAppliedJpy = Math.max(0, Number(order?.wallet_applied_amount) || 0)
    const remainingAfterAlreadyApplied = Math.max(0, totalJpy - alreadyAppliedJpy)

    // "Carteira aplicada" aqui é quanto vai ser aplicado (nesta intenção) somado ao que já foi aplicado.
    const walletAppliedAdditional = !!useWallet && canUseWallet ? Math.min(balance, remainingAfterAlreadyApplied) : 0
    const walletApplied = alreadyAppliedJpy + walletAppliedAdditional
    const remainingJpy = Math.max(0, totalJpy - walletApplied)

    // Evita mostrar "resto" ínfimo por diferenças de conversão/precisão.
    const EPS_JPY = 0.0001
    const remainingBrl =
      remainingJpy > EPS_JPY ? Math.round(jpyToBrl(remainingJpy) * 100) / 100 : 0
    return {
      charge,
      balance,
      canUseWallet,
      totalJpy,
      walletApplied,
      remainingJpy,
      remainingBrl,
      isFullyCovered: !!useWallet && remainingJpy <= EPS_JPY,
    }
  }

  const handlePayCard = async (forceWallet = false) => {
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
      const result = await createCheckoutSession(orderId, accessToken, { useWallet: forceWallet || !!payModal.useWallet })
      if (result?.paid) {
        setPayModal({ open: false, order: null, useWallet: true })
        setFeedback('Pagamento realizado com carteira.')
        window.location.href = '/app/meus-produtos?success=true'
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
      <PixManualModal
        open={pixModal.open}
        onClose={() => setPixModal({ open: false, order: null })}
        onBack={() => {
          if (pixModal.order) {
            setPixModal({ open: false, order: null })
            setPayModal({ open: true, order: pixModal.order, useWallet: true })
          } else {
            setPixModal({ open: false, order: null })
          }
        }}
        order={pixModal.order}
        amountBrl={pixModal.amountBrl ?? (pixModal.order?.total_amount ? Number(pixModal.order.total_amount) : null)}
        userId={user?.id}
      />
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Carrinho</h1>
        <p className="mt-2 text-earth-600">
          Revise seus itens e finalize a compra. Os produtos irão para Meus Produtos; solicite o envio quando quiser.
        </p>

        {feedback && !payModal.open && !pixModal.open && (
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

            <div className="rounded-xl border border-earth-200 bg-earth-50 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="text-sm font-medium text-earth-700">Cupom de desconto</label>
                <div className="flex gap-2 flex-1">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                    placeholder="Digite o código"
                    disabled={!!couponApplied}
                    className="flex-1 min-w-0 rounded-lg border border-earth-300 px-3 py-2 text-earth-900 placeholder:text-earth-400 focus:border-earth-500 focus:outline-none focus:ring-1 focus:ring-earth-500 disabled:bg-earth-100 disabled:cursor-not-allowed"
                  />
                  {couponApplied ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="shrink-0 rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                    >
                      Remover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="shrink-0 rounded-lg border border-earth-300 bg-white px-4 py-2 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                    >
                      {couponLoading ? '...' : 'Aplicar'}
                    </button>
                  )}
                </div>
              </div>
              {couponApplied && (
                <p className="text-sm text-green-700 font-medium">
                  Cupom {couponApplied.code} aplicado! Desconto: -{formatBRL(couponApplied.discount_brl)}
                </p>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-earth-200">
                <div>
                  <p className="text-xl font-bold text-earth-900">Total: {formatJPY(totalJpy)}</p>
                  <p className="text-sm text-earth-600">Aprox.: {formatBRL(jpyToBrl(totalJpy))}</p>
                  {discountBrl > 0 && (
                    <p className="text-sm text-green-600 mt-0.5">Subtotal {formatBRL(totalBrl)} − desconto {formatBRL(discountBrl)}</p>
                  )}
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
          </div>
        )}
      </div>

      

      {payModal.open && payModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 relative">
          {feedback && (
            <div className="absolute inset-0 z-[80] flex items-center justify-center pointer-events-none">
              <p
                className={`rounded-lg px-4 py-2 text-sm ${
                  feedback.includes('Erro') || feedback.includes('erro')
                    ? 'bg-red-100 text-red-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {feedback}
              </p>
            </div>
          )}
          <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-xl bg-white shadow-lg">
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <h3 className="font-semibold text-earth-900">Pagamento</h3>
              <p className="mt-1 text-sm text-earth-600">Escolha a forma de pagamento.</p>

              {(() => {
                const {
                  charge,
                  balance,
                  canUseWallet,
                  totalJpy,
                  walletApplied,
                  remainingJpy,
                } = getPaymentBreakdown(payModal.order, payModal.useWallet)
                const useWallet = !!payModal.useWallet && canUseWallet

                return (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-lg border border-earth-200 bg-earth-50 p-4 space-y-2">
                      {charge && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-earth-600">Subtotal</span>
                            <span className="font-medium text-earth-900">{formatJPY(totalJpy)}</span>
                          </div>
                          {useWallet && walletApplied > 0 && (
                            <div className="flex justify-between text-sm text-green-700">
                              <span>Carteira aplicada</span>
                              <span>-{formatJPY(walletApplied)}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-earth-200 font-medium">
                            <span className="text-earth-800">Total a pagar</span>
                            <span className="text-earth-900">{formatJPY(remainingJpy)}</span>
                          </div>
                          <p className="text-xs text-earth-500 mt-1">
                            Aprox. em BRL: {formatBRL(remainingJpy > 0 ? jpyToBrl(remainingJpy) : 0)}
                          </p>
                        </>
                      )}
                    </div>

                    <label
                      className={`flex items-start gap-3 rounded-lg border p-4 ${
                        canUseWallet ? 'border-earth-200 bg-white cursor-pointer' : 'border-earth-100 bg-earth-50 opacity-70'
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
                          Saldo disponível: {formatJPY(balance)}
                        </p>
                      </div>
                    </label>
                  </div>
                )
              })()}
            </div>

            <div className="shrink-0 border-t border-earth-200 bg-earth-50 p-4">
              {(() => {
                const { isFullyCovered, remainingBrl } = getPaymentBreakdown(payModal.order, payModal.useWallet)

                return (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handlePayCard(!!payModal.useWallet)}
                        disabled={submitting}
                        className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                      >
                        Cartão
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isFullyCovered) {
                            handlePayCard(true)
                            return
                          }
                          setPayModal((m) => ({ ...m, open: false }))
                          setPixModal({ open: true, order: payModal.order, amountBrl: remainingBrl })
                        }}
                        disabled={submitting}
                        className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
                      >
                        PIX
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handlePayCard(isFullyCovered ? true : !!payModal.useWallet)}
                        disabled={submitting}
                        className="flex-1 min-w-0 rounded-lg bg-earth-900 px-6 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                      >
                        {submitting ? 'Processando...' : 'Finalizar compra'}
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
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Cart

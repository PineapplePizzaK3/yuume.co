/**
 * Carrinho - Checkout da loja virtual.
 * Usuário pode escolher envio imediato (paga produtos + frete depois) ou armazenamento (paga produtos e vai pro inventário).
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getCart, updateCartItem, removeFromCart, createStoreOrder } from '../../services/cartService'
import { createCheckoutSession } from '../../services/paymentService'
import { brlToJpy, formatBRL, formatJPY, jpyToBrl } from '../../lib/fx'
import { calcularFreteEMS } from '../../data/tabelaFreteEMS'

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
  const [shipImmediately, setShipImmediately] = useState(null)
  const [freightModalOpen, setFreightModalOpen] = useState(false)
  const [freightConfirmed, setFreightConfirmed] = useState(false)
  const [freightCostJpy, setFreightCostJpy] = useState(null)
  const [freightWeightG, setFreightWeightG] = useState(0)
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
    if (success) setFeedback('Compra realizada com sucesso! Os produtos estão em Meus Produtos.')
    if (canceled) setFeedback('Pagamento cancelado.')
  }, [success, canceled])

  const totalBrl = items.reduce((sum, i) => sum + (Number(i.products?.price ?? 0) * (i.quantity || 1)), 0)
  const totalJpy = Math.round(brlToJpy(totalBrl))

  const handleUpdateQty = async (productId, quantity) => {
    const qty = Math.max(1, Math.min(99, Number(quantity) || 1))
    const { error } = await updateCartItem(user.id, productId, qty)
    if (error) setFeedback(error.message)
    else loadCart()
  }

  const handleRemove = async (productId) => {
    const { error } = await removeFromCart(user.id, productId)
    if (error) setFeedback(error.message)
    else loadCart()
  }

  const computeFreight = () => {
    const totalWeightG = items.reduce((acc, i) => {
      const p = i.products
      const weightKg = Number(p?.weight_kg ?? 0)
      const qty = Number(i.quantity || 1)
      return acc + weightKg * 1000 * qty
    }, 0)

    if (!totalWeightG || totalWeightG <= 0) {
      return { ok: false, error: 'Para calcular o frete, informe o peso (kg) de todos os produtos.' }
    }

    const costJpy = calcularFreteEMS(totalWeightG)
    if (!costJpy || costJpy <= 0) {
      return { ok: false, error: 'Não foi possível calcular o frete com base no peso informado.' }
    }

    return {
      ok: true,
      totalWeightG,
      costJpy,
    }
  }

  const handleCheckout = async () => {
    if (shipImmediately === null) {
      setFeedback('Escolha se deseja envio imediato ou armazenamento.')
      return
    }
    if (items.length === 0) {
      setFeedback('Carrinho vazio.')
      return
    }
    if (shipImmediately === true && !freightConfirmed) {
      // Mostra o painel de frete caso ainda não tenha confirmado.
      setFreightModalOpen(true)
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      const { data: order, error } = await createStoreOrder(
        user.id,
        shipImmediately,
        shipImmediately === true ? freightCostJpy : null
      )
      if (error) {
        setFeedback(error.message || 'Erro ao criar pedido')
        setSubmitting(false)
        return
      }
      const accessToken = session?.access_token
      if (!accessToken) {
        setFeedback('Faça login novamente para continuar.')
        setSubmitting(false)
        return
      }
      const { url } = await createCheckoutSession(order.id, accessToken)
      if (url) window.location.href = url
      else setFeedback('Erro ao redirecionar para pagamento.')
    } catch (e) {
      setFeedback(e?.message || 'Erro ao processar')
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
          Revise seus itens e finalize a compra. Escolha se deseja envio imediato ou armazenar para enviar depois.
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

            <div className="rounded-xl border border-earth-200 bg-white p-6">
              <h3 className="font-semibold text-earth-900">Envio</h3>
              <p className="mt-1 text-sm text-earth-600">
                Deseja que enviamos imediatamente após a compra? Caso não, os produtos vão para sua conta e você pode solicitar o envio quando quiser.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition ${shipImmediately === false ? 'border-earth-900 bg-earth-50' : 'border-earth-200'}`}>
                  <input
                    type="radio"
                    name="ship"
                    checked={shipImmediately === false}
                    onChange={() => {
                      setShipImmediately(false)
                      setFreightModalOpen(false)
                      setFreightConfirmed(false)
                      setFreightCostJpy(null)
                      setFreightWeightG(0)
                    }}
                    className="mt-1 border-earth-300"
                  />
                  <div>
                    <span className="block font-medium text-earth-900">Armazenar</span>
                    <span className="text-sm text-earth-600">Produtos vão para Meus Produtos. Solicite o envio quando quiser.</span>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition ${shipImmediately === true ? 'border-earth-900 bg-earth-50' : 'border-earth-200'}`}>
                  <input
                    type="radio"
                    name="ship"
                    checked={shipImmediately === true}
                    onChange={() => {
                      const res = computeFreight()
                      if (!res.ok) {
                        setFeedback(res.error)
                        setShipImmediately(false)
                        setFreightModalOpen(false)
                        setFreightConfirmed(false)
                        setFreightCostJpy(null)
                        setFreightWeightG(0)
                        return
                      }
                      setShipImmediately(true)
                      setFreightCostJpy(res.costJpy)
                      setFreightWeightG(res.totalWeightG)
                      setFreightConfirmed(false)
                      setFreightModalOpen(true)
                    }}
                    className="mt-1 border-earth-300"
                  />
                  <div>
                    <span className="block font-medium text-earth-900">Envio imediato</span>
                    <span className="text-sm text-earth-600">
                      Frete estimado calculado por peso (EMS). Você paga o frete depois, após os produtos serem pagos.
                    </span>
                  </div>
                </label>
              </div>
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

      {freightModalOpen && shipImmediately === true && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="font-semibold text-earth-900">Frete (estimativa)</h3>
            <p className="mt-1 text-sm text-earth-600">
              Calculado pelo peso total dos itens (tabela EMS).
            </p>

            <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-4">
              <p className="text-sm text-earth-700">
                Peso total: <span className="font-medium text-earth-900">{Math.round(freightWeightG)}g</span>
              </p>
              <p className="mt-2 text-lg font-semibold text-earth-900">
                Frete estimado: {freightCostJpy != null ? formatJPY(freightCostJpy) : '—'}
              </p>
              {freightCostJpy != null && (
                <p className="mt-1 text-xs text-earth-600">
                  Aproximado em BRL: {formatBRL(jpyToBrl(freightCostJpy))}
                </p>
              )}
              <p className="mt-2 text-xs text-earth-500">
                Este valor é uma estimativa. O valor real pode variar após consolidação do pedido.
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFreightModalOpen(false)
                  setFreightConfirmed(true)
                }}
                className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800"
              >
                Confirmar e continuar
              </button>
              <button
                type="button"
                onClick={() => {
                  setFreightModalOpen(false)
                  setFreightConfirmed(false)
                  setShipImmediately(false)
                  setFreightCostJpy(null)
                  setFreightWeightG(0)
                }}
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Trocar para Armazenar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

import { useState } from 'react'
import { getUsersAdmin } from '../../../../services/profileService'
import {
  createOrderForUserAdmin,
  setQuoteAdmin,
  updateOrderAdmin,
} from '../../../../services/orderService'
import { logAdminAction } from '../../../../services/logService'
import { serializeQuoteProducts } from '../../../../lib/quoteProducts'
import { useAdminContext } from '../AdminContext'
import AdminQuoteProductsForm, { EMPTY_QUOTE_PRODUCT } from './AdminQuoteProductsForm'

const SERVICE_KIND_PERSONAL = 'personal_shopping'
const SERVICE_KIND_ASSISTED = 'assisted_buy'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeQuoteProducts(products) {
  return products
    .map((p) => ({
      ...p,
      valor: parseFloat(p.valor) || 0,
      quantidade: Math.max(1, parseInt(p.quantidade, 10) || 1),
    }))
    .filter((p) => (p.name?.trim() || p.descricao?.trim()) && p.valor > 0)
}

async function resolveUserId(raw) {
  const term = String(raw || '').trim()
  if (!term) return { userId: null, error: { message: 'Informe o usuário.' } }

  if (UUID_RE.test(term)) {
    return { userId: term, error: null }
  }

  const { data, error } = await getUsersAdmin(2000, 0)
  if (error) return { userId: null, error }
  const list = data ?? []
  const lower = term.toLowerCase()

  const byEmail = list.filter((u) => String(u.email || '').toLowerCase() === lower)
  if (byEmail.length === 1) return { userId: byEmail[0].id, error: null }
  if (byEmail.length > 1) {
    return { userId: null, error: { message: 'Mais de um usuário com esse e-mail. Use o ID.' } }
  }

  const byCode = list.filter((u) => String(u.account_code || '').toLowerCase() === lower)
  if (byCode.length === 1) return { userId: byCode[0].id, error: null }
  if (byCode.length > 1) {
    return { userId: null, error: { message: 'Mais de um usuário com esse código. Use o ID.' } }
  }

  return {
    userId: null,
    error: { message: 'Usuário não encontrado. Use e-mail, código da conta (ex: ED0001) ou ID.' },
  }
}

export default function OrcamentosSection() {
  const { activeTab, services, setMessage, loadOrders } = useAdminContext()
  const [submitting, setSubmitting] = useState(false)
  const [userRef, setUserRef] = useState('')
  const [serviceKind, setServiceKind] = useState(SERVICE_KIND_PERSONAL)
  const [orderDescription, setOrderDescription] = useState('')
  const [products, setProducts] = useState([{ ...EMPTY_QUOTE_PRODUCT }])

  if (activeTab !== 'orcamentos') return null

  const personalShopping = services.find((s) => s.name === 'Personal Shopping')
  const redirecionamento = services.find((s) => s.name === 'Redirecionamento')

  const resetForm = () => {
    setUserRef('')
    setServiceKind(SERVICE_KIND_PERSONAL)
    setOrderDescription('')
    setProducts([{ ...EMPTY_QUOTE_PRODUCT }])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validProducts = normalizeQuoteProducts(products)
    if (validProducts.length === 0) {
      setMessage('Adicione ao menos um produto com nome ou descrição e valor.')
      return
    }

    const isAssisted = serviceKind === SERVICE_KIND_ASSISTED
    const serviceId = isAssisted ? redirecionamento?.id : personalShopping?.id
    if (!serviceId) {
      setMessage(
        isAssisted
          ? 'Serviço Redirecionamento não encontrado.'
          : 'Serviço Personal Shopping não encontrado.'
      )
      return
    }

    const total = validProducts.reduce((s, p) => s + p.valor * p.quantidade, 0)
    const message = serializeQuoteProducts(validProducts, orderDescription)

    setSubmitting(true)
    setMessage('')
    try {
      const { userId: uid, error: resolveError } = await resolveUserId(userRef)
      if (resolveError || !uid) {
        setMessage(resolveError?.message || 'Usuário não encontrado.')
        return
      }

      const { data: created, error: createError } = await createOrderForUserAdmin(uid, {
        service_id: serviceId,
        message: orderDescription.trim() || null,
      })
      if (createError) {
        setMessage(createError.message)
        return
      }
      const orderId = created?.id
      if (!orderId) {
        setMessage('Pedido criado, mas ID não retornou. Defina o orçamento em Pedidos.')
        return
      }

      if (isAssisted) {
        const { error: moduleError } = await updateOrderAdmin(orderId, {
          order_module: 'assisted_buy',
        })
        if (moduleError) {
          setMessage(moduleError.message)
          return
        }
      }

      const { error: quoteError } = await setQuoteAdmin(orderId, total, 'JPY', message)
      if (quoteError) {
        setMessage(quoteError.message)
        return
      }

      logAdminAction('order_manual_quote', 'order', orderId, {
        total,
        currency: 'JPY',
        productsCount: validProducts.length,
        serviceKind,
        user_id: uid,
        user_ref: userRef.trim(),
      })
      setMessage('Orçamento criado. Cliente pode pagar em Pedidos.')
      resetForm()
      if (typeof loadOrders === 'function') loadOrders()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Orçamentos</h2>
      <p className="mt-1 text-sm text-earth-600">
        Crie um orçamento manualmente para um usuário. O pedido fica aguardando pagamento.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-4 rounded-xl border border-earth-200 bg-white p-6">
        <div>
          <label htmlFor="orcamento-user-ref" className="block text-sm font-medium text-earth-700">
            Usuário
          </label>
          <input
            id="orcamento-user-ref"
            type="text"
            required
            value={userRef}
            onChange={(e) => setUserRef(e.target.value)}
            placeholder="E-mail, código da conta (ex: ED0001) ou ID"
            className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-earth-500">
            Digite o e-mail, o código da conta ou o ID do usuário.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-earth-700">Tipo de serviço</label>
          <select
            value={serviceKind}
            onChange={(e) => setServiceKind(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
          >
            <option value={SERVICE_KIND_PERSONAL}>Personal Shopping</option>
            <option value={SERVICE_KIND_ASSISTED}>Redirecionamento · Assistido</option>
          </select>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-earth-700">Itens do orçamento</p>
          <AdminQuoteProductsForm
            orderDescription={orderDescription}
            onOrderDescriptionChange={setOrderDescription}
            products={products}
            onProductsChange={setProducts}
            showLink
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {submitting ? 'Criando...' : 'Criar orçamento'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            disabled={submitting}
            className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
          >
            Limpar
          </button>
        </div>
      </form>
    </section>
  )
}

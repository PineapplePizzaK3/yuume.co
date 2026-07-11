import { useEffect, useMemo, useState } from 'react'
import { scrapeProductUrl } from '../../../../services/wishlistLinkService'
import { brlToJpy } from '../../../../lib/fx'
import {
  PERSONAL_SHOPPING_FEE_PERCENT,
  REDIR_ASSISTIDO_FEE_PERCENT,
} from '../../../../data/serviceFees'
import { useAdminContext } from '../AdminContext'
import AdminQuoteProductsForm, { EMPTY_QUOTE_PRODUCT } from './AdminQuoteProductsForm'

const SERVICE_KIND_PERSONAL = 'personal_shopping'
const SERVICE_KIND_ASSISTED = 'assisted_buy'
const LOCAL_QUOTES_KEY = 'admin_orcamentos_local_v1'

function normalizeQuoteProducts(products) {
  return products
    .map((p) => ({
      ...p,
      valor: parseFloat(p.valor) || 0,
      quantidade: Math.max(1, parseInt(p.quantidade, 10) || 1),
    }))
    .filter((p) => (p.name?.trim() || p.descricao?.trim()) && p.valor > 0)
}

function getServicePercent(serviceKind) {
  return serviceKind === SERVICE_KIND_ASSISTED ? REDIR_ASSISTIDO_FEE_PERCENT : PERSONAL_SHOPPING_FEE_PERCENT
}

function getServiceLabel(serviceKind) {
  return serviceKind === SERVICE_KIND_ASSISTED ? 'Redirecionamento · Assistido' : 'Personal Shopping'
}

function calculateQuoteTotals(products, serviceKind) {
  const baseTotal = products.reduce((s, p) => s + (Number(p.valor) || 0) * (Math.max(1, parseInt(p.quantidade, 10) || 1)), 0)
  const servicePercent = getServicePercent(serviceKind)
  const serviceFee = Math.round(baseTotal * (servicePercent / 100))
  return { baseTotal, servicePercent, serviceFee, total: baseTotal + serviceFee }
}

function formatJpy(value) {
  return `¥${Math.round(Number(value) || 0).toLocaleString('pt-BR')}`
}

export default function OrcamentosSection() {
  const { activeTab, setMessage } = useAdminContext()
  const [submitting, setSubmitting] = useState(false)
  const [userRef, setUserRef] = useState('')
  const [serviceKind, setServiceKind] = useState(SERVICE_KIND_PERSONAL)
  const [orderDescription, setOrderDescription] = useState('')
  const [products, setProducts] = useState([{ ...EMPTY_QUOTE_PRODUCT }])
  const [quotes, setQuotes] = useState([])
  const [scrapingProductIndex, setScrapingProductIndex] = useState(null)
  const [scrapeFeedbackByIndex, setScrapeFeedbackByIndex] = useState({})

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_QUOTES_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) setQuotes(parsed)
    } catch {
      // ignore local cache errors
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(quotes))
    } catch {
      // ignore local cache errors
    }
  }, [quotes])

  const currentProducts = useMemo(() => normalizeQuoteProducts(products), [products])
  const currentTotals = useMemo(() => calculateQuoteTotals(currentProducts, serviceKind), [currentProducts, serviceKind])

  if (activeTab !== 'orcamentos') return null

  const resetForm = () => {
    setUserRef('')
    setServiceKind(SERVICE_KIND_PERSONAL)
    setOrderDescription('')
    setProducts([{ ...EMPTY_QUOTE_PRODUCT }])
    setScrapeFeedbackByIndex({})
  }

  const handleScrapeProduct = async (idx) => {
    const url = String(products[idx]?.link || '').trim()
    if (!/^https?:\/\//i.test(url)) {
      setScrapeFeedbackByIndex((prev) => ({ ...prev, [idx]: 'Use uma URL completa começando com http:// ou https://' }))
      return
    }

    setScrapingProductIndex(idx)
    setScrapeFeedbackByIndex((prev) => ({ ...prev, [idx]: '' }))
    try {
      const { data, error } = await scrapeProductUrl(url)
      if (error) {
        const detail = error?.failureCode ? ` (código: ${error.failureCode})` : ''
        setScrapeFeedbackByIndex((prev) => ({
          ...prev,
          [idx]: (error.message || 'Não foi possível extrair dados do produto.') + detail,
        }))
        return
      }

      const rawPrice = Number(data?.price)
      const currency = String(data?.currency || 'JPY').toUpperCase()
      const priceJpy = Number.isFinite(rawPrice)
        ? Math.round(currency === 'BRL' ? brlToJpy(rawPrice) : rawPrice)
        : ''
      setProducts((prev) =>
        prev.map((item, i) =>
          i === idx
            ? {
                ...item,
                name: data?.name || item.name,
                valor: priceJpy || item.valor,
                link: url,
              }
            : item
        )
      )
      const confidencePct = Math.round((Number(data?.meta?.confidence) || 0) * 100)
      setScrapeFeedbackByIndex((prev) => ({
        ...prev,
        [idx]: `Dados preenchidos via link (${confidencePct}% de confiança).`,
      }))
    } catch (e) {
      setScrapeFeedbackByIndex((prev) => ({ ...prev, [idx]: e?.message || 'Erro ao buscar dados do produto.' }))
    } finally {
      setScrapingProductIndex(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validProducts = normalizeQuoteProducts(products)
    if (validProducts.length === 0) {
      setMessage('Adicione ao menos um produto com nome ou descrição e valor.')
      return
    }

    setSubmitting(true)
    setMessage('')
    try {
      const totals = calculateQuoteTotals(validProducts, serviceKind)
      const quote = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        userLabel: userRef.trim(),
        serviceKind,
        serviceLabel: getServiceLabel(serviceKind),
        orderDescription: orderDescription.trim(),
        products: validProducts,
        ...totals,
      }
      setQuotes((prev) => [quote, ...prev])
      setMessage('Orçamento criado somente nesta aba. Nenhum pedido foi gerado no sistema.')
      resetForm()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Orçamentos</h2>
      <p className="mt-1 text-sm text-earth-600">
        Crie orçamentos manuais separados do fluxo de pedidos. Eles ficam disponíveis apenas nesta aba.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-4 rounded-xl border border-earth-200 bg-white p-6">
        <div>
          <label htmlFor="orcamento-user-ref" className="block text-sm font-medium text-earth-700">
            Cliente / referência
          </label>
          <input
            id="orcamento-user-ref"
            type="text"
            value={userRef}
            onChange={(e) => setUserRef(e.target.value)}
            placeholder="Nome, e-mail, WhatsApp ou referência interna"
            className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-earth-500">
            Campo livre só para identificação na interface. Não vincula a nenhum usuário da plataforma.
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
            onScrapeProduct={handleScrapeProduct}
            scrapingProductIndex={scrapingProductIndex}
            scrapeFeedbackByIndex={scrapeFeedbackByIndex}
          />
        </div>

        {currentProducts.length > 0 && (
          <div className="rounded-lg border border-earth-200 bg-earth-50 p-3 text-sm text-earth-700">
            <div className="flex justify-between gap-3">
              <span>Produtos</span>
              <strong>{formatJpy(currentTotals.baseTotal)}</strong>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span>Taxa de serviço ({currentTotals.servicePercent}%)</span>
              <strong>{formatJpy(currentTotals.serviceFee)}</strong>
            </div>
            <div className="mt-2 flex justify-between gap-3 border-t border-earth-200 pt-2 text-earth-900">
              <span>Total</span>
              <strong>{formatJpy(currentTotals.total)}</strong>
            </div>
          </div>
        )}

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

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-earth-600">Orçamentos criados nesta aba</h3>
        {quotes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-earth-300 bg-white p-4 text-sm text-earth-500">
            Nenhum orçamento criado nesta sessão.
          </p>
        ) : (
          quotes.map((quote) => (
            <div key={quote.id} className="rounded-xl border border-earth-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-earth-900">
                    {quote.userLabel || 'Sem cliente informado'} · {quote.serviceLabel}
                  </p>
                  <p className="mt-1 text-xs text-earth-500">
                    {quote.createdAt ? new Date(quote.createdAt).toLocaleString('pt-BR') : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuotes((prev) => prev.filter((item) => item.id !== quote.id))}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Remover
                </button>
              </div>
              {quote.orderDescription && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-earth-600">{quote.orderDescription}</p>
              )}
              <ul className="mt-3 space-y-2">
                {quote.products.map((product, idx) => {
                  const qty = Math.max(1, parseInt(product.quantidade, 10) || 1)
                  const unit = Number(product.valor) || 0
                  return (
                    <li key={`${quote.id}-${idx}`} className="rounded-lg bg-earth-50 p-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium text-earth-800">
                          {product.name || `Produto ${idx + 1}`} {qty > 1 ? `× ${qty}` : ''}
                        </span>
                        <span className="font-medium text-earth-800">{formatJpy(unit * qty)}</span>
                      </div>
                      {product.link && (
                        <a
                          href={product.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block break-all text-xs font-medium text-earth-700 underline hover:text-earth-900"
                        >
                          {product.link}
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
              <div className="mt-3 border-t border-earth-200 pt-3 text-sm text-earth-700">
                <div className="flex justify-between gap-3">
                  <span>Produtos</span>
                  <span>{formatJpy(quote.baseTotal)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-3">
                  <span>Taxa de serviço ({quote.servicePercent}%)</span>
                  <span>{formatJpy(quote.serviceFee)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-3 border-t border-earth-900 pt-2 font-semibold text-earth-900">
                  <span>Total</span>
                  <span>{formatJpy(quote.total)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

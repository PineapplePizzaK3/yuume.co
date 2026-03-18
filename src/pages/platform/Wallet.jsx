/**
 * Carteira virtual - Saldo e extrato.
 * O saldo pode ser usado para pagar frete, itens da loja e serviços.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { getWallet, getWalletTransactions } from '../../services/walletService'
import { createTopUpCheckoutSession } from '../../services/paymentService'
import { cacheKey, readCache, writeCache } from '../../lib/cache'

function formatMoney(value, currency = 'BRL') {
  return Number(value)?.toLocaleString('pt-BR', { style: 'currency', currency }) ?? '—'
}

const TYPE_LABELS = {
  topup: 'Adição de saldo',
  refund: 'Reembolso',
  order_shipping: 'Pagamento de frete',
  order_service: 'Serviço',
  loja: 'Loja virtual',
  adjustment: 'Ajuste',
}

export default function Wallet() {
  const { user, session } = useAuth()
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [topUpAmount, setTopUpAmount] = useState('50')
  const [adding, setAdding] = useState(false)
  const [feedback, setFeedback] = useState('')

  const loadData = async (active) => {
    if (!user?.id) return
    const k = cacheKey(user.id, 'wallet_page_v1')
    const cached = readCache(k, 1000 * 60 * 30)
    if (cached && active()) {
      setWallet(cached.wallet ?? null)
      setTransactions(cached.transactions ?? [])
      setLoading(false)
    }
    try {
      const [wRes, tRes] = await Promise.all([
        getWallet(user.id),
        getWalletTransactions(user.id),
      ])
      if (!active()) return
      setWallet(wRes.data)
      setTransactions(tRes.data ?? [])
      writeCache(k, { wallet: wRes.data ?? null, transactions: tRes.data ?? [] })
      if (wRes.error) setFeedback(wRes.error.message)
      if (tRes.error && !wRes.error) setFeedback(tRes.error.message)
    } catch (e) {
      if (active()) setFeedback(e?.message || 'Erro ao carregar carteira')
    } finally {
      if (active()) setLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true
    loadData(() => isActive)
    return () => { isActive = false }
  }, [user?.id])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setFeedback('Saldo adicionado com sucesso!')
      window.history.replaceState({}, '', '/app/wallet')
      loadData(() => true)
    }
    if (params.get('canceled') === 'true') {
      setFeedback('Adição de saldo cancelada.')
      window.history.replaceState({}, '', '/app/wallet')
    }
  }, [])

  const handleAddFunds = async (e) => {
    e.preventDefault()
    const value = parseFloat(topUpAmount?.replace(',', '.'))
    if (!value || value < 5 || value > 5000) {
      setFeedback('Informe um valor entre R$ 5,00 e R$ 5.000,00')
      return
    }
    const amountCents = Math.round(value * 100)
    setAdding(true)
    setFeedback('')
    try {
      const accessToken = session?.access_token
      if (!accessToken) {
        setFeedback('Faça login novamente')
        setAdding(false)
        return
      }
      const { url } = await createTopUpCheckoutSession(amountCents, accessToken)
      if (url) window.location.href = url
      else setFeedback('Erro ao abrir pagamento')
    } catch (err) {
      setFeedback(err.message || 'Erro ao adicionar saldo')
    } finally {
      setAdding(false)
    }
  }

  const presets = [50, 100, 200, 500]

  return (
    <>
      <Helmet>
        <title>Carteira | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Carteira</h1>
        <p className="mt-2 text-earth-600">
          Seu saldo pode ser usado para pagar frete, itens da loja e serviços.
        </p>

        {feedback && (
          <p
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              feedback.includes('sucesso')
                ? 'bg-green-100 text-green-800'
                : feedback.includes('cancelada')
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">Carregando...</p>}

        {!loading && (
          <>
            <div className="mt-6 rounded-xl border border-earth-200 bg-earth-50 p-6">
              <p className="text-sm font-medium text-earth-600">Saldo disponível</p>
              <p className="mt-1 text-3xl font-bold text-earth-900">
                {formatMoney(wallet?.balance ?? 0, wallet?.currency ?? 'BRL')}
              </p>

              <form onSubmit={handleAddFunds} className="mt-6">
                <label className="block text-sm font-medium text-earth-700">Adicionar saldo</label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTopUpAmount(String(p))}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                        topUpAmount === String(p)
                          ? 'border-earth-900 bg-earth-900 text-white'
                          : 'border-earth-300 text-earth-700 hover:bg-earth-100'
                      }`}
                    >
                      R$ {p}
                    </button>
                  ))}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value.replace(/[^0-9,.]/g, ''))}
                    placeholder="Outro valor"
                    className="w-28 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                  <span className="text-sm text-earth-500">mín. R$ 5 — máx. R$ 5.000</span>
                </div>
                <button
                  type="submit"
                  disabled={adding}
                  className="mt-4 rounded-lg bg-earth-900 px-5 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                >
                  {adding ? 'Abrindo pagamento...' : 'Adicionar saldo (cartão)'}
                </button>
              </form>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold text-earth-900">Extrato</h2>
              {transactions.length === 0 ? (
                <p className="mt-2 text-sm text-earth-600">Nenhuma movimentação ainda.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {transactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-earth-200 bg-white px-4 py-3"
                    >
                      <div>
                        <span className="font-medium text-earth-900">
                          {TYPE_LABELS[tx.type] ?? tx.type}
                        </span>
                        {tx.description && (
                          <p className="text-sm text-earth-500">{tx.description}</p>
                        )}
                        <p className="text-xs text-earth-400">
                          {tx.created_at
                            ? new Date(tx.created_at).toLocaleString('pt-BR')
                            : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={tx.kind === 'credit' ? 'text-green-700' : 'text-earth-900'}>
                          {tx.kind === 'credit' ? '+' : ''}
                          {formatMoney(tx.amount, 'BRL')}
                        </span>
                        {tx.balance_after != null && (
                          <p className="text-xs text-earth-500">
                            Saldo: {formatMoney(tx.balance_after, 'BRL')}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

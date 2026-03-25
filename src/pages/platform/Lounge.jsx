import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { getWallet, getWalletTransactions } from '../../services/walletService'
import { formatJPY } from '../../lib/fx'
import MeusProdutos from './MeusProdutos'
import Envios from './Envios'
import Orders from './Orders'

const LOUNGE_MODULES = [
  { id: 'produtos', label: 'Meus Produtos' },
  { id: 'envios', label: 'Envios' },
  { id: 'pedidos', label: 'Pedidos' },
]

export default function Lounge() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loadingWallet, setLoadingWallet] = useState(true)
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [activeModule, setActiveModule] = useState('produtos')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id) return
      setLoadingWallet(true)
      try {
        const [walletRes, txRes] = await Promise.all([
          getWallet(user.id),
          getWalletTransactions(user.id),
        ])
        if (!isActive) return
        setWallet(walletRes.data ?? null)
        setTransactions(txRes.data ?? [])
        if (walletRes.error || txRes.error) {
          setFeedback(walletRes.error?.message || txRes.error?.message || '')
        }
      } catch (e) {
        if (isActive) setFeedback(e?.message || 'Erro ao carregar lounge')
      } finally {
        if (isActive) setLoadingWallet(false)
      }
    }
    run()
    return () => { isActive = false }
  }, [user?.id])

  return (
    <>
      <Helmet>
        <title>Lounge | Plataforma</title>
      </Helmet>
      <div>
        <h1 className="text-2xl font-bold text-earth-900">Lounge</h1>
        <p className="mt-2 text-earth-600">
          Central de Pedidos, Envios e Meus Produtos com todas as funções completas.
        </p>

        {feedback && (
          <p className="mt-4 rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800">{feedback}</p>
        )}

        <section className="mt-6 rounded-xl border border-earth-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-earth-100 text-lg" aria-hidden>
                ¥
              </div>
              <div className="min-w-0">
                <p className="text-xs text-earth-500">Carteira</p>
                {loadingWallet ? (
                  <p className="text-sm text-earth-500">Carregando...</p>
                ) : (
                  <p className="truncate text-xl font-bold text-earth-900">{formatJPY(wallet?.balance ?? 0)}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-earth-500">
              {transactions.length > 0 ? `${transactions.length} movimentações` : 'Sem movimentações'}
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-earth-200 bg-earth-50 p-3">
          <div className="flex flex-wrap gap-2">
            {LOUNGE_MODULES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveModule(m.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  activeModule === m.id
                    ? 'bg-earth-900 text-white'
                    : 'bg-white text-earth-700 hover:bg-earth-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4">
          {activeModule === 'produtos' && <MeusProdutos />}
          {activeModule === 'envios' && <Envios />}
          {activeModule === 'pedidos' && <Orders />}
        </section>
      </div>
    </>
  )
}


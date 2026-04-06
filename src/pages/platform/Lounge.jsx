import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { PageSeo } from '../../components/PageSeo'
import { useAuth } from '../../hooks/useAuth'
import { useFormatPrice } from '../../hooks/useFormatPrice'
import { getWallet, getWalletTransactions } from '../../services/walletService'
import MeusProdutos from './MeusProdutos'
import Envios from './Envios'
import Orders from './Orders'
import ListaDesejos from './ListaDesejos'

const LOUNGE_TAB_ORDER_STORAGE_KEY = 'lounge_tabs_order_v1'
const LOUNGE_MODULE_IDS = ['produtos', 'envios', 'pedidos', 'desejos']

export default function Lounge() {
  const { t } = useTranslation()
  const fp = useFormatPrice()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [loadingWallet, setLoadingWallet] = useState(true)
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const initialTab = searchParams.get('tab')
  const initialModule = LOUNGE_MODULE_IDS.includes(initialTab) ? initialTab : 'produtos'
  const [activeModule, setActiveModule] = useState(initialModule)
  const [draggingTabId, setDraggingTabId] = useState('')
  const [tabOrder, setTabOrder] = useState([...LOUNGE_MODULE_IDS])
  const [feedback, setFeedback] = useState('')

  const tabLabel = useMemo(
    () => ({
      produtos: t('platform.lounge.tabProdutos'),
      envios: t('platform.lounge.tabEnvios'),
      pedidos: t('platform.lounge.tabPedidos'),
      desejos: t('platform.lounge.tabDesejos'),
    }),
    [t]
  )

  const normalizeTabOrder = (raw) => {
    const allowed = [...LOUNGE_MODULE_IDS]
    const base = Array.isArray(raw) ? raw : []
    const safe = base.filter((id) => allowed.includes(id))
    for (const id of allowed) {
      if (!safe.includes(id)) safe.push(id)
    }
    return safe
  }

  const orderedModules = normalizeTabOrder(tabOrder)

  const handleTabReorder = (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return
    setTabOrder((prev) => {
      const current = normalizeTabOrder(prev)
      const draggedIndex = current.indexOf(draggedId)
      const targetIndex = current.indexOf(targetId)
      if (draggedIndex < 0 || targetIndex < 0) return current
      current.splice(draggedIndex, 1)
      current.splice(targetIndex, 0, draggedId)
      return current
    })
  }

  useEffect(() => {
    const tab = searchParams.get('tab')
    const moduleId = LOUNGE_MODULE_IDS.includes(tab) ? tab : 'produtos'
    if (moduleId !== activeModule) setActiveModule(moduleId)
  }, [searchParams, activeModule])

  useEffect(() => {
    if (!user?.id) {
      setTabOrder([...LOUNGE_MODULE_IDS])
      return
    }
    try {
      const raw = localStorage.getItem(LOUNGE_TAB_ORDER_STORAGE_KEY)
      if (!raw) {
        setTabOrder([...LOUNGE_MODULE_IDS])
        return
      }
      const all = JSON.parse(raw)
      setTabOrder(normalizeTabOrder(all?.[user.id]))
    } catch {
      setTabOrder([...LOUNGE_MODULE_IDS])
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(LOUNGE_TAB_ORDER_STORAGE_KEY)
      const all = raw ? JSON.parse(raw) : {}
      all[user.id] = normalizeTabOrder(tabOrder)
      localStorage.setItem(LOUNGE_TAB_ORDER_STORAGE_KEY, JSON.stringify(all))
    } catch {
      // ignore
    }
  }, [user?.id, tabOrder])

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
        if (isActive) setFeedback(e?.message || t('platform.lounge.loadError'))
      } finally {
        if (isActive) setLoadingWallet(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id, t])

  return (
    <>
      <PageSeo
        routeKey="appLounge"
        title={t('meta.appLounge.title')}
        description={t('meta.appLounge.description')}
        noindex
      />
      <div>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.lounge.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">
          {t('platform.lounge.intro')}
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
                <p className="text-xs text-earth-500">{t('platform.lounge.wallet')}</p>
                {loadingWallet ? (
                  <p className="text-sm text-earth-500">{t('platform.lounge.loadingShort')}</p>
                ) : (
                  <p className="truncate text-xl font-bold text-earth-900">{fp.jpy(wallet?.balance ?? 0)}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-earth-500">
              {transactions.length > 0
                ? t('platform.lounge.movementsCount', { count: transactions.length })
                : t('platform.lounge.movementsNone')}
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-earth-200 bg-earth-50 p-3">
          <div className="flex flex-wrap gap-2">
            {orderedModules.map((moduleId) => {
              return (
                <button
                  key={moduleId}
                  type="button"
                  draggable
                  onClick={() => {
                    setActiveModule(moduleId)
                    const next = new URLSearchParams(searchParams)
                    if (moduleId === 'produtos') next.delete('tab')
                    else next.set('tab', moduleId)
                    setSearchParams(next, { replace: true })
                  }}
                  onDragStart={(e) => {
                    setDraggingTabId(moduleId)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    if (!draggingTabId || draggingTabId === moduleId) return
                    e.preventDefault()
                  }}
                  onDrop={(e) => {
                    if (!draggingTabId || draggingTabId === moduleId) return
                    e.preventDefault()
                    handleTabReorder(draggingTabId, moduleId)
                  }}
                  onDragEnd={() => setDraggingTabId('')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    activeModule === moduleId
                      ? 'bg-earth-900 text-white'
                      : 'bg-white text-earth-700 hover:bg-earth-100'
                  }`}
                >
                  {tabLabel[moduleId]}
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-4">
          {activeModule === 'produtos' && <MeusProdutos />}
          {activeModule === 'envios' && <Envios />}
          {activeModule === 'pedidos' && <Orders />}
          {activeModule === 'desejos' && <ListaDesejos />}
        </section>
      </div>
    </>
  )
}

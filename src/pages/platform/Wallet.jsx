/**
 * Carteira virtual - Saldo e extrato.
 * O saldo pode ser usado para pagar frete, itens da loja e serviços.
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { useFormatPrice } from '../../hooks/useFormatPrice'
import { PageSeo } from '../../components/PageSeo'
import { getWallet, getWalletTransactions, createWalletTopupRequest } from '../../services/walletService'
import { createTopUpCheckoutSession } from '../../services/paymentService'
import { jpyToBrl } from '../../lib/fx'
import WalletTopupPixModal from '../../components/WalletTopupPixModal'
import { cacheKey, readCache, writeCache } from '../../lib/cache'

export default function Wallet() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const fp = useFormatPrice()
  const dateLocale = locale === 'en' ? 'en-US' : 'pt-BR'
  const navigate = useNavigate()
  const location = useLocation()
  const { user, session } = useAuth()
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [topUpAmount, setTopUpAmount] = useState('1000')
  const [adding, setAdding] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [pixModal, setPixModal] = useState({ open: false, request: null })

  const txTypeLabel = (type) =>
    t(`platform.wallet.types.${type}`, { defaultValue: type })

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
      if (active()) setFeedback(e?.message || t('platform.wallet.loadError'))
    } finally {
      if (active()) setLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true
    loadData(() => isActive)
    return () => {
      isActive = false
    }
  }, [user?.id, t])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setFeedback(t('platform.wallet.successTopup'))
      navigate(location.pathname, { replace: true })
      loadData(() => true)
    }
    if (params.get('canceled') === 'true') {
      setFeedback(t('platform.wallet.canceledTopup'))
      navigate(location.pathname, { replace: true })
    }
  }, [navigate, location.pathname, t])

  const handleAddFundsCard = async (e) => {
    e.preventDefault()
    const value = parseFloat(topUpAmount?.replace(',', '.'))
    if (!value || value < 500 || value > 500000) {
      setFeedback(t('platform.wallet.invalidAmount'))
      return
    }
    const amountJpy = Math.round(value)
    setAdding(true)
    setFeedback('')
    try {
      const accessToken = session?.access_token
      if (!accessToken) {
        setFeedback(t('platform.wallet.loginAgain'))
        setAdding(false)
        return
      }
      const { url } = await createTopUpCheckoutSession(amountJpy, accessToken)
      if (url) window.location.href = url
      else setFeedback(t('platform.wallet.openPayError'))
    } catch (err) {
      setFeedback(err.message || t('platform.wallet.addError'))
    } finally {
      setAdding(false)
    }
  }

  const handleAddFundsPix = async (e) => {
    e.preventDefault()
    const value = parseFloat(topUpAmount?.replace(',', '.'))
    if (!value || value < 500 || value > 500000) {
      setFeedback(t('platform.wallet.invalidAmount'))
      return
    }
    const amountJpy = Math.round(value)
    const amountBrl = jpyToBrl(amountJpy)
    setAdding(true)
    setFeedback('')
    try {
      const { data: request, error } = await createWalletTopupRequest(user.id, amountJpy, amountBrl)
      if (error) {
        setFeedback(error.message || t('platform.wallet.pixRequestError'))
        setAdding(false)
        return
      }
      setPixModal({ open: true, request })
    } catch (err) {
      setFeedback(err.message || t('platform.wallet.addError'))
    } finally {
      setAdding(false)
    }
  }

  const presets = [1000, 2000, 5000, 10000]

  const feedbackPositive = (msg) => /success|sucesso/i.test(String(msg || ''))
  const feedbackCanceled = (msg) => /cancel|canceled|cancelada/i.test(String(msg || ''))

  return (
    <>
      <PageSeo
        routeKey="appLounge"
        title={t('meta.appWallet.title')}
        description={t('meta.appWallet.description')}
        noindex
      />
      <div>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.wallet.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">{t('platform.wallet.intro')}</p>

        {feedback && (
          <p
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              feedbackPositive(feedback)
                ? 'bg-green-100 text-green-800'
                : feedbackCanceled(feedback)
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {feedback}
          </p>
        )}

        {loading && <p className="mt-6 text-earth-600">{t('loading')}</p>}

        {!loading && (
          <>
            <div className="mt-6 rounded-xl border border-earth-200 bg-earth-50 p-6">
              <p className="text-sm font-medium text-earth-600">{t('platform.wallet.availableBalance')}</p>
              <p className="mt-1 text-3xl font-bold text-earth-900">
                {fp.jpy(wallet?.balance ?? 0)}
              </p>

              <form onSubmit={(e) => { e.preventDefault(); handleAddFundsCard(e); }} className="mt-6">
                <label className="block text-sm font-medium text-earth-700">{t('platform.wallet.addBalance')}</label>
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
                      {fp.jpy(p)}
                    </button>
                  ))}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value.replace(/[^0-9,.]/g, ''))}
                    placeholder={t('platform.wallet.otherAmountPh')}
                    className="w-28 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                  <span className="text-sm text-earth-500">{t('platform.wallet.minMaxHint')}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={adding}
                    className="rounded-lg bg-earth-900 px-5 py-2.5 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                  >
                    {adding ? t('platform.wallet.opening') : t('platform.wallet.card')}
                  </button>
                  <button
                    type="button"
                    disabled={adding}
                    onClick={handleAddFundsPix}
                    className="rounded-lg border border-earth-900 bg-white px-5 py-2.5 font-medium text-earth-900 hover:bg-earth-50 disabled:opacity-60"
                  >
                    {adding ? t('platform.wallet.pixDots') : t('platform.wallet.pix')}
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold text-earth-900">{t('platform.wallet.statement')}</h2>
              {transactions.length === 0 ? (
                <p className="mt-2 text-sm text-earth-600">{t('platform.wallet.emptyStatement')}</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {transactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-earth-200 bg-white px-4 py-3"
                    >
                      <div>
                        <span className="font-medium text-earth-900">
                          {txTypeLabel(tx.type)}
                        </span>
                        {tx.description && (
                          <p className="text-sm text-earth-500">{tx.description}</p>
                        )}
                        <p className="text-xs text-earth-400">
                          {tx.created_at
                            ? new Date(tx.created_at).toLocaleString(dateLocale)
                            : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={tx.kind === 'credit' ? 'text-green-700' : 'text-earth-900'}>
                          {tx.kind === 'credit' ? '+' : ''}
                          {fp.jpy(tx.amount)}
                        </span>
                        {tx.balance_after != null && (
                          <p className="text-xs text-earth-500">
                            {t('platform.wallet.balanceAfter', {
                              amount: fp.jpy(tx.balance_after),
                            })}
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

      <WalletTopupPixModal
        open={pixModal.open}
        onClose={() => setPixModal({ open: false, request: null })}
        amountBrl={pixModal.request?.amount_brl}
        amountJpy={pixModal.request?.amount_jpy}
        requestId={pixModal.request?.id}
        userId={user?.id}
      />
    </>
  )
}

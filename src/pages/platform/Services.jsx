/**
 * Services - Contratação de Redirecionamento e Personal Shopping.
 * Redirecionamento (Padrão ou Assistido): disclaimer → user cria pedido → admin aprova / orça.
 * Personal Shopping e Redirecionamento: anexos por arquivo ou URL; admin orça / aprova conforme o fluxo.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useFormatPrice } from '../../hooks/useFormatPrice'
import { PageSeo } from '../../components/PageSeo'
import { getServices, createOrder } from '../../services/orderService'
import { uploadOrderAttachment } from '../../services/productService'
import { getWallet } from '../../services/walletService'
import {
  REDIR_ASSISTIDO_FEE_PERCENT,
  computeAssistedEarlyPrepayDebitJpy,
} from '../../data/serviceFees'

function messageContainsHttpUrl(text) {
  return /https?:\/\/[^\s<>"']+/i.test(String(text || '').trim())
}

const SERVICOS_OFERTADOS = ['Redirecionamento', 'Personal Shopping']
const REDIRECIONAMENTO = 'Redirecionamento'
const PERSONAL_SHOPPING = 'Personal Shopping'

const DRAFT_STORAGE_PREFIX = 'platform_services_order_draft_v1:'

function readServicesDraft(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_PREFIX + userId)
    if (!raw) return null
    const d = JSON.parse(raw)
    return d && typeof d === 'object' ? d : null
  } catch {
    return null
  }
}

function writeServicesDraft(userId, payload) {
  if (!userId) return
  try {
    localStorage.setItem(DRAFT_STORAGE_PREFIX + userId, JSON.stringify(payload))
  } catch {
    // quota ou modo privado
  }
}

function clearServicesDraft(userId) {
  if (!userId) return
  try {
    localStorage.removeItem(DRAFT_STORAGE_PREFIX + userId)
  } catch {
    // ignore
  }
}

export default function Services({ embedded = false }) {
  const { t } = useTranslation()
  const fp = useFormatPrice()
  const { user } = useAuth()
  const lp = useLocalizedPath()
  const [services, setServices] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [message, setMessage] = useState('')
  const [agreeProhibited, setAgreeProhibited] = useState(false)
  const [redirModule, setRedirModule] = useState('self_buy')
  const [attachmentUrls, setAttachmentUrls] = useState([])
  const [imageUrlDraft, setImageUrlDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [successNotice, setSuccessNotice] = useState(null)
  const [failedThumbUrls, setFailedThumbUrls] = useState(() => new Set())
  const [draftHydrated, setDraftHydrated] = useState(false)
  const [earlyPrepaymentRequested, setEarlyPrepaymentRequested] = useState(false)
  const [earlyPrepaymentProductsJpyInput, setEarlyPrepaymentProductsJpyInput] = useState('')
  const [walletPreview, setWalletPreview] = useState(null)
  const saveDebounceRef = useRef(null)
  const draftLoadedRef = useRef(false)

  const selectedService = selectedId ? services.find((s) => s.id === selectedId) : null
  const isRedirecionamento = selectedService?.name === REDIRECIONAMENTO
  const isPersonalShopping = selectedService?.name === PERSONAL_SHOPPING
  const isRedirAssisted = isRedirecionamento && redirModule === 'assisted_buy'
  const isRedirStandard = isRedirecionamento && redirModule === 'self_buy'
  const showImageAttachments = isPersonalShopping || isRedirAssisted || isRedirStandard
  const canSubmit = !isRedirecionamento || agreeProhibited

  const earlyPrepayBreakdown = useMemo(() => {
    if (!isRedirAssisted || !earlyPrepaymentRequested) return null
    return computeAssistedEarlyPrepayDebitJpy(earlyPrepaymentProductsJpyInput, REDIR_ASSISTIDO_FEE_PERCENT)
  }, [isRedirAssisted, earlyPrepaymentRequested, earlyPrepaymentProductsJpyInput])

  const serviceUiDescription = (s) => {
    if (s.name === REDIRECIONAMENTO) return t('platform.services.descForwarding')
    if (s.name === PERSONAL_SHOPPING) return t('platform.services.descPersonalShopping')
    return s.description
  }

  useEffect(() => {
    let isActive = true
    const run = async () => {
      try {
        const { data, error } = await getServices()
        if (!isActive) return
        setServices(data ?? [])
        if (error) setFeedback(error.message)
      } catch (e) {
        if (isActive) setFeedback(e?.message || t('platform.services.loadError'))
      } finally {
        if (isActive) setLoading(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [t])

  const oferta = services.filter((s) => SERVICOS_OFERTADOS.includes(s.name))

  useEffect(() => {
    draftLoadedRef.current = false
    setDraftHydrated(false)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || loading || oferta.length === 0) return
    if (draftLoadedRef.current) return
    draftLoadedRef.current = true
    const d = readServicesDraft(user.id)
    if (d) {
      if (typeof d.message === 'string') setMessage(d.message)
      if (d.redirModule === 'self_buy' || d.redirModule === 'assisted_buy') setRedirModule(d.redirModule)
      if (typeof d.agreeProhibited === 'boolean') setAgreeProhibited(d.agreeProhibited)
      if (Array.isArray(d.attachmentUrls)) {
        setAttachmentUrls(d.attachmentUrls.filter((u) => typeof u === 'string' && u.trim()))
      }
      if (typeof d.imageUrlDraft === 'string') setImageUrlDraft(d.imageUrlDraft)
      if (typeof d.earlyPrepaymentRequested === 'boolean') setEarlyPrepaymentRequested(d.earlyPrepaymentRequested)
      if (typeof d.earlyPrepaymentProductsJpyInput === 'string') {
        setEarlyPrepaymentProductsJpyInput(d.earlyPrepaymentProductsJpyInput)
      } else if (typeof d.earlyPrepaymentWalletInput === 'string') {
        setEarlyPrepaymentProductsJpyInput(d.earlyPrepaymentWalletInput)
      }
      if (d.selectedId && oferta.some((s) => s.id === d.selectedId)) {
        setSelectedId(d.selectedId)
      }
    }
    setDraftHydrated(true)
  }, [user?.id, loading, oferta.length])

  useEffect(() => {
    if (!user?.id || !draftHydrated) return
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      writeServicesDraft(user.id, {
        message,
        selectedId,
        redirModule,
        agreeProhibited,
        attachmentUrls,
        imageUrlDraft,
        earlyPrepaymentRequested,
        earlyPrepaymentProductsJpyInput,
        updatedAt: Date.now(),
      })
    }, 450)
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    }
  }, [user?.id, draftHydrated, message, selectedId, redirModule, agreeProhibited, attachmentUrls, imageUrlDraft, earlyPrepaymentRequested, earlyPrepaymentProductsJpyInput])

  useEffect(() => {
    if (!user?.id || !isRedirAssisted) {
      setWalletPreview(null)
      return
    }
    let active = true
    ;(async () => {
      const { data } = await getWallet(user.id)
      if (!active) return
      setWalletPreview(data)
    })()
    return () => {
      active = false
    }
  }, [user?.id, isRedirAssisted])

  const clearLocalDraft = () => {
    setMessage('')
    setAttachmentUrls([])
    setImageUrlDraft('')
    setEarlyPrepaymentRequested(false)
    setEarlyPrepaymentProductsJpyInput('')
    setFailedThumbUrls(() => new Set())
    clearServicesDraft(user?.id)
  }

  const addImageUrl = () => {
    const raw = imageUrlDraft.trim()
    if (!raw) return
    let u = raw
    if (!/^https?:\/\//i.test(u)) {
      setFeedback(t('platform.services.urlMustBeHttp'))
      return
    }
    try {
      const parsed = new URL(u)
      if (!parsed.protocol.startsWith('http')) {
        setFeedback(t('platform.services.urlHttpOnly'))
        return
      }
    } catch {
      setFeedback(t('platform.services.urlInvalid'))
      return
    }
    setSuccessNotice(null)
    setFeedback('')
    setAttachmentUrls((prev) => [...prev, u])
    setImageUrlDraft('')
    setFailedThumbUrls((prev) => {
      const next = new Set(prev)
      next.delete(u)
      return next
    })
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploading(true)
    setFeedback('')
    setSuccessNotice(null)
    const { data, error } = await uploadOrderAttachment(file, user.id)
    setUploading(false)
    if (error) {
      setFeedback(error.message)
      return
    }
    if (data) {
      setAttachmentUrls((prev) => [...prev, data])
      setFailedThumbUrls((prev) => {
        const next = new Set(prev)
        next.delete(data)
        return next
      })
    }
    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedId) {
      setFeedback(t('platform.services.selectService'))
      return
    }
    let earlyDebitTotalJpy = 0
    let declaredProductsJpy = null
    if (isRedirAssisted && earlyPrepaymentRequested) {
      const prep = computeAssistedEarlyPrepayDebitJpy(
        earlyPrepaymentProductsJpyInput,
        REDIR_ASSISTIDO_FEE_PERCENT
      )
      if (!prep) {
        setFeedback(t('platform.services.earlyPrepayProductsMin'))
        return
      }
      const msgTrim = message.trim()
      if (!messageContainsHttpUrl(msgTrim)) {
        setFeedback(t('platform.services.earlyPrepayMessageRequiresLinks'))
        return
      }
      earlyDebitTotalJpy = prep.totalDebitJpy
      declaredProductsJpy = prep.productsJpy
      const { data: wBal } = await getWallet(user.id)
      const bal = Math.floor(Number(wBal?.balance) || 0)
      if (earlyDebitTotalJpy > bal) {
        setFeedback(t('platform.services.walletBalanceShort', { balance: fp.jpy(bal) }))
        return
      }
    }

    setSubmitting(true)
    setFeedback('')
    setSuccessNotice(null)
    const { data, error } = await createOrder(user.id, {
      service_id: selectedId,
      message: message.trim() || null,
      attachment_urls: attachmentUrls,
      service_name: selectedService?.name,
      order_module: isRedirecionamento ? redirModule : null,
      early_prepayment_requested: isRedirAssisted && earlyPrepaymentRequested,
      early_prepayment_wallet_jpy:
        isRedirAssisted && earlyPrepaymentRequested && earlyDebitTotalJpy > 0 ? earlyDebitTotalJpy : null,
      early_prepayment_declared_products_jpy:
        isRedirAssisted && earlyPrepaymentRequested && declaredProductsJpy != null
          ? declaredProductsJpy
          : null,
    })
    if (error) {
      setSubmitting(false)
      setFeedback(error.message)
      return
    }

    setSubmitting(false)
    setSuccessNotice({
      quoteFlow: !!(isPersonalShopping || isRedirAssisted),
      earlyPrepayOrderId:
        isRedirAssisted && earlyPrepaymentRequested && earlyDebitTotalJpy > 0 && data?.id ? data.id : null,
      earlyPrepayAmountJpy:
        isRedirAssisted && earlyPrepaymentRequested && earlyDebitTotalJpy > 0 ? earlyDebitTotalJpy : null,
    })
    clearServicesDraft(user.id)
    setSelectedId(null)
    setMessage('')
    setAttachmentUrls([])
    setImageUrlDraft('')
    setEarlyPrepaymentRequested(false)
    setEarlyPrepaymentProductsJpyInput('')
    setFailedThumbUrls(() => new Set())
  }

  if (!user) {
    return (
      <div className={embedded ? 'rounded-xl border border-earth-200 bg-white p-4 sm:p-6' : ''}>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.services.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">{t('platform.services.intro')}</p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Link to={lp('login')} className="font-semibold underline hover:no-underline">
            {t('platform.groupBuy.loginLink')}
          </Link>
          {t('platform.groupBuy.loginSuffix')}
        </div>
      </div>
    )
  }

  return (
    <>
      {!embedded && (
        <PageSeo
          routeKey="appServices"
          title={t('meta.appServices.title')}
          description={t('meta.appServices.description')}
          noindex
        />
      )}
      <div className={embedded ? 'rounded-xl border border-earth-200 bg-white p-4 sm:p-6' : ''}>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.services.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">{t('platform.services.intro')}</p>

        {loading && <p className="mt-6 text-earth-600">{t('platform.services.loading')}</p>}

        {!loading && oferta.length === 0 && (
          <p className="mt-6 text-earth-600">{t('platform.services.noServices')}</p>
        )}

        {!loading && oferta.length > 0 && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div>
              <h2 className="mb-3 text-sm font-medium text-earth-700">{t('platform.services.chooseService')}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {oferta.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(s.id)
                      setFeedback('')
                      setSuccessNotice(null)
                      setAgreeProhibited(false)
                      setRedirModule('self_buy')
                      setEarlyPrepaymentRequested(false)
                      setEarlyPrepaymentProductsJpyInput('')
                    }}
                    className={`rounded-xl border-2 p-5 text-left transition ${
                      selectedId === s.id
                        ? 'border-earth-900 bg-earth-100'
                        : 'border-earth-200 bg-earth-50 hover:border-earth-400'
                    }`}
                  >
                    <h3 className="font-semibold text-earth-900">{s.name}</h3>
                    <p className="mt-1 text-sm text-earth-600">{serviceUiDescription(s)}</p>
                    {selectedId === s.id && (
                      <span className="mt-2 inline-block text-sm font-medium text-earth-700">
                        {t('platform.services.selected')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {isRedirecionamento && (
              <div className="space-y-4">
                <div className="rounded-xl border border-earth-200 bg-gradient-to-b from-sky-50/80 to-white p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
                    {t('platform.services.itemFeeTitle')}
                  </p>
                  <p className="mt-2 text-sm font-medium text-earth-900">{t('platform.services.itemFeeTable')}</p>
                  <div className="mt-4 space-y-2 rounded-lg border border-earth-200/80 bg-white/90 px-3 py-3 text-sm text-earth-800">
                    <p>
                      <span className="font-semibold text-earth-900">{t('platform.services.itemFeeWhenLead')}</span>{' '}
                      {t('platform.services.itemFeeWhenP1')}
                    </p>
                    <p className="text-earth-600">{t('platform.services.itemFeeWhenP2')}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-earth-200 bg-white p-4">
                  <p className="text-sm font-medium text-earth-800">{t('platform.services.redirModalityTitle')}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${redirModule === 'self_buy' ? 'border-earth-900 bg-earth-50' : 'border-earth-200 bg-white hover:bg-earth-50'}`}>
                      <input
                        type="radio"
                        name="redirModule"
                        checked={redirModule === 'self_buy'}
                        onChange={() => {
                          setRedirModule('self_buy')
                          setEarlyPrepaymentRequested(false)
                          setEarlyPrepaymentProductsJpyInput('')
                        }}
                        className="mt-1"
                      />
                      <div>
                        <span className="block font-semibold text-earth-900">{t('platform.services.standardTitle')}</span>
                        <span className="mt-1 block text-sm text-earth-600">{t('platform.services.standardBody')}</span>
                      </div>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${redirModule === 'assisted_buy' ? 'border-earth-900 bg-earth-50' : 'border-earth-200 bg-white hover:bg-earth-50'}`}>
                      <input
                        type="radio"
                        name="redirModule"
                        checked={redirModule === 'assisted_buy'}
                        onChange={() => setRedirModule('assisted_buy')}
                        className="mt-1"
                      />
                      <div>
                        <span className="block font-semibold text-earth-900">{t('platform.services.assistedTitle')}</span>
                        <span className="mt-1 block text-sm text-earth-600">
                          {t('platform.services.assistedBody', { percent: REDIR_ASSISTIDO_FEE_PERCENT })}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {redirModule === 'self_buy' && (
                  <div className="rounded-lg border border-earth-200 bg-earth-50 p-4 text-sm text-earth-800">
                    <p>
                      <strong>{t('platform.services.purchaseDocsTitle')}</strong> {t('platform.services.purchaseDocsBody')}
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={agreeProhibited}
                      onChange={(e) => setAgreeProhibited(e.target.checked)}
                      className="mt-1 rounded border-earth-300"
                    />
                    <span className="text-sm text-earth-800">
                      {t('platform.services.prohibitedLead')}{' '}
                      <Link to={lp('faqProhibited')} target="_blank" rel="noopener noreferrer" className="font-medium text-earth-900 underline hover:no-underline">
                        {t('platform.services.prohibitedLink')}
                      </Link>{' '}
                      {t('platform.services.prohibitedTail')}
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div>
              {isRedirAssisted && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/90 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={earlyPrepaymentRequested}
                      onChange={(e) => {
                        const on = e.target.checked
                        setEarlyPrepaymentRequested(on)
                        if (!on) setEarlyPrepaymentProductsJpyInput('')
                      }}
                      className="mt-1 rounded border-earth-300"
                    />
                    <span className="text-sm text-earth-800">
                      <span className="font-semibold text-earth-900">{t('platform.services.earlyPrepayHeading')}</span>
                      <span className="mt-1 block font-normal">
                        {t('platform.services.earlyPrepayDesc', { pct: REDIR_ASSISTIDO_FEE_PERCENT })}
                      </span>
                    </span>
                  </label>
                  <p className="mt-3 text-xs text-earth-600">
                    {t('platform.services.earlyPrepayHint', { pct: REDIR_ASSISTIDO_FEE_PERCENT })}
                  </p>
                </div>
              )}
              <label htmlFor="message" className="block text-sm font-medium text-earth-700">
                {isPersonalShopping || isRedirAssisted
                  ? t('platform.services.messageLabelShopping')
                  : t('platform.services.messageLabelRedir')}
              </label>
              <p className="mt-1 text-xs text-earth-500">
                {isPersonalShopping || isRedirAssisted
                  ? t('platform.services.hintShopping')
                  : isRedirStandard
                    ? t('platform.services.hintStandard')
                    : t('platform.services.hintAssisted')}
              </p>
              {isRedirAssisted && earlyPrepaymentRequested && (
                <p className="mt-2 text-xs font-medium text-amber-900">
                  {t('platform.services.earlyPrepayMessageHint')}
                </p>
              )}
              <p className="mt-1 text-xs text-earth-600">{t('platform.services.draftNote')}</p>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  isPersonalShopping || isRedirAssisted
                    ? t('platform.services.placeholderShopping')
                    : t('platform.services.placeholderRedir')
                }
                rows={4}
                className="mt-2 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900 placeholder:text-earth-400"
              />
              {isRedirAssisted && earlyPrepaymentRequested && (
                <div className="mt-4 rounded-lg border border-emerald-300/60 bg-emerald-50/90 px-3 py-3">
                  <p className="text-sm font-medium text-earth-900">
                    {t('platform.services.earlyPrepayProductsSectionTitle')}
                  </p>
                  <label htmlFor="early-prepay-products-jpy" className="mt-2 block text-sm font-medium text-earth-800">
                    {t('platform.services.earlyPrepayProductsLabel')}
                  </label>
                  <input
                    id="early-prepay-products-jpy"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={earlyPrepaymentProductsJpyInput}
                    onChange={(e) => setEarlyPrepaymentProductsJpyInput(e.target.value)}
                    placeholder={t('platform.services.earlyPrepayProductsPlaceholder')}
                    className="mt-2 w-full max-w-xs rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                  />
                  {earlyPrepayBreakdown && (
                    <ul className="mt-3 space-y-1 rounded-md border border-emerald-200/80 bg-white/90 px-3 py-2 text-sm text-earth-800">
                      <li className="flex justify-between gap-2">
                        <span>{t('platform.services.earlyPrepayLineProducts')}</span>
                        <span className="font-medium tabular-nums">{fp.jpy(earlyPrepayBreakdown.productsJpy)}</span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span>
                          {t('platform.services.earlyPrepayLineFee', { pct: REDIR_ASSISTIDO_FEE_PERCENT })}
                        </span>
                        <span className="font-medium tabular-nums">{fp.jpy(earlyPrepayBreakdown.feeJpy)}</span>
                      </li>
                      <li className="flex justify-between gap-2 border-t border-emerald-100 pt-1 font-semibold text-earth-900">
                        <span>{t('platform.services.earlyPrepayLineTotalDebit')}</span>
                        <span className="tabular-nums">{fp.jpy(earlyPrepayBreakdown.totalDebitJpy)}</span>
                      </li>
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-earth-600">
                    {t('platform.services.earlyPrepayBalance', {
                      balance:
                        walletPreview != null ? fp.jpy(Math.floor(walletPreview.balance || 0)) : '…',
                    })}{' '}
                    <Link to={lp('appLounge')} className="font-medium text-earth-800 underline hover:no-underline">
                      {t('platform.lounge.wallet')}
                    </Link>
                  </p>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={clearLocalDraft}
                  className="text-xs font-medium text-earth-600 underline decoration-earth-300 hover:text-earth-900 hover:decoration-earth-600"
                >
                  {t('platform.services.clearDraft')}
                </button>
              </div>
            </div>

            {showImageAttachments && (
              <div>
                <label className="block text-sm font-medium text-earth-700">{t('platform.services.refImagesTitle')}</label>
                <p className="mt-1 text-xs text-earth-500">{t('platform.services.refImagesHint')}</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
                    <span className="text-xs font-medium text-earth-600">{t('platform.services.imageUrlLabel')}</span>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="url"
                        value={imageUrlDraft}
                        onChange={(e) => setImageUrlDraft(e.target.value)}
                        placeholder="https://..."
                        className="min-w-0 flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                      />
                      <button
                        type="button"
                        onClick={addImageUrl}
                        className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50"
                      >
                        {t('platform.services.addUrl')}
                      </button>
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50">
                    {uploading ? t('platform.services.uploading') : t('platform.services.uploadFile')}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploading}
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
                {attachmentUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachmentUrls.map((url, i) => (
                      <div key={`${url}-${i}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-earth-200 bg-earth-100">
                        {failedThumbUrls.has(url) ? (
                          <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-medium leading-tight text-earth-600">
                            {/^https?:\/\//i.test(url) ? t('platform.services.thumbLink') : t('platform.services.thumbFile')}
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={() =>
                              setFailedThumbUrls((prev) => {
                                const next = new Set(prev)
                                next.add(url)
                                return next
                              })
                            }
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setAttachmentUrls((p) => p.filter((_, j) => j !== i))}
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                          aria-label={t('platform.services.removeThumb')}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {successNotice && (
              <div className="space-y-2 rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">
                {successNotice.quoteFlow ? (
                  <p>
                    {t('platform.services.successQuoteBefore')}
                    <Link to={lp('appLounge', '?tab=pedidos')} className="font-semibold text-green-900 underline hover:no-underline">
                      {t('platform.orders.pageTitle')}
                    </Link>
                    {t('platform.services.successQuoteAfter')}
                  </p>
                ) : (
                  <p>
                    {t('platform.services.successApproveBefore')}
                    <Link to={lp('appLounge', '?tab=pedidos')} className="font-semibold text-green-900 underline hover:no-underline">
                      {t('platform.orders.pageTitle')}
                    </Link>
                    {t('platform.services.successApproveAfter')}
                  </p>
                )}
                {successNotice.earlyPrepayOrderId && successNotice.earlyPrepayAmountJpy != null && (
                  <p className="text-green-900">
                    {t('platform.services.successEarlyPrepayLead', {
                      amount: fp.jpy(successNotice.earlyPrepayAmountJpy),
                    })}{' '}
                    <Link
                      to={lp(
                        'appLounge',
                        `?tab=pedidos&orderId=${encodeURIComponent(successNotice.earlyPrepayOrderId)}`
                      )}
                      className="font-semibold text-green-950 underline hover:no-underline"
                    >
                      {t('platform.services.successEarlyPrepayLink')}
                    </Link>
                    {t('platform.services.successEarlyPrepayTail')}
                  </p>
                )}
              </div>
            )}

            {feedback && (
              <p className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800">{feedback}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedId || !canSubmit}
              className="rounded-lg bg-earth-900 px-6 py-3 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60 disabled:hover:bg-earth-900"
            >
              {submitting ? t('platform.services.submitSending') : t('platform.services.submitSend')}
            </button>
          </form>
        )}
      </div>
    </>
  )
}

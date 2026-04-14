/**
 * Orçamento indicado pelo cliente — Redirecionamento Assistido (links + scrape-product).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { scrapeProductUrl } from '../../services/wishlistLinkService'
import { getFxBrlPerJpy } from '../../lib/fx'
import {
  REDIR_ASSISTIDO_FEE_PERCENT,
  computeAssistedEarlyPrepayDebitJpy,
} from '../../data/serviceFees'

function parsePriceInput(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  const normalized = text.replace(/[^\d.,-]/g, '')
  if (!normalized) return null

  const hasComma = normalized.includes(',')
  const hasDot = normalized.includes('.')
  let candidate = normalized

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(',')
    const lastDot = normalized.lastIndexOf('.')
    if (lastComma > lastDot) {
      candidate = normalized.replace(/\./g, '').replace(',', '.')
    } else {
      candidate = normalized.replace(/,/g, '')
    }
  } else if (hasComma) {
    const parts = normalized.split(',')
    const tail = parts[parts.length - 1] ?? ''
    candidate = tail.length <= 2 ? `${parts.slice(0, -1).join('')}.${tail}` : parts.join('')
  } else if (hasDot) {
    const parts = normalized.split('.')
    const tail = parts[parts.length - 1] ?? ''
    candidate = tail.length > 2 ? parts.join('') : normalized
  }

  const parsed = Number(candidate)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function newLineId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    // ignore
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * @param {Array<{ price?: number|null, currency?: string }>} lines
 * @param {number} fxBrlPerJpy BRL per 1 JPY
 */
export function computeAssistedBudgetSubtotalJpy(lines, fxBrlPerJpy) {
  const fx = Number(fxBrlPerJpy)
  if (!Array.isArray(lines) || !Number.isFinite(fx) || fx <= 0) return 0
  let sum = 0
  for (const line of lines) {
    const p = Number(line?.price)
    if (!Number.isFinite(p) || p <= 0) continue
    const cur = line?.currency === 'BRL' ? 'BRL' : 'JPY'
    if (cur === 'BRL') sum += Math.floor(p / fx)
    else sum += Math.floor(p)
  }
  return sum
}

export function assistedBudgetLineHasHttpUrl(line) {
  return /^https?:\/\//i.test(String(line?.url || '').trim())
}

export function assistedBudgetHasAnyProductUrl(lines) {
  return Array.isArray(lines) && lines.some(assistedBudgetLineHasHttpUrl)
}

function normalizeLineFromDraft(raw) {
  if (!raw || typeof raw !== 'object') return null
  const url = typeof raw.url === 'string' ? raw.url.trim() : ''
  const productNameRaw =
    typeof raw.productName === 'string'
      ? raw.productName
      : typeof raw.product_name === 'string'
        ? raw.product_name
        : ''
  const productName = productNameRaw
  const id = typeof raw.id === 'string' && raw.id ? raw.id : newLineId()
  const currency = raw.currency === 'BRL' ? 'BRL' : 'JPY'
  const priceFromRaw =
    raw.price != null && raw.price !== '' ? parsePriceInput(raw.price) : null
  const imageUrlStr =
    typeof raw.imageUrl === 'string'
      ? raw.imageUrl
      : typeof raw.image_url === 'string'
        ? raw.image_url
        : ''
  const imageUrl = imageUrlStr.trim() ? imageUrlStr.trim() : null
  if (!url && !productName) return null
  return {
    id,
    url,
    productName: productName || url,
    price: priceFromRaw,
    currency,
    imageUrl,
  }
}

export function normalizeAssistedBudgetLinesFromDraft(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(normalizeLineFromDraft).filter(Boolean)
}

export default function AssistedRedirectBudgetSection({ lines, onLinesChange, fp }) {
  const { t } = useTranslation()
  const [urlInput, setUrlInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [localError, setLocalError] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [manualCurrency, setManualCurrency] = useState('JPY')
  const [failedThumbs, setFailedThumbs] = useState(() => new Set())

  const fxBrlPerJpy = getFxBrlPerJpy()
  const subtotalJpy = useMemo(() => computeAssistedBudgetSubtotalJpy(lines, fxBrlPerJpy), [lines, fxBrlPerJpy])
  const hasBrlLines = useMemo(() => lines.some((l) => l.currency === 'BRL' && l.price), [lines])
  const feePreview = useMemo(() => {
    if (subtotalJpy < 1) return null
    return computeAssistedEarlyPrepayDebitJpy(String(subtotalJpy), REDIR_ASSISTIDO_FEE_PERCENT)
  }, [subtotalJpy])

  const pushLine = (line) => {
    onLinesChange([...lines, { ...line, id: line.id || newLineId() }])
  }

  const updateLine = (id, patch) => {
    onLinesChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const removeLine = (id) => {
    onLinesChange(lines.filter((l) => l.id !== id))
  }

  const handleAddByUrl = async (e) => {
    e?.preventDefault?.()
    const url = urlInput.trim()
    if (!url) return
    setAdding(true)
    setLocalError('')
    setShowManual(false)
    const { data, error } = await scrapeProductUrl(url)
    if (error) {
      setLocalError(error.message || t('platform.services.budgetScrapeError'))
      setShowManual(true)
      setManualUrl(url)
      setAdding(false)
      return
    }
    // Mesma normalização que ListaDesejos (doAddItem → parsePriceInput(data.price))
    const currencyRaw = data.currency || 'JPY'
    const currency = String(currencyRaw).toUpperCase() === 'BRL' ? 'BRL' : 'JPY'
    const priceVal = parsePriceInput(data.price)
    if (priceVal == null) {
      setLocalError(t('platform.services.budgetPriceMissing'))
      setShowManual(true)
      setManualUrl(url)
      setManualName(data.name || '')
      setManualPrice('')
      setManualCurrency(currency)
      setUrlInput('')
      setAdding(false)
      return
    }
    pushLine({
      id: newLineId(),
      url,
      productName: data.name || t('platform.services.budgetProductFallback'),
      price: priceVal,
      currency,
      imageUrl: data.imageUrl || null,
    })
    setUrlInput('')
    setAdding(false)
  }

  const handleManualAdd = () => {
    const url = manualUrl.trim()
    if (!url) {
      setLocalError(t('platform.services.budgetNeedUrl'))
      return
    }
    if (!manualName.trim()) {
      setLocalError(t('platform.services.budgetNeedName'))
      return
    }
    setLocalError('')
    pushLine({
      id: newLineId(),
      url,
      productName: manualName.trim(),
      price: parsePriceInput(manualPrice),
      currency: manualCurrency === 'BRL' ? 'BRL' : 'JPY',
      imageUrl: null,
    })
    setManualUrl('')
    setManualName('')
    setManualPrice('')
    setManualCurrency('JPY')
    setShowManual(false)
  }

  return (
    <div className="rounded-xl border border-sky-200/90 bg-gradient-to-b from-sky-50/90 to-white p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-earth-900">{t('platform.services.budgetSectionTitle')}</h3>
      <p className="mt-1 text-xs text-earth-600">{t('platform.services.budgetSectionIntro')}</p>

      {/* Não usar <form> aqui: o componente fica dentro do formulário de Serviços; form aninhado faz o submit ir para o pai e recarregar a página. */}
      <div className="mt-4 space-y-2">
        <label htmlFor="assisted-budget-url" className="block text-xs font-medium text-earth-700">
          {t('platform.services.budgetUrlLabel')}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            id="assisted-budget-url"
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!adding && urlInput.trim()) void handleAddByUrl(e)
              }
            }}
            placeholder={t('platform.services.budgetUrlPlaceholder')}
            className="min-w-0 flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900 placeholder:text-earth-400"
          />
          <button
            type="button"
            disabled={adding || !urlInput.trim()}
            onClick={(e) => void handleAddByUrl(e)}
            className="shrink-0 rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
          >
            {adding ? t('platform.services.budgetSearching') : t('platform.services.budgetFetch')}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => (showManual ? setShowManual(false) : (setShowManual(true), setManualUrl(urlInput.trim())))}
        className="mt-2 text-sm text-earth-600 underline hover:text-earth-900"
      >
        {showManual ? t('platform.services.budgetToggleManualHide') : t('platform.services.budgetToggleManualShow')}
      </button>

      {showManual && (
        <div className="mt-3 rounded-lg border border-earth-200 bg-earth-50/80 p-4">
          <p className="text-sm font-medium text-earth-800">{t('platform.services.budgetManualTitle')}</p>
          <p className="mt-1 text-xs text-earth-600">{t('platform.services.budgetManualHint')}</p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-earth-700">{t('platform.services.budgetManualLink')}</label>
              <input
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-earth-700">{t('platform.services.budgetManualName')}</label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-earth-700">{t('platform.services.budgetManualPrice')}</label>
                <input
                  type="text"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder={t('platform.services.budgetManualPricePh')}
                  className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                />
              </div>
              <div>
                <label className="block text-xs text-earth-700">{t('platform.services.budgetManualCurrency')}</label>
                <select
                  value={manualCurrency}
                  onChange={(e) => setManualCurrency(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                >
                  <option value="JPY">JPY</option>
                  <option value="BRL">BRL</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleManualAdd}
              className="rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-700"
            >
              {t('platform.services.budgetAddManual')}
            </button>
          </div>
        </div>
      )}

      {localError && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{localError}</p>
      )}

      {lines.length > 0 && (
        <div className="mt-5 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-earth-500">
            {t('platform.services.budgetListHeading', { count: lines.length })}
          </h4>
          {lines.map((line) => (
            <div
              key={line.id}
              className="flex flex-col gap-3 rounded-lg border border-earth-200 bg-white/95 p-3 sm:flex-row sm:items-start"
            >
              <div className="flex shrink-0 gap-3">
                {line.imageUrl && !failedThumbs.has(line.id) ? (
                  <img
                    src={line.imageUrl}
                    alt=""
                    className="h-16 w-16 rounded-md border border-earth-100 object-cover"
                    onError={() =>
                      setFailedThumbs((prev) => {
                        const n = new Set(prev)
                        n.add(line.id)
                        return n
                      })
                    }
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-md bg-earth-100 text-[10px] text-earth-500">
                    {t('platform.services.budgetNoThumb')}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="text"
                  value={line.productName}
                  onChange={(e) => updateLine(line.id, { productName: e.target.value })}
                  className="w-full rounded border border-earth-200 px-2 py-1.5 text-sm font-medium text-earth-900"
                  aria-label={t('platform.services.budgetEditNameAria')}
                />
                <a
                  href={line.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-sky-700 hover:underline"
                >
                  {line.url}
                </a>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-[10px] font-medium uppercase text-earth-500">{t('platform.services.budgetLinePrice')}</label>
                    <input
                      type="text"
                      value={line.price != null ? String(line.price) : ''}
                      onChange={(e) => {
                        const v = e.target.value.trim()
                        updateLine(line.id, {
                          price: v ? parsePriceInput(v) : null,
                        })
                      }}
                      className="mt-0.5 w-28 rounded border border-earth-200 px-2 py-1 text-sm tabular-nums"
                    />
                  </div>
                  <select
                    value={line.currency === 'BRL' ? 'BRL' : 'JPY'}
                    onChange={(e) => updateLine(line.id, { currency: e.target.value })}
                    className="rounded border border-earth-200 px-2 py-1 text-sm"
                  >
                    <option value="JPY">JPY</option>
                    <option value="BRL">BRL</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="ml-auto text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    {t('platform.services.budgetRemoveLine')}
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-earth-200 bg-earth-50/90 px-3 py-3 text-sm text-earth-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{t('platform.services.budgetSubtotalJpy')}</span>
              <span className="text-lg font-semibold tabular-nums text-earth-900">{fp.jpy(subtotalJpy)}</span>
            </div>
            {hasBrlLines && (
              <p className="mt-2 text-xs text-earth-600">{t('platform.services.budgetFxNote')}</p>
            )}
            {feePreview && (
              <ul className="mt-3 space-y-1 border-t border-earth-200 pt-3 text-xs text-earth-700">
                <li className="flex justify-between gap-2">
                  <span>{t('platform.services.budgetPreviewFee', { pct: REDIR_ASSISTIDO_FEE_PERCENT })}</span>
                  <span className="tabular-nums">{fp.jpy(feePreview.feeJpy)}</span>
                </li>
                <li className="flex justify-between gap-2 font-medium text-earth-900">
                  <span>{t('platform.services.budgetPreviewPrepayTotal')}</span>
                  <span className="tabular-nums">{fp.jpy(feePreview.totalDebitJpy)}</span>
                </li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditsAmount, CreditsInline } from '../CreditsAmount'

export function BoxBreakPurchaseConfirm({
  open,
  productName,
  quantity = 1,
  amount = 0,
  balance = null,
  busy = false,
  onCancel,
  onConfirm,
}) {
  const { t } = useTranslation()
  const qty = Math.max(1, Math.floor(Number(quantity) || 1))
  const charge = Math.max(0, Number(amount) || 0)
  const after = balance == null ? null : Math.max(0, Number(balance) - charge)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-earth-900/50 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel?.()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="box-break-purchase-title"
        className="w-full max-w-md rounded-2xl border border-earth-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="box-break-purchase-title" className="font-display text-xl font-semibold text-earth-900">
          {t('collector.purchaseConfirm.title', { defaultValue: 'Confirmar compra' })}
        </h2>
        <p className="mt-2 text-sm text-earth-600">
          {t('collector.purchaseConfirm.body', {
            defaultValue: 'Confirme para debitar os créditos e registrar sua participação.',
          })}
        </p>

        <dl className="mt-4 space-y-3 rounded-xl border border-earth-200 bg-earth-50 p-4 text-sm">
          {productName ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-earth-500">
                {t('collector.purchaseConfirm.product', { defaultValue: 'Box Break' })}
              </dt>
              <dd className="mt-1 font-medium text-earth-900">{productName}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-earth-600">
              {t('collector.purchaseConfirm.quantity', { defaultValue: 'Quantidade' })}
            </dt>
            <dd className="font-semibold tabular-nums text-earth-900">{qty}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-earth-500">
              {t('collector.purchaseConfirm.charge', { defaultValue: 'Total a debitar' })}
            </dt>
            <dd className="mt-1">
              <CreditsAmount amount={charge} variant="compact" />
            </dd>
          </div>
          {after != null ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-earth-600">
                {t('collector.purchaseConfirm.balanceAfter', { defaultValue: 'Saldo depois' })}
              </dt>
              <dd>
                <CreditsInline amount={after} className="font-semibold text-earth-900" />
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-3 text-xs text-earth-500">
          {t('collector.purchaseConfirm.hint', {
            defaultValue: '1 crédito = ¥1. A participação é registrada na hora.',
          })}
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-800 hover:bg-earth-50 disabled:opacity-60"
          >
            {t('collector.purchaseConfirm.cancel', { defaultValue: 'Cancelar' })}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-collector-600 px-4 py-2 text-sm font-medium text-white hover:bg-collector-700 disabled:opacity-60"
          >
            {busy
              ? t('collector.actions.reservingCredits', { defaultValue: 'Debitando créditos...' })
              : t('collector.purchaseConfirm.confirm', { defaultValue: 'Confirmar compra' })}
          </button>
        </div>
      </div>
    </div>
  )
}

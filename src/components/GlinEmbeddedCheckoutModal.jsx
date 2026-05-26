import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

export default function GlinEmbeddedCheckoutModal({
  open,
  checkoutUrl,
  onClose,
  onRefresh,
}) {
  const { t } = useTranslation()

  if (!open || !checkoutUrl) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/55 p-3"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-earth-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-earth-900">Checkout Glin</p>
            <p className="text-xs text-earth-600">
              {t('platform.cart.glinEmbeddedHint', {
                defaultValue: 'Conclua o pagamento no checkout abaixo.',
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-md border border-earth-300 px-3 py-1.5 text-xs font-medium text-earth-700 hover:bg-earth-100"
            >
              {t('platform.cart.refreshData', { defaultValue: 'Atualizar dados' })}
            </button>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-earth-300 px-3 py-1.5 text-xs font-medium text-earth-700 hover:bg-earth-100"
            >
              {t('platform.cart.openNewTab', { defaultValue: 'Abrir em nova aba' })}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-earth-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-earth-800"
            >
              {t('platform.cart.modalClose')}
            </button>
          </div>
        </div>
        <iframe
          src={checkoutUrl}
          title="Glin checkout"
          className="h-full w-full border-0"
          allow="payment *"
        />
      </div>
    </div>,
    document.body
  )
}

import { approveWalletTopupAdmin, rejectWalletTopupAdmin } from '../../../../services/walletService'
import { useSiteLocale } from '../../../../hooks/useSiteLocale'
import { formatJpyForSite } from '../../../../lib/moneyDisplay'
import { useAdminContext } from '../AdminContext'

export default function RecargasSection() {
  const siteLocale = useSiteLocale()
  const {
    activeTab,
    topupLoading,
    topupRequests,
    formatMoney,
    setMessage,
    loadTopupRequests,
  } = useAdminContext()

  if (activeTab !== 'recargas') return null

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Recargas de carteira via PIX</h2>
      <p className="mt-1 text-sm text-earth-600">
        Solicitações pendentes de recarga. Verifique o comprovante e aprove para creditar o saldo.
      </p>
      {topupLoading && <p className="mt-4 text-sm text-earth-600">Carregando...</p>}
      {!topupLoading && topupRequests.length === 0 && (
        <p className="mt-4 text-sm text-earth-600">Nenhuma solicitação pendente.</p>
      )}
      {!topupLoading && topupRequests.length > 0 && (
        <div className="mt-4 space-y-4">
          {topupRequests.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-earth-200 bg-white p-4"
            >
              <div>
                <p className="font-medium text-earth-900">
                  {formatJpyForSite(siteLocale, r.amount_jpy, null)} — {r.user_name || r.user_email || r.user_id?.slice(0, 8) || '—'}
                </p>
                <p className="mt-1 text-sm text-earth-600">
                  {formatMoney(r.amount_brl, 'BRL')} • {r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : ''}
                </p>
                {r.comprovante_url && (
                  <a
                    href={r.comprovante_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-earth-700 underline hover:text-earth-900"
                  >
                    Ver comprovante
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const { error } = await approveWalletTopupAdmin(r.id)
                    if (error) setMessage(error.message)
                    else {
                      setMessage('Recarga aprovada e saldo creditado.')
                      loadTopupRequests()
                    }
                  }}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const { error } = await rejectWalletTopupAdmin(r.id)
                    if (error) setMessage(error.message)
                    else {
                      setMessage('Recarga rejeitada.')
                      loadTopupRequests()
                    }
                  }}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

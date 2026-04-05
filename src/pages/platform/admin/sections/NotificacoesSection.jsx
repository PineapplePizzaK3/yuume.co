import { markNotificationRead } from '../../../../services/notificationService'
import { useAdminContext } from '../AdminContext'

export default function NotificacoesSection() {
  const {
    activeTab,
    loadAdminNotifications,
    adminNotificationsLoading,
    adminNotifications,
    setAdminNotifications,
    setActiveTab,
    openOrderFromAdminNotification,
  } = useAdminContext()

  if (activeTab !== 'notificacoes') return null

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">Notificações do admin</h2>
          <p className="mt-1 text-sm text-earth-600">
            Eventos que exigem ação administrativa (aprovar, orçar, validar comprovante, envio, etc.).
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadAdminNotifications()}
          disabled={adminNotificationsLoading}
          className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
        >
          {adminNotificationsLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {adminNotificationsLoading && (
        <p className="mt-4 text-sm text-earth-600">Carregando notificações...</p>
      )}
      {!adminNotificationsLoading && adminNotifications.length === 0 && (
        <p className="mt-4 text-sm text-earth-600">Nenhuma notificação pendente no momento.</p>
      )}
      {!adminNotificationsLoading && adminNotifications.length > 0 && (
        <div className="mt-4 space-y-3">
          {adminNotifications.map((n) => {
            const isUnread = !n.read_at
            const meta = n.meta || {}
            const requesterLabel = meta.requester_name || meta.requester_email || meta.user_id || null
            const orderId = typeof meta.order_id === 'string' ? meta.order_id : null
            const targetTab = n.type?.includes('topup')
              ? 'recargas'
              : (n.type?.includes('shipment') || n.type?.includes('ready_for_shipment'))
                ? 'envios'
                : 'pedidos'
            return (
              <div
                key={n.id}
                className={`rounded-lg border bg-white p-4 ${isUnread ? 'border-amber-300' : 'border-earth-200'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-earth-900">
                      {isUnread && <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />}
                      <span>{n.title || 'Ação do admin necessária'}</span>
                    </p>
                    {n.body && <p className="mt-1 text-sm text-earth-600">{n.body}</p>}
                    {requesterLabel && (
                      <p className="mt-1 text-xs text-earth-600">
                        Solicitado por: <span className="font-medium text-earth-800">{requesterLabel}</span>
                      </p>
                    )}
                    <p className="mt-1 text-xs text-earth-500">
                      {n.created_at ? new Date(n.created_at).toLocaleString('pt-BR') : '—'}
                    </p>
                    {(meta.order_id || meta.shipment_id || meta.topup_request_id) && (
                      <p className="mt-1 text-xs text-earth-500 font-mono">
                        {meta.order_id ? `pedido=${String(meta.order_id).slice(0, 8)}…` : ''}
                        {meta.shipment_id ? ` envio=${String(meta.shipment_id).slice(0, 8)}…` : ''}
                        {meta.topup_request_id ? ` recarga=${String(meta.topup_request_id).slice(0, 8)}…` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await markNotificationRead(n.id)
                        setAdminNotifications((prev) => prev.map((x) => (
                          x.id === n.id ? { ...x, read_at: x.read_at || new Date().toISOString() } : x
                        )))
                        if (orderId) {
                          setActiveTab('pedidos')
                          await openOrderFromAdminNotification(orderId)
                          return
                        }
                        setActiveTab(targetTab)
                      }}
                      className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800"
                    >
                      {orderId ? 'Abrir pedido' : 'Abrir área'}
                    </button>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={async () => {
                          await markNotificationRead(n.id)
                          setAdminNotifications((prev) => prev.map((x) => (
                            x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x
                          )))
                        }}
                        className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50"
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

import { useAdminContext } from '../AdminContext'

export default function EnviosSection() {
  const {
    activeTab,
    loadShippingPanel,
    shippingPanelLoading,
    shippingPanel,
    ORDER_STATUS_LABELS,
    formatMoney,
    ORDER_STATUS,
    setActiveTab,
    loadOrders,
    openShippingModal,
    handleOrderStatus,
    openOrderEditModal,
    openShipmentFreightModal,
    handleSetShipmentPaid,
    submitting,
    openShipmentShippedModal,
    handleSetShipmentCompleted,
  } = useAdminContext()

  if (activeTab !== 'envios') return null
  const readShippingBreakdown = (order) => {
    const raw = order?.shipping_quote_breakdown
    if (!raw || typeof raw !== 'object') return null
    const base = Number(raw.base_shipping)
    const perItem = Number(raw.redirect_fee_per_item)
    const perItemTotal = Number(raw.redirect_fee_total)
    const itemsCount = Number(raw.items_count)
    const bufferPercent = Number(raw.shipping_buffer_percent)
    const bufferAmount = Number(raw.shipping_buffer_amount)
    const finalTotal = Number(raw.final_total)
    return {
      base: Number.isFinite(base) ? base : 0,
      perItem: Number.isFinite(perItem) ? perItem : 0,
      perItemTotal: Number.isFinite(perItemTotal) ? perItemTotal : 0,
      itemsCount: Number.isFinite(itemsCount) ? itemsCount : 0,
      bufferPercent: Number.isFinite(bufferPercent) ? bufferPercent : 0,
      bufferAmount: Number.isFinite(bufferAmount) ? bufferAmount : 0,
      finalTotal: Number.isFinite(finalTotal) ? finalTotal : null,
      currency: String(raw.currency || order?.shipping_currency || 'JPY'),
    }
  }

  return (
    <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Envios</h2>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => loadShippingPanel()}
          disabled={shippingPanelLoading}
          className="rounded-lg border border-earth-300 px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
        >
          Atualizar
        </button>
      </div>

      {shippingPanelLoading && <p className="mt-4 text-sm text-earth-600">Carregando...</p>}

      {!shippingPanelLoading && (
        <div className="mt-6 space-y-8">
          <div>
            <h3 className="font-medium text-earth-900">Pedidos em fluxo de envio</h3>
            {!shippingPanel.orders || shippingPanel.orders.length === 0 ? (
              <p className="mt-4 text-sm text-earth-500">Nenhum pedido em fluxo de envio.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {shippingPanel.orders.map((o) => (
                  <li key={o.id} className="rounded-lg border border-earth-200 bg-white p-4">
                    {(() => {
                      const shippingBreakdown = readShippingBreakdown(o)
                      if (!shippingBreakdown) return null
                      return (
                        <details className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-earth-700">
                          <summary className="cursor-pointer list-none font-semibold text-earth-900">
                            Resumo do orçamento de envio
                          </summary>
                          <div className="mt-2 space-y-1">
                            <p>
                              Base: {formatMoney(shippingBreakdown.base, shippingBreakdown.currency)} • Taxa/item: {formatMoney(shippingBreakdown.perItem, shippingBreakdown.currency)} x {shippingBreakdown.itemsCount} = {formatMoney(shippingBreakdown.perItemTotal, shippingBreakdown.currency)}
                            </p>
                            <p>
                              Buffer: {shippingBreakdown.bufferPercent}% ({formatMoney(shippingBreakdown.bufferAmount, shippingBreakdown.currency)})
                            </p>
                            {shippingBreakdown.finalTotal != null && (
                              <p className="font-semibold text-earth-900">
                                Total final: {formatMoney(shippingBreakdown.finalTotal, shippingBreakdown.currency)}
                              </p>
                            )}
                          </div>
                        </details>
                      )
                    })()}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="font-medium text-earth-900">Pedido {o.id?.slice(0, 8)}...</span>
                        <span className="ml-2 rounded bg-earth-200 px-2 py-0.5 text-xs text-earth-700">
                          {ORDER_STATUS_LABELS[o.status] ?? o.status}
                        </span>
                        <p className="mt-1 text-sm text-earth-600">
                          {o.user_name || o.user_email || o.user_id} • {o.order_source === 'store' ? 'Loja' : o.service_name || '-'}
                        </p>
                        {o.shipping_cost != null && (
                          <p className="mt-1 text-sm font-medium text-earth-700">
                            Frete: {formatMoney(o.shipping_cost, o.shipping_currency || 'JPY')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(o.status === ORDER_STATUS.READY_FOR_SHIPMENT || o.status === ORDER_STATUS.PRODUCTS_PAID) && (
                          <button
                            type="button"
                            onClick={() => openShippingModal(o)}
                            className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                          >
                            Definir frete
                          </button>
                        )}
                        {o.status === ORDER_STATUS.PAID && (
                          <button
                            type="button"
                            onClick={async () => {
                              await handleOrderStatus(o.id, ORDER_STATUS.SHIPPED)
                              loadShippingPanel()
                            }}
                            className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                          >
                            Marcar enviado
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('pedidos')
                            loadOrders()
                            openOrderEditModal(o)
                          }}
                          className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100"
                        >
                          Editar pedido
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-medium text-earth-900">Solicitacoes de envio</h3>
            {!shippingPanel.shipments || shippingPanel.shipments.length === 0 ? (
              <p className="mt-4 text-sm text-earth-500">Nenhuma solicitacao de envio.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {shippingPanel.shipments.map((s) => {
                  const statusLabels = {
                    requested: 'Solicitado',
                    awaiting_payment: 'Aguardando pagamento',
                    paid: 'Pago',
                    shipped: 'Enviado',
                    completed: 'Finalizado',
                  }
                  const statusLabel = statusLabels[s.status] ?? s.status
                  const hasPaidOrder = Array.isArray(s.order_ids) && shippingPanel.orders?.some(
                    (o) => s.order_ids?.includes(o.id) && o.status === ORDER_STATUS.PAID
                  )
                  const canMarkShipped = s.status === 'paid' || (s.status === 'awaiting_payment' && hasPaidOrder)
                  return (
                    <li key={s.id} className="rounded-lg border border-earth-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="font-medium text-earth-900">Envio {s.id?.slice(0, 8)}...</span>
                          <span className="ml-2 rounded bg-earth-200 px-2 py-0.5 text-xs text-earth-700">
                            {statusLabel}
                          </span>
                          <p className="mt-1 text-sm text-earth-600">
                            {s.user_name || s.user_email || s.user_id}
                          </p>
                          {s.shipping_cost != null && (
                            <p className="mt-1 text-sm font-medium text-earth-700">
                              Frete: {formatMoney(s.shipping_cost, s.shipping_currency || 'JPY')}
                            </p>
                          )}
                          {s.tracking_code && (
                            <p className="mt-1 text-sm text-earth-600">Rastreio: {s.tracking_code}</p>
                          )}
                          {Array.isArray(s.items) && s.items.length > 0 && (
                            <div className="mt-2 text-xs text-earth-500">
                              Itens: {s.items.map((i) => i.inventory_name || i.inventory_id?.slice(0, 8)).filter(Boolean).join(', ')}
                            </div>
                          )}
                          {Array.isArray(s.order_ids) && s.order_ids.length > 0 && (
                            <p className="mt-1 text-xs text-earth-500">
                              Pedidos vinculados: {s.order_ids.filter(Boolean).map((id) => id?.slice(0, 8)).join(', ')}...
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {s.status === 'requested' && (
                            <button
                              type="button"
                              onClick={() => openShipmentFreightModal(s)}
                              className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                            >
                              Definir frete
                            </button>
                          )}
                          {s.status === 'awaiting_payment' && (
                            <button
                              type="button"
                              onClick={() => handleSetShipmentPaid(s.id)}
                              disabled={submitting}
                              className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                            >
                              Marcar como pago
                            </button>
                          )}
                          {canMarkShipped && (
                            <button
                              type="button"
                              onClick={() => openShipmentShippedModal(s)}
                              className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                            >
                              Marcar enviado
                            </button>
                          )}
                          {s.status === 'shipped' && (
                            <button
                              type="button"
                              onClick={() => handleSetShipmentCompleted(s.id)}
                              disabled={submitting}
                              className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-60"
                            >
                              Marcar finalizado
                            </button>
                          )}
                          {Array.isArray(s.order_ids) && s.order_ids.length > 0 && s.status === 'requested' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const ord = shippingPanel.orders?.find((x) => s.order_ids?.includes(x.id))
                                if (ord && (ord.status === ORDER_STATUS.READY_FOR_SHIPMENT || ord.status === ORDER_STATUS.PRODUCTS_PAID)) {
                                  openShippingModal(ord)
                                }
                              }}
                              className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100"
                            >
                              Ver pedidos
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-medium text-earth-900">Itens prontos para envio</h3>
            {!shippingPanel.inventoryReady || shippingPanel.inventoryReady.length === 0 ? (
              <p className="mt-4 text-sm text-earth-500">Nenhum item pronto para envio.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {shippingPanel.inventoryReady.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between rounded border border-earth-100 bg-white px-4 py-2 text-sm">
                    <span className="text-earth-800">{inv.name || inv.id?.slice(0, 8)}</span>
                    <span className="text-earth-600">{inv.user_name || inv.user_email} • Pedido {inv.order_id?.slice(0, 8)}...</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

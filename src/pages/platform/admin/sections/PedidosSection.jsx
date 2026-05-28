import { getUsersAdmin } from '../../../../services/profileService'
import { ORDER_STATUS, ORDER_STATUS_LABELS, approveOrderAdmin, rejectOrderAdmin } from '../../../../services/orderService'
import { logAdminAction } from '../../../../services/logService'
import { parseQuoteMessage, serializeQuoteProducts } from '../../../../lib/quoteProducts'
import QuoteProductsList from '../../../../components/QuoteProductsList'
import { TriCurrencyDisplay } from '../../../../components/TriCurrencyDisplay'
import OrderAttachments from '../../../../components/OrderAttachments'
import { jpyAmountToTri } from '../../../../lib/quoteMoneyTri'
import { useAdminContext } from '../AdminContext'
import { REDIR_ASSISTIDO_FEE_PERCENT, computeAssistedEarlyPrepayDebitJpy } from '../../../../data/serviceFees'

export default function PedidosSection() {
  const {
    activeTab,
    orderStatusFilter,
    setOrderStatusFilter,
    ordersTotalCount,
    orderStatusCounts,
    setUsers,
    setCreateOrderModal,
    services,
    setRegisterPackageModal,
    ordersLoading,
    orders,
    formatOrderModuleLabel,
    formatJPY,
    formatMoney,
    openQuoteModalFromOrder,
    openShippingModal,
    setMessage,
    loadOrders,
    handleOrderStatus,
    openInventoryModal,
    openOrderEditModal,
    handleDeleteOrder,
    PaginationControls,
    ordersPage,
    ordersHasMore,
    setOrdersPage,
    shippingModal,
    setShippingModal,
    handleSetShipping,
    shipmentFreightModal,
    setShipmentFreightModal,
    handleSetShipmentFreight,
    submitting,
    shipmentShippedModal,
    setShipmentShippedModal,
    handleSetShipmentShipped,
    quoteModal,
    setQuoteModal,
    handleSetQuote,
    orderEditModal,
    setOrderEditModal,
    handleSaveOrderEdit,
    closeOrderEditModal,
    inventoryModal,
    setInventoryModal,
    handleAddToInventory,
    createOrderModal,
    handleCreateOrderForUser,
    users,
    registerPackageModal,
    handleRegisterPackage,
    editInventoryModal,
    adminUserFilterTerm,
  } = useAdminContext()

  const orderEditParsedQuote = parseQuoteMessage(orderEditModal.message)
  const parseInventoryProductLines = (rawDescription) => {
    const text = String(rawDescription || '').trim()
    if (!text) return []
    return text
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^\s*(\d+)\s*x\s+(.+?)\s*$/i)
        if (!match) return null
        return {
          quantity: Math.max(1, parseInt(match[1], 10) || 1),
          name: String(match[2] || '').trim(),
        }
      })
      .filter((line) => line && line.name)
  }

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
  const normalizePhoneForWhatsApp = (rawPhone) => {
    const digits = String(rawPhone || '').replace(/\D+/g, '')
    if (!digits) return null
    const normalized = digits.startsWith('00') ? digits.slice(2) : digits
    // wa.me expects international format (country code + number) without symbols.
    if (normalized.length < 10) return null
    return normalized
  }
  const buildWhatsAppLink = (order) => {
    const phone = normalizePhoneForWhatsApp(order?.user_phone)
    if (!phone) return null
    const userLabel = order?.user_name || order?.user_email || 'cliente'
    const orderShortId = String(order?.id || '').slice(0, 8)
    const message = `Olá ${userLabel}, falando sobre seu pedido ${orderShortId} na ddelivery.`
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  }
  const shippingSnapshot = shippingModal.orderSnapshot || null
  const shippingItems = Array.isArray(shippingSnapshot?.parsedProducts) ? shippingSnapshot.parsedProducts : []
  const shippingItemsCount = Math.max(
    0,
    Number(
      shippingSnapshot?.itemsCount ??
        shippingItems.reduce((acc, item) => acc + Math.max(1, parseInt(item?.quantidade, 10) || 1), 0)
    ) || 0
  )
  const baseShipping = Math.max(0, parseFloat(shippingModal.cost || '0') || 0)
  const redirectFeePerItem = Math.max(0, parseFloat(shippingModal.redirectFeePerItem || '0') || 0)
  const shippingBufferPercent = Math.max(0, parseFloat(shippingModal.shippingBufferPercent || '0') || 0)
  const redirectFeeTotal = redirectFeePerItem * shippingItemsCount
  const shippingBufferAmount = baseShipping * (shippingBufferPercent / 100)
  const finalShippingTotal = baseShipping + redirectFeeTotal + shippingBufferAmount

  const shipmentSnapshot = shipmentFreightModal.snapshot || null
  const shipmentParsedItems = Array.isArray(shipmentSnapshot?.parsedProducts)
    ? shipmentSnapshot.parsedProducts
    : []
  const shipmentItemsCount = Math.max(
    0,
    Number(
      shipmentSnapshot?.itemsCount ??
        shipmentParsedItems.reduce(
          (acc, item) => acc + Math.max(1, parseInt(item?.quantidade, 10) || 1),
          0
        )
    ) || 0
  )
  const shipmentBase = Math.max(0, parseFloat(shipmentFreightModal.cost || '0') || 0)
  const shipmentRedirectPerItem = Math.max(0, parseFloat(shipmentFreightModal.redirectFeePerItem || '0') || 0)
  const shipmentBufferPct = Math.max(0, parseFloat(shipmentFreightModal.shippingBufferPercent || '0') || 0)
  const shipmentRedirectTotal = shipmentRedirectPerItem * shipmentItemsCount
  const shipmentBufferAmt = shipmentBase * (shipmentBufferPct / 100)
  const shipmentFinalTotal = shipmentBase + shipmentRedirectTotal + shipmentBufferAmt

  const hasGlobalModalOpen =
    shippingModal.open ||
    shipmentFreightModal.open ||
    shipmentShippedModal.open ||
    quoteModal.open ||
    orderEditModal.open ||
    inventoryModal.open ||
    createOrderModal.open ||
    registerPackageModal.open ||
    editInventoryModal.open
  const includeByUser = (order) => {
    if (!adminUserFilterTerm) return true
    const haystack = [order?.user_name, order?.user_email, order?.user_id]
      .map((v) => String(v || '').toLowerCase())
      .join(' ')
    return haystack.includes(adminUserFilterTerm)
  }
  const ordersForList = orders.filter(includeByUser)
  const selectedEditService = services.find((s) => String(s.id) === String(orderEditModal.service_id || ''))
  const selectedEditServiceName = String(selectedEditService?.name || '').trim().toLowerCase()
  const isOrderEditRedirection =
    selectedEditServiceName === 'redirecionamento' ||
    orderEditModal.order_module === 'self_buy' ||
    orderEditModal.order_module === 'assisted_buy'

  if (activeTab !== 'pedidos' && !hasGlobalModalOpen) return null

  return (
    <>
      {activeTab === 'pedidos' && (
        <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
      <h2 className="text-lg font-semibold text-earth-900">Pedidos</h2>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-earth-500">
          <span>Filtrar por status:</span>
          {orderStatusFilter.length > 0 && (
            <button
              onClick={() => setOrderStatusFilter([])}
              className="text-xs text-earth-400 underline hover:text-earth-600"
            >
              Limpar filtro
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setOrderStatusFilter([])}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              orderStatusFilter.length === 0
                ? 'border-earth-900 bg-earth-900 text-white'
                : 'border-earth-200 bg-white text-earth-700 hover:bg-earth-50'
            }`}
          >
            Todos ({ordersTotalCount})
          </button>

          {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => {
            const isSelected = orderStatusFilter.includes(key)
            const count = orderStatusCounts[key] || 0
            return (
              <button
                key={key}
                onClick={() => {
                  if (isSelected) {
                    setOrderStatusFilter((prev) => prev.filter((s) => s !== key))
                  } else {
                    setOrderStatusFilter((prev) => [...prev, key])
                  }
                }}
                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? 'border-earth-700 bg-earth-700 text-white'
                    : 'border-earth-200 bg-white text-earth-700 hover:bg-earth-50'
                }`}
              >
                {label} ({count})
                {isSelected && <span className="text-[10px] opacity-75">✓</span>}
              </button>
            )
          })}
        </div>
        {orderStatusFilter.length > 0 && (
          <p className="mt-2 text-xs text-earth-500">
            Mostrando {orderStatusFilter.length} status selecionado{orderStatusFilter.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            const { data } = await getUsersAdmin(2000, 0)
            setUsers(data ?? [])
            setCreateOrderModal({ open: true, user_id: '', service_id: services[0]?.id ?? '', message: '' })
          }}
          className="rounded-lg bg-earth-800 px-3 py-2 text-sm font-medium text-white hover:bg-earth-900"
        >
          Criar pedido para usuário
        </button>
        <button
          type="button"
          onClick={async () => {
            const { data } = await getUsersAdmin(2000, 0)
            setUsers(data ?? [])
            setRegisterPackageModal({
              open: true,
              user_id: '',
              products: [{ name: '', quantity: '', price: '' }],
              order_id: '',
              weight_kg: '',
              photo_url: '',
              video_url: '',
            })
          }}
          className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          Registrar pacote
        </button>
      </div>
      {ordersLoading && <p className="mt-4 text-sm text-earth-600">Carregando pedidos...</p>}
      {!ordersLoading && ordersForList.length === 0 && (
        <p className="mt-4 text-sm text-earth-600">Nenhum pedido ainda.</p>
      )}
      {!ordersLoading && ordersForList.length > 0 && (
        <div className="mt-4 space-y-4">
          {ordersForList.map((o) => (
            <div key={o.id} className="rounded-lg border border-earth-200 bg-white p-4">
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
                    {o.user_name || o.user_email || o.user_id} • {o.service_name || o.order_source === 'store' ? 'Loja' : '-'}
                  </p>
                  {formatOrderModuleLabel(o) && (
                    <p className="mt-1">
                      <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {formatOrderModuleLabel(o)}
                      </span>
                    </p>
                  )}
                  {o.early_prepayment_requested && (() => {
                    const walletJpy =
                      o.early_prepayment_wallet_jpy != null && Number(o.early_prepayment_wallet_jpy) > 0
                        ? Number(o.early_prepayment_wallet_jpy)
                        : 0
                    const declaredRaw = o.early_prepayment_declared_products_jpy
                    const declaredJpy =
                      declaredRaw != null && Number(declaredRaw) > 0 ? Math.floor(Number(declaredRaw)) : null
                    const breakdown =
                      declaredJpy != null ? computeAssistedEarlyPrepayDebitJpy(declaredJpy) : null
                    const feeJpy =
                      walletJpy > 0 && declaredJpy != null
                        ? breakdown && breakdown.totalDebitJpy === walletJpy
                          ? breakdown.feeJpy
                          : Math.max(0, walletJpy - declaredJpy)
                        : 0
                    return (
                      <p className="mt-1">
                        <span className="inline-flex flex-wrap items-center gap-x-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                          <span>Pré-pagamento antecipado (ex.: flea market)</span>
                          {walletJpy > 0 && declaredJpy != null && (
                            <span className="text-emerald-950">
                              · produtos {formatJPY(declaredJpy)} · taxa {REDIR_ASSISTIDO_FEE_PERCENT}%{' '}
                              {formatJPY(feeJpy)} · total carteira {formatJPY(walletJpy)}
                            </span>
                          )}
                          {walletJpy > 0 && declaredJpy == null && (
                            <span className="text-emerald-950">· carteira {formatJPY(walletJpy)}</span>
                          )}
                        </span>
                      </p>
                    )
                  })()}
                  {o.message && (
                    <QuoteProductsList
                      message={o.message}
                      quoteCurrency={o.quote_currency || 'JPY'}
                      formatMoney={formatMoney}
                      orderModule={o.order_module}
                    />
                  )}
                  {Array.isArray(o.attachment_urls) && o.attachment_urls.length > 0 && (
                    <OrderAttachments urls={o.attachment_urls} maxThumbnails={8} />
                  )}
                  {o.quote_amount != null && (
                    <p className="mt-1 text-sm font-medium text-earth-700">
                      Orçamento: {formatMoney(o.quote_amount, o.quote_currency || 'JPY')}
                    </p>
                  )}
                  {o.total_amount != null && (
                    <p className="mt-1 text-sm font-medium text-earth-700">
                      Total produtos: {formatMoney(o.total_amount, 'BRL')}
                    </p>
                  )}
                  {o.shipping_cost != null && (
                    <p className="mt-1 text-sm font-medium text-earth-700">
                      Frete: {formatMoney(o.shipping_cost, o.shipping_currency || 'JPY')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const userEmail = String(o?.user_email || '').trim()
                    const whatsappLink = buildWhatsAppLink(o)
                    return (
                      <>
                        {userEmail && (
                          <a
                            href={`mailto:${userEmail}`}
                            className="rounded border border-sky-300 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-50"
                          >
                            E-mail
                          </a>
                        )}
                        {whatsappLink && (
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            WhatsApp
                          </a>
                        )}
                      </>
                    )
                  })()}
                  {o.status === ORDER_STATUS.AWAITING_QUOTE && (
                    <button
                      type="button"
                      onClick={() => openQuoteModalFromOrder(o)}
                      className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Definir orçamento
                    </button>
                  )}
                  {o.status !== ORDER_STATUS.AWAITING_QUOTE &&
                    o.order_module === 'assisted_buy' &&
                    o.status !== ORDER_STATUS.COMPLETED &&
                    o.status !== ORDER_STATUS.REJECTED && (
                      <button
                        type="button"
                        onClick={() => openQuoteModalFromOrder(o)}
                        className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                      >
                        Definir orçamento
                      </button>
                    )}
                  {o.status === ORDER_STATUS.PRODUCTS_PAID && (
                    <button
                      type="button"
                      onClick={() => openShippingModal(o)}
                      className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                    >
                      Definir frete
                    </button>
                  )}
                  {o.status === ORDER_STATUS.APPROVED && (
                    <button
                      type="button"
                      onClick={async () => {
                        const { data } = await getUsersAdmin(2000, 0)
                        setUsers(data ?? [])
                        setRegisterPackageModal({
                          open: true,
                          user_id: o.user_id ?? '',
                          products: [{ name: o.message ? o.message.substring(0, 60) : 'Produto do pedido', quantity: '1', price: '' }],
                          order_id: o.id ?? '',
                          weight_kg: '',
                          photo_url: '',
                          video_url: '',
                        })
                      }}
                      className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Registrar pacote
                    </button>
                  )}
                  {o.status === ORDER_STATUS.PENDING_APPROVAL && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          const { error } = await approveOrderAdmin(o.id)
                          setMessage(error ? error.message : 'Pedido aprovado.')
                          if (!error) {
                            logAdminAction('order_approve', 'order', o.id)
                            loadOrders()
                          }
                        }}
                        className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const reason = prompt('Motivo da rejeição (opcional):')
                          const { error } = await rejectOrderAdmin(o.id, reason || undefined)
                          setMessage(error ? error.message : 'Pedido rejeitado.')
                          if (!error) {
                            logAdminAction('order_reject', 'order', o.id, { reason })
                            loadOrders()
                          }
                        }}
                        className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                  {o.status === ORDER_STATUS.AWAITING_ARRIVAL && (
                    <button
                      type="button"
                      onClick={() => handleOrderStatus(o.id, ORDER_STATUS.ITEM_RECEIVED)}
                      className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                    >
                      Item recebido
                    </button>
                  )}
                  {o.status === ORDER_STATUS.ITEM_RECEIVED && (
                    <>
                      <button
                        type="button"
                        onClick={() => openInventoryModal(o)}
                        className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                      >
                        Adicionar ao inventário
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOrderStatus(o.id, ORDER_STATUS.STORED)}
                        className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                      >
                        Armazenado
                      </button>
                    </>
                  )}
                  {o.status === ORDER_STATUS.STORED && (
                    <button
                      type="button"
                      onClick={() => handleOrderStatus(o.id, ORDER_STATUS.READY_FOR_SHIPMENT)}
                      className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                    >
                      Pronto para envio
                    </button>
                  )}
                  {o.status === ORDER_STATUS.READY_FOR_SHIPMENT && (
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
                      onClick={() => handleOrderStatus(o.id, ORDER_STATUS.SHIPPED)}
                      className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                    >
                      Marcar enviado
                    </button>
                  )}
                  {o.status === ORDER_STATUS.SHIPPED && (
                    <button
                      type="button"
                      onClick={() => handleOrderStatus(o.id, ORDER_STATUS.COMPLETED)}
                      className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                    >
                      Finalizado
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openOrderEditModal(o)}
                    className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100"
                  >
                    Editar pedido
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteOrder(o.id)}
                    className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Remover pedido
                  </button>
                </div>
              </div>
            </div>
          ))}
          <PaginationControls
            page={ordersPage}
            hasMore={ordersHasMore}
            loading={ordersLoading}
            onPrev={() => setOrdersPage((p) => Math.max(0, p - 1))}
            onNext={() => setOrdersPage((p) => p + 1)}
          />
        </div>
      )}
      </section>
      )}

      {shippingModal.open && (
        <form onSubmit={handleSetShipping} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-earth-900">Orçamento de envio</h3>
            <p className="mt-1 text-sm text-earth-600">
              Monte a composição do envio com taxas por item, buffer e detalhamento para referência.
            </p>

            {shippingSnapshot && (
              <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-earth-700">
                  <span className="font-medium">Pedido {shippingSnapshot.id?.slice(0, 8)}...</span>
                  <span>•</span>
                  <span>{shippingSnapshot.user_name || shippingSnapshot.user_email || shippingSnapshot.user_id}</span>
                  <span>•</span>
                  <span>{shippingSnapshot.service_name || shippingSnapshot.order_source || '-'}</span>
                </div>
                {shippingSnapshot.message && (
                  <p className="mt-2 text-xs text-earth-600 line-clamp-3">{shippingSnapshot.message}</p>
                )}
              </div>
            )}

            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-earth-700">Valor (¥)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={shippingModal.cost}
                  onChange={(e) => setShippingModal((m) => ({ ...m, cost: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
              </div>
                <div>
                  <label className="block text-sm font-medium text-earth-700">Taxa de redirecionamento por item (¥)</label>
                  <p className="mt-1 text-xs text-earth-500">
                    Valor inicial pela quantidade de itens: 1 → ¥1.000; 2–4 → ¥750; 5+ → ¥500 (editável). Com orçamento já salvo no pedido, reabre com os valores gravados.
                  </p>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shippingModal.redirectFeePerItem}
                    onChange={(e) => setShippingModal((m) => ({ ...m, redirectFeePerItem: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-earth-700">% Buffer sobre frete</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shippingModal.shippingBufferPercent}
                    onChange={(e) => setShippingModal((m) => ({ ...m, shippingBufferPercent: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div className="rounded-lg border border-earth-200 bg-earth-50 p-3 text-sm text-earth-700">
                  <p>Itens: <strong>{shippingItemsCount}</strong></p>
                  <p>Frete base: <strong>{formatJPY(baseShipping)}</strong></p>
                  <p>Taxa por item: <strong>{formatJPY(redirectFeeTotal)}</strong></p>
                  <p>Buffer: <strong>{formatJPY(shippingBufferAmount)}</strong></p>
                  <p className="mt-1 text-base font-semibold text-earth-900">
                    Total final ao cliente: {formatJPY(finalShippingTotal)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-earth-200 p-3">
                  <h4 className="text-sm font-semibold text-earth-900">Detalhamento de itens</h4>
                  {shippingItems.length === 0 ? (
                    <p className="mt-2 text-xs text-earth-600">Sem itens estruturados no pedido.</p>
                  ) : (
                    <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                      {shippingItems.map((item, idx) => {
                        const qty = Math.max(1, parseInt(item?.quantidade, 10) || 1)
                        const unit = parseFloat(item?.valor) || 0
                        const subtotal = unit * qty
                        return (
                          <li key={`${item?.name || 'item'}-${idx}`} className="rounded border border-earth-100 bg-earth-50 p-2 text-xs text-earth-700">
                            <p className="font-medium text-earth-900">{item?.name || `Item ${idx + 1}`}</p>
                            <p>Qtd: {qty} • Unitário: {formatJPY(unit)} • Subtotal: {formatJPY(subtotal)}</p>
                            {item?.descricao && <p className="text-earth-600">{item.descricao}</p>}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
                {Array.isArray(shippingSnapshot?.attachment_urls) && shippingSnapshot.attachment_urls.length > 0 && (
                  <div className="rounded-lg border border-earth-200 p-3">
                    <h4 className="text-sm font-semibold text-earth-900">Fotos/arquivos do pedido</h4>
                    <div className="mt-2">
                      <OrderAttachments urls={shippingSnapshot.attachment_urls} maxThumbnails={8} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button type="submit" className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800">
                Definir e notificar
              </button>
              <button
                type="button"
                onClick={() =>
                  setShippingModal({
                    open: false,
                    orderId: null,
                    cost: '',
                    currency: 'JPY',
                    redirectFeePerItem: '',
                    shippingBufferPercent: '',
                    orderSnapshot: null,
                  })
                }
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {shipmentFreightModal.open && (
        <form onSubmit={handleSetShipmentFreight} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-earth-900">Orçamento de envio (solicitação de envio)</h3>
            <p className="mt-1 text-sm text-earth-600">
              Mesma composição do frete por pedido: base, taxa por item, buffer e referência dos pacotes.
            </p>

            {shipmentSnapshot && (
              <div className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-earth-700">
                  <span className="font-medium">Envio {shipmentSnapshot.shipmentId?.slice(0, 8)}...</span>
                  <span>•</span>
                  <span>{shipmentSnapshot.user_name || shipmentSnapshot.user_email || shipmentSnapshot.user_id}</span>
                </div>
                {Array.isArray(shipmentSnapshot.order_ids) && shipmentSnapshot.order_ids.length > 0 && (
                  <p className="mt-2 text-xs text-earth-600">
                    Pedidos vinculados:{' '}
                    {shipmentSnapshot.order_ids
                      .filter(Boolean)
                      .map((id) => id?.slice(0, 8))
                      .join(', ')}
                    …
                  </p>
                )}
                {shipmentSnapshot.message && (
                  <p className="mt-2 text-xs text-earth-600 line-clamp-4">{shipmentSnapshot.message}</p>
                )}
              </div>
            )}

            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-earth-700">Frete base (¥)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={shipmentFreightModal.cost}
                    onChange={(e) => setShipmentFreightModal((m) => ({ ...m, cost: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-earth-700">Taxa de redirecionamento por item (¥)</label>
                  <p className="mt-1 text-xs text-earth-500">
                    Valor inicial pela quantidade de itens: 1 → ¥1.000; 2–4 → ¥750; 5+ → ¥500 (editável).
                  </p>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shipmentFreightModal.redirectFeePerItem}
                    onChange={(e) => setShipmentFreightModal((m) => ({ ...m, redirectFeePerItem: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-earth-700">% Buffer sobre frete base</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shipmentFreightModal.shippingBufferPercent}
                    onChange={(e) => setShipmentFreightModal((m) => ({ ...m, shippingBufferPercent: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                <div className="rounded-lg border border-earth-200 bg-earth-50 p-3 text-sm text-earth-700">
                  <p>
                    Itens (contagem p/ taxa): <strong>{shipmentItemsCount}</strong>
                  </p>
                  <p>
                    Frete base: <strong>{formatJPY(shipmentBase)}</strong>
                  </p>
                  <p>
                    Taxa por item: <strong>{formatJPY(shipmentRedirectTotal)}</strong>
                  </p>
                  <p>
                    Buffer: <strong>{formatJPY(shipmentBufferAmt)}</strong>
                  </p>
                  <p className="mt-1 text-base font-semibold text-earth-900">
                    Total final ao cliente: {formatJPY(shipmentFinalTotal)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-earth-200 p-3">
                  <h4 className="text-sm font-semibold text-earth-900">Detalhamento</h4>
                  {shipmentParsedItems.length > 0 ? (
                    <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                      {shipmentParsedItems.map((item, idx) => {
                        const qty = Math.max(1, parseInt(item?.quantidade, 10) || 1)
                        const unit = parseFloat(item?.valor) || 0
                        const subtotal = unit * qty
                        return (
                          <li
                            key={`${item?.name || 'item'}-${idx}`}
                            className="rounded border border-earth-100 bg-earth-50 p-2 text-xs text-earth-700"
                          >
                            <p className="font-medium text-earth-900">{item?.name || `Item ${idx + 1}`}</p>
                            <p>
                              Qtd: {qty} • Unitário: {formatJPY(unit)} • Subtotal: {formatJPY(subtotal)}
                            </p>
                            {item?.descricao && <p className="text-earth-600">{item.descricao}</p>}
                          </li>
                        )
                      })}
                    </ul>
                  ) : Array.isArray(shipmentSnapshot?.inventoryLines) && shipmentSnapshot.inventoryLines.length > 0 ? (
                    <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                      {shipmentSnapshot.inventoryLines.map((row, idx) => (
                        <li
                          key={row.inventory_id || idx}
                          className="rounded border border-earth-100 bg-earth-50 p-2 text-xs text-earth-700"
                        >
                          <p className="font-medium text-earth-900">
                            {row.inventory_name || row.inventory_id?.slice(0, 8) || `Pacote ${idx + 1}`}
                          </p>
                          {row.order_id && (
                            <p className="text-earth-600">Pedido {String(row.order_id).slice(0, 8)}…</p>
                          )}
                          {row.weight_kg != null && Number(row.weight_kg) > 0 && (
                            <p>Peso: {row.weight_kg} kg</p>
                          )}
                          {parseInventoryProductLines(row.products_description).length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-earth-600">
                              {parseInventoryProductLines(row.products_description).map((line, lineIdx) => (
                                <li key={`${row.inventory_id || idx}-line-${lineIdx}`}>
                                  {line.name} {line.quantity > 1 ? `x${line.quantity}` : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-earth-600">Sem pacotes listados no envio.</p>
                  )}
                </div>
                {Array.isArray(shipmentSnapshot?.attachment_urls) && shipmentSnapshot.attachment_urls.length > 0 && (
                  <div className="rounded-lg border border-earth-200 p-3">
                    <h4 className="text-sm font-semibold text-earth-900">Fotos/arquivos do pedido</h4>
                    <div className="mt-2">
                      <OrderAttachments urls={shipmentSnapshot.attachment_urls} maxThumbnails={8} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
              >
                {submitting ? 'Salvando...' : 'Definir e notificar'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setShipmentFreightModal({
                    open: false,
                    shipmentId: null,
                    cost: '',
                    currency: 'JPY',
                    redirectFeePerItem: '',
                    shippingBufferPercent: '',
                    snapshot: null,
                  })
                }
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {shipmentShippedModal.open && (
        <form onSubmit={handleSetShipmentShipped} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-earth-900">Marcar envio como enviado</h3>
            <input
              type="text"
              value={shipmentShippedModal.trackingCode}
              onChange={(e) => setShipmentShippedModal((m) => ({ ...m, trackingCode: e.target.value }))}
              placeholder="Ex: RR123456789JP"
              className="mt-3 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
            />
            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
              >
                {submitting ? 'Salvando...' : 'Marcar enviado'}
              </button>
              <button
                type="button"
                onClick={() => setShipmentShippedModal({ open: false, shipmentId: null, trackingCode: '' })}
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {quoteModal.open && (
        <form onSubmit={handleSetQuote} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-earth-900">
              Definir orçamento {quoteModal.orderModule === 'assisted_buy' ? '(Redirecionamento Assistido)' : '(Personal Shopping)'}
            </h3>
            <div className="mt-4 space-y-4">
              <textarea
                value={quoteModal.orderDescription}
                onChange={(e) => setQuoteModal((m) => ({ ...m, orderDescription: e.target.value }))}
                rows={2}
                placeholder="Mensagem/pedido do cliente..."
                className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
              />
              {quoteModal.products.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-earth-200 bg-earth-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-earth-700">Produto {idx + 1}</span>
                    {quoteModal.products.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setQuoteModal((m) => ({ ...m, products: m.products.filter((_, i) => i !== idx) }))}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) =>
                        setQuoteModal((m) => ({
                          ...m,
                          products: m.products.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)),
                        }))
                      }
                      placeholder="Nome"
                      className="sm:col-span-2 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                    <div className="space-y-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.valor}
                        onChange={(e) =>
                          setQuoteModal((m) => ({
                            ...m,
                            products: m.products.map((p, i) => (i === idx ? { ...p, valor: e.target.value } : p)),
                          }))
                        }
                        placeholder="Valor (¥)"
                        className="w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                      />
                      {(() => {
                        const tri = jpyAmountToTri(parseFloat(item.valor))
                        if (!tri) return null
                        return (
                          <TriCurrencyDisplay
                            brl={tri.brl}
                            jpy={tri.jpy}
                            usd={tri.usd}
                            variant="compact"
                            primary="jpy"
                          />
                        )
                      })()}
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={item.quantidade ?? 1}
                      onChange={(e) =>
                        setQuoteModal((m) => ({
                          ...m,
                          products: m.products.map((p, i) => (i === idx ? { ...p, quantidade: e.target.value } : p)),
                        }))
                      }
                      placeholder="Qtd"
                      className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setQuoteModal((m) => ({ ...m, products: [...m.products, { name: '', valor: '', quantidade: 1, descricao: '' }] }))
                }
                className="w-full rounded-lg border-2 border-dashed border-earth-300 py-2 text-sm font-medium text-earth-600 hover:border-earth-400 hover:bg-earth-50"
              >
                + Adicionar produto
              </button>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {submitting ? 'Enviando...' : 'Definir orçamento'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setQuoteModal({
                    open: false,
                    orderId: null,
                    orderDescription: '',
                    products: [{ name: '', valor: '', quantidade: 1, descricao: '' }],
                    currency: 'JPY',
                    orderModule: 'personal_shopping',
                  })
                }
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {orderEditModal.open && (
        <form onSubmit={handleSaveOrderEdit} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-earth-900">Editar pedido</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                value={orderEditModal.service_id}
                onChange={(e) => {
                  const nextServiceId = e.target.value
                  const nextService = services.find((s) => String(s.id) === String(nextServiceId))
                  const nextServiceName = String(nextService?.name || '').trim().toLowerCase()
                  const isRedirectionService = nextServiceName === 'redirecionamento'
                  setOrderEditModal((m) => ({
                    ...m,
                    service_id: nextServiceId,
                    order_module: isRedirectionService
                      ? (m.order_module === 'assisted_buy' ? 'assisted_buy' : 'self_buy')
                      : null,
                  }))
                }}
                className="rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              >
                <option value="">Sem serviço</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={orderEditModal.status}
                onChange={(e) => setOrderEditModal((m) => ({ ...m, status: e.target.value }))}
                className="rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              >
                {Object.values(ORDER_STATUS).map((status) => (
                  <option key={status} value={status}>
                    {ORDER_STATUS_LABELS[status] ?? status}
                  </option>
                ))}
              </select>
              {isOrderEditRedirection && (
                <select
                  value={orderEditModal.order_module || 'self_buy'}
                  onChange={(e) =>
                    setOrderEditModal((m) => {
                      const nextModule = e.target.value
                      const shouldMoveToQuote =
                        nextModule === 'assisted_buy' &&
                        [ORDER_STATUS.PENDING_APPROVAL, ORDER_STATUS.APPROVED, ORDER_STATUS.REJECTED].includes(m.status)
                      return {
                        ...m,
                        order_module: nextModule,
                        status: shouldMoveToQuote ? ORDER_STATUS.AWAITING_QUOTE : m.status,
                      }
                    })
                  }
                  className="rounded-lg border border-earth-300 px-3 py-2 text-earth-900 sm:col-span-2"
                >
                  <option value="self_buy">Redirecionamento · Padrão</option>
                  <option value="assisted_buy">Redirecionamento · Assistido</option>
                </select>
              )}
            </div>
            <div className="mt-3">
              {orderEditParsedQuote ? (
                <>
                  <QuoteProductsList
                    message={orderEditModal.message}
                    quoteCurrency="JPY"
                    formatMoney={formatMoney}
                    orderModule={orderEditModal.order_module}
                  />
                  <textarea
                    value={orderEditParsedQuote.orderDescription ?? ''}
                    onChange={(e) =>
                      setOrderEditModal((m) => ({
                        ...m,
                        message: serializeQuoteProducts(orderEditParsedQuote.products, e.target.value),
                      }))
                    }
                    rows={3}
                    className="mt-2 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </>
              ) : (
                <textarea
                  value={orderEditModal.message}
                  onChange={(e) => setOrderEditModal((m) => ({ ...m, message: e.target.value }))}
                  rows={3}
                  className="mt-2 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button
                type="button"
                onClick={closeOrderEditModal}
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {inventoryModal.open && (
        <form onSubmit={handleAddToInventory} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-earth-900">Adicionar ao inventário do usuário</h3>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                required
                value={inventoryModal.name}
                onChange={(e) => setInventoryModal((m) => ({ ...m, name: e.target.value }))}
                className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                placeholder="Nome do item"
              />
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {submitting ? 'Adicionando...' : 'Adicionar ao inventário'}
              </button>
              <button
                type="button"
                onClick={() => setInventoryModal((m) => ({ ...m, open: false }))}
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {createOrderModal.open && (
        <form onSubmit={handleCreateOrderForUser} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-earth-900">Criar pedido para usuário</h3>
            <div className="mt-4 space-y-3">
              <select
                required
                value={createOrderModal.user_id}
                onChange={(e) => setCreateOrderModal((m) => ({ ...m, user_id: e.target.value }))}
                className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              >
                <option value="">Selecione</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email} {u.account_code ? `(${u.account_code})` : ''}
                  </option>
                ))}
              </select>
              <select
                value={createOrderModal.service_id}
                onChange={(e) => setCreateOrderModal((m) => ({ ...m, service_id: e.target.value }))}
                className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              >
                <option value="">Sem serviço</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <textarea
                value={createOrderModal.message}
                onChange={(e) => setCreateOrderModal((m) => ({ ...m, message: e.target.value }))}
                rows={2}
                className="block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              />
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
              >
                {submitting ? 'Criando...' : 'Criar pedido'}
              </button>
              <button
                type="button"
                onClick={() => setCreateOrderModal((m) => ({ ...m, open: false }))}
                className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {registerPackageModal.open && (
        <form onSubmit={handleRegisterPackage} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-earth-900">Registrar pacote na conta do usuário</h3>
            <p className="mt-1 text-sm text-earth-500">Adicione os produtos recebidos</p>
            <div className="mt-6 space-y-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-earth-700">Usuário *</label>
                <select
                  required
                  value={registerPackageModal.user_id}
                  onChange={(e) => setRegisterPackageModal((m) => ({ ...m, user_id: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                >
                  <option value="">Selecione um usuário</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} {u.account_code ? `(${u.account_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-earth-700">Produtos recebidos</label>
                <button
                  type="button"
                  onClick={() =>
                    setRegisterPackageModal((m) => ({ ...m, products: [...m.products, { name: '', quantity: '', price: '' }] }))
                  }
                  className="rounded-full bg-earth-100 px-3 py-1 text-xs text-earth-700 hover:bg-earth-200"
                >
                  + Adicionar produto
                </button>
              </div>
              <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
                {registerPackageModal.products.map((product, index) => (
                  <div key={index} className="flex items-start gap-3 rounded-xl bg-earth-50 p-4">
                    <input
                      type="text"
                      placeholder="Nome do produto"
                      value={product.name}
                      onChange={(e) => {
                        const newProducts = [...registerPackageModal.products]
                        newProducts[index].name = e.target.value
                        setRegisterPackageModal((m) => ({ ...m, products: newProducts }))
                      }}
                      className="flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                    <input
                      type="number"
                      placeholder="Qtd"
                      min="1"
                      value={product.quantity}
                      onChange={(e) => {
                        const newProducts = [...registerPackageModal.products]
                        newProducts[index].quantity = e.target.value
                        setRegisterPackageModal((m) => ({ ...m, products: newProducts }))
                      }}
                      className="w-24 rounded-lg border border-earth-300 px-3 py-2 text-center text-earth-900"
                    />
                    <input
                      type="number"
                      placeholder="Preço"
                      min="0"
                      step="0.01"
                      value={product.price}
                      onChange={(e) => {
                        const newProducts = [...registerPackageModal.products]
                        newProducts[index].price = e.target.value
                        setRegisterPackageModal((m) => ({ ...m, products: newProducts }))
                      }}
                      className="w-28 rounded-lg border border-earth-300 px-3 py-2 text-right text-earth-900"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-3 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {submitting ? 'Registrando pacote...' : 'Registrar pacote'}
              </button>
              <button
                type="button"
                onClick={() => setRegisterPackageModal((m) => ({ ...m, open: false }))}
                className="rounded-lg border border-earth-300 px-8 py-3 font-medium text-earth-700 hover:bg-earth-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  )
}

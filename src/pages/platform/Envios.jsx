/**
 * Envios — acompanhamento + solicitação de envio.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { useFormatPrice } from '../../hooks/useFormatPrice'
import { PageSeo } from '../../components/PageSeo'
import { getAddresses } from '../../services/addressService'
import { getMyInventory, getMyShipments, cancelShipment, createShipment, getShipmentItems } from '../../services/inventoryService'
import CustomsDeclarationForm from '../../components/CustomsDeclarationForm'
import { cacheKey, readCache, writeCache } from '../../lib/cache'
import { formatBRL, formatWeight, jpyToBrl } from '../../lib/fx'
import LoungeShippingOrdersSection from './LoungeShippingOrdersSection'

/** Em andamento até o cliente receber em casa (exclui finalizado). */
const SHIPMENT_IN_PROCESS_STATUSES = ['requested', 'awaiting_payment', 'paid', 'shipped']
const SHIPMENTS_PAGE_SIZE = 12
const REQUEST_INVENTORY_PAGE_SIZE = 200

const EXTRA_SERVICE_DEFS = [
  {
    categoryId: 'visual',
    items: [
      { id: 'photos', precoJpy: 500 },
      { id: 'video', precoJpy: 800 },
    ],
  },
  {
    categoryId: 'packaging',
    items: [
      { id: 'remove_packaging', precoJpy: 0 },
      { id: 'bubble_wrap_inside', precoJpy: 300 },
      { id: 'bubble_wrap_outside', precoJpy: 300 },
    ],
  },
  {
    categoryId: 'urgent',
    items: [
      { id: 'urgent_priority_queue', precoJpy: 1500 },
      { id: 'urgent_dispatch_48h', precoJpy: 3000 },
    ],
  },
]

function shipmentStatusLabel(t, status) {
  if (!status) return '—'
  return t(`platform.shipments.status.${status}`, { defaultValue: status })
}

function parseInventoryProductLines(rawDescription) {
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
    .filter((row) => row && row.name)
}

export default function Envios() {
  const { t } = useTranslation()
  const siteLocale = useSiteLocale()
  const fp = useFormatPrice()
  const dateLocale = siteLocale === 'en' ? 'en-US' : 'pt-BR'
  const lp = useLocalizedPath()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const envSubRaw = searchParams.get('envSub')

  const enviosSubTabs = useMemo(
    () => [
      { id: 'processo', label: t('platform.shipments.subTabProcess') },
      { id: 'recebidos', label: t('platform.shipments.subTabDelivered') },
    ],
    [t],
  )

  const requestSteps = useMemo(
    () => [
      { id: 1, title: t('platform.shipments.step1Title') },
      { id: 2, title: t('platform.shipments.step2Title') },
      { id: 3, title: t('platform.shipments.step3Title') },
      { id: 4, title: t('platform.shipments.step4Title') },
    ],
    [t],
  )

  const activeSubTab =
    enviosSubTabs.some((tab) => tab.id === envSubRaw) && envSubRaw ? envSubRaw : 'processo'

  const [shipments, setShipments] = useState([])
  const [loadingShipments, setLoadingShipments] = useState(true)
  const [deliveredShipments, setDeliveredShipments] = useState([])
  const [loadingDelivered, setLoadingDelivered] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [cancellingId, setCancellingId] = useState(null)
  const [detailsOpenId, setDetailsOpenId] = useState(null)
  const [detailsLoadingId, setDetailsLoadingId] = useState(null)
  const [detailsByShipmentId, setDetailsByShipmentId] = useState({})
  const [shipmentsPage, setShipmentsPage] = useState(0)
  const [shipmentsHasMore, setShipmentsHasMore] = useState(false)
  const [deliveredPage, setDeliveredPage] = useState(0)
  const [deliveredHasMore, setDeliveredHasMore] = useState(false)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestStep, setRequestStep] = useState(1)
  const [inventoryForRequest, setInventoryForRequest] = useState([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [selectedInventoryIds, setSelectedInventoryIds] = useState(new Set())
  const [addresses, setAddresses] = useState([])
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [requestNotes, setRequestNotes] = useState('')
  const [customsMode, setCustomsMode] = useState('team_fill')
  const [customsDeclarations, setCustomsDeclarations] = useState({})
  const [extraServices, setExtraServices] = useState({
    photos: false,
    video: false,
    remove_packaging: false,
    bubble_wrap_inside: false,
    bubble_wrap_outside: false,
    urgent_priority_queue: false,
    urgent_dispatch_48h: false,
  })
  const [agreeRequestConfirmation, setAgreeRequestConfirmation] = useState(false)
  const [requestSubmitting, setRequestSubmitting] = useState(false)

  const selectedInventoryItems = useMemo(
    () => inventoryForRequest.filter((it) => selectedInventoryIds.has(it.id)),
    [inventoryForRequest, selectedInventoryIds]
  )
  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId) || null,
    [addresses, selectedAddressId]
  )
  const selectedExtraItems = useMemo(
    () =>
      EXTRA_SERVICE_DEFS.flatMap((c) =>
        c.items.filter((i) => extraServices[i.id]).map((i) => ({ ...i, categoryId: c.categoryId })),
      ),
    [extraServices],
  )
  const requestExtrasTotalJpy = selectedExtraItems.reduce((sum, i) => sum + Number(i.precoJpy || 0), 0)
  const selectedUnits = selectedInventoryItems.reduce((sum, i) => sum + Number(i.items_count || 1), 0)
  const selectedWeightKg = selectedInventoryItems.reduce((sum, i) => sum + Number(i.weight_kg || 0), 0)
  const declaredProductRows = useMemo(
    () =>
      selectedInventoryItems.map((it) => {
        const row = customsDeclarations[it.id] || {}
        const unit = Number(row.unit_value || 0)
        const qty = Number(row.quantity || 0)
        return {
          inventoryId: it.id,
          itemName: row.item_description || it.name || t('platform.shipments.itemFallback'),
          unitValue: Number.isFinite(unit) ? unit : 0,
          quantity: Number.isFinite(qty) ? qty : 0,
          subtotal: (Number.isFinite(unit) ? unit : 0) * (Number.isFinite(qty) ? qty : 0),
        }
      }),
    [selectedInventoryItems, customsDeclarations, t],
  )
  const declaredProductsTotal = declaredProductRows.reduce((sum, row) => sum + row.subtotal, 0)
  const declarationList = useMemo(
    () => selectedInventoryItems.map((it) => ({ inventory_id: it.id, ...(customsDeclarations[it.id] || {}) })),
    [selectedInventoryItems, customsDeclarations]
  )

  const getDefaultDeclaration = (item) => ({
    item_description: item?.name || '',
    unit_value: '',
    quantity: String(Math.max(1, Number(item?.items_count) || 1)),
  })

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id || activeSubTab !== 'recebidos') {
        if (isActive) setLoadingDelivered(false)
        return
      }
      const k = cacheKey(user.id, `shipments_entregues_v1_p${deliveredPage}`)
      const cached = readCache(k, 1000 * 60 * 30)
      if (cached && isActive) {
        setDeliveredShipments(cached.shipments ?? [])
        setDeliveredHasMore(!!cached.hasMore)
        setLoadingDelivered(false)
      }
      try {
        if (isActive) setLoadingDelivered(true)
        const { data, error } = await getMyShipments(user.id, {
          limit: SHIPMENTS_PAGE_SIZE,
          offset: deliveredPage * SHIPMENTS_PAGE_SIZE,
          statusIn: ['completed'],
        })
        if (!isActive) return
        const list = data ?? []
        setDeliveredShipments(list)
        setDeliveredHasMore(list.length === SHIPMENTS_PAGE_SIZE)
        if (error) setFeedback(error.message)
        writeCache(k, { shipments: list, hasMore: list.length === SHIPMENTS_PAGE_SIZE })
      } catch (e) {
        if (isActive) setFeedback(e?.message || t('platform.shipments.loadDeliveredError'))
      } finally {
        if (isActive) setLoadingDelivered(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id, deliveredPage, activeSubTab, t])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!user?.id || activeSubTab !== 'processo') {
        if (isActive) setLoadingShipments(false)
        return
      }
      const k = cacheKey(user.id, `shipments_processo_v1_p${shipmentsPage}`)
      const cached = readCache(k, 1000 * 60 * 30)
      if (cached && isActive) {
        setShipments(cached.shipments ?? [])
        setShipmentsHasMore(!!cached.hasMore)
        setLoadingShipments(false)
      }
      try {
        if (isActive) setLoadingShipments(true)
        const { data, error } = await getMyShipments(user.id, {
          limit: SHIPMENTS_PAGE_SIZE,
          offset: shipmentsPage * SHIPMENTS_PAGE_SIZE,
          statusIn: SHIPMENT_IN_PROCESS_STATUSES,
        })
        if (!isActive) return
        const list = data ?? []
        setShipments(list)
        setShipmentsHasMore(list.length === SHIPMENTS_PAGE_SIZE)
        if (error) setFeedback(error.message)
        writeCache(k, { shipments: list, hasMore: list.length === SHIPMENTS_PAGE_SIZE })
      } catch (e) {
        if (isActive) setFeedback(e?.message || t('platform.shipments.loadProcessError'))
      } finally {
        if (isActive) setLoadingShipments(false)
      }
    }
    run()
    return () => {
      isActive = false
    }
  }, [user?.id, shipmentsPage, activeSubTab, t])

  useEffect(() => {
    setCustomsDeclarations((prev) => {
      const next = {}
      for (const item of selectedInventoryItems) {
        const existing = prev[item.id]
        next[item.id] = existing
          ? { ...getDefaultDeclaration(item), ...existing }
          : getDefaultDeclaration(item)
      }
      return next
    })
  }, [selectedInventoryItems])

  const refreshDelivered = async () => {
    if (!user?.id) return
    const { data } = await getMyShipments(user.id, {
      limit: SHIPMENTS_PAGE_SIZE,
      offset: deliveredPage * SHIPMENTS_PAGE_SIZE,
      statusIn: ['completed'],
    })
    const list = data ?? []
    setDeliveredShipments(list)
    setDeliveredHasMore(list.length === SHIPMENTS_PAGE_SIZE)
    writeCache(cacheKey(user.id, `shipments_entregues_v1_p${deliveredPage}`), {
      shipments: list,
      hasMore: list.length === SHIPMENTS_PAGE_SIZE,
    })
  }

  const refreshShipments = async () => {
    if (!user?.id) return
    const { data } = await getMyShipments(user.id, {
      limit: SHIPMENTS_PAGE_SIZE,
      offset: shipmentsPage * SHIPMENTS_PAGE_SIZE,
      statusIn: SHIPMENT_IN_PROCESS_STATUSES,
    })
    const list = data ?? []
    setShipments(list)
    setShipmentsHasMore(list.length === SHIPMENTS_PAGE_SIZE)
    writeCache(cacheKey(user.id, `shipments_processo_v1_p${shipmentsPage}`), {
      shipments: list,
      hasMore: list.length === SHIPMENTS_PAGE_SIZE,
    })
  }

  const resetRequestFlow = () => {
    setRequestStep(1)
    setSelectedInventoryIds(new Set())
    setRequestNotes('')
    setCustomsMode('team_fill')
    setCustomsDeclarations({})
    setExtraServices({
      photos: false,
      video: false,
      remove_packaging: false,
      bubble_wrap_inside: false,
      bubble_wrap_outside: false,
      urgent_priority_queue: false,
      urgent_dispatch_48h: false,
    })
    setAgreeRequestConfirmation(false)
  }

  const openRequestModal = async () => {
    if (!user?.id) return
    resetRequestFlow()
    setRequestModalOpen(true)
    setInventoryLoading(true)
    setAddressesLoading(true)
    const [invRes, addrRes] = await Promise.all([
      getMyInventory(user.id, { limit: REQUEST_INVENTORY_PAGE_SIZE, offset: 0 }),
      getAddresses(user.id),
    ])
    setInventoryForRequest(invRes.data ?? [])
    if (invRes.error) setFeedback(invRes.error.message || t('platform.shipments.loadInventoryError'))
    const addrList = addrRes.data ?? []
    setAddresses(addrList)
    setSelectedAddressId(addrList[0]?.id || '')
    if (addrRes.error) setFeedback(addrRes.error.message || t('platform.shipments.loadAddressesError'))
    setInventoryLoading(false)
    setAddressesLoading(false)
  }

  const closeRequestModal = () => {
    setRequestModalOpen(false)
    resetRequestFlow()
  }

  const toggleInventorySelection = (id) => {
    setSelectedInventoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllInventory = () => {
    if (selectedInventoryIds.size === inventoryForRequest.length) {
      setSelectedInventoryIds(new Set())
      return
    }
    setSelectedInventoryIds(new Set(inventoryForRequest.map((it) => it.id)))
  }

  const canAdvanceRequestStep = (step) => {
    if (step === 1) return selectedInventoryIds.size > 0
    if (step === 2) {
      if (customsMode !== 'self_fill') return true
      if (selectedInventoryItems.length === 0) return false
      return selectedInventoryItems.every((it) => {
        const row = customsDeclarations[it.id] || {}
        const unit = Number(row.unit_value)
        const qty = Number(row.quantity)
        return (
          String(row.item_description || '').trim().length > 0 &&
          Number.isFinite(unit) &&
          unit > 0 &&
          Number.isFinite(qty) &&
          qty > 0
        )
      })
    }
    if (step === 3) return true
    if (step === 4) return !!selectedAddressId && agreeRequestConfirmation
    return true
  }

  const submitShipmentRequest = async () => {
    if (!user?.id || selectedInventoryIds.size === 0) return
    if (!canAdvanceRequestStep(4)) {
      setFeedback(t('platform.shipments.reviewRequest'))
      return
    }
    setRequestSubmitting(true)
    setFeedback('')
    try {
      const payloadMeta = {
        workflow_version: 3,
        selected_items_summary: {
          items_count: selectedInventoryItems.length,
          units_count: selectedUnits,
          weight_kg: Number(selectedWeightKg.toFixed(3)),
        },
        customs_declaration: {
          mode: customsMode,
          declarations: declarationList.map((row) => ({
            inventory_id: row.inventory_id,
            item_description: row.item_description || '',
            unit_value: Number(row.unit_value || 0),
            quantity: Number(row.quantity || 0),
          })),
        },
        request_confirmation: {
          address_id: selectedAddress?.id || null,
          address_snapshot: selectedAddress
            ? {
                label: selectedAddress.label || null,
                recipient_name: selectedAddress.recipient_name || '',
                street: selectedAddress.street || '',
                number: selectedAddress.number || '',
                complement: selectedAddress.complement || null,
                neighborhood: selectedAddress.neighborhood || '',
                city: selectedAddress.city || '',
                state: selectedAddress.state || '',
                postal_code: selectedAddress.postal_code || '',
                country: selectedAddress.country || 'Brasil',
              }
            : null,
          notes: requestNotes || null,
          agreed_at: new Date().toISOString(),
        },
      }
      const { error } = await createShipment(user.id, [...selectedInventoryIds], {
        extra_services: {
          ...extraServices,
          shipment_submission: payloadMeta,
        },
      })
      if (error) {
        setFeedback(error.message || t('platform.shipments.requestError'))
        return
      }
      setFeedback(t('platform.shipments.requestSent'))
      closeRequestModal()
      await refreshShipments()
    } finally {
      setRequestSubmitting(false)
    }
  }

  const handleCancel = async (s) => {
    if (s.status !== 'requested') return
    setCancellingId(s.id)
    setFeedback('')
    const { error } = await cancelShipment(user.id, s.id)
    setCancellingId(null)
    if (error) {
      setFeedback(error.message || t('platform.shipments.cancelError'))
      return
    }
    setFeedback(t('platform.shipments.cancelled'))
    await Promise.all([refreshShipments(), refreshDelivered()])
  }

  const toggleDetails = async (shipmentId) => {
    if (!shipmentId) return
    if (detailsOpenId === shipmentId) {
      setDetailsOpenId(null)
      return
    }
    setDetailsOpenId(shipmentId)
    if (detailsByShipmentId[shipmentId]) return

    setDetailsLoadingId(shipmentId)
    const { data, error } = await getShipmentItems(shipmentId)
    setDetailsLoadingId(null)
    if (error) {
      setFeedback(error.message || t('platform.shipments.detailsError'))
      return
    }
    setDetailsByShipmentId((prev) => ({ ...prev, [shipmentId]: data ?? [] }))
  }

  const renderShipmentCard = (s, { allowCancel }) => {
    const statusLabel = shipmentStatusLabel(t, s.status)
    const currency = (s.shipping_currency || 'JPY').toUpperCase()
    const cost = s.shipping_cost != null ? Number(s.shipping_cost) : null
    const isOpen = detailsOpenId === s.id
    const items = detailsByShipmentId[s.id] || null

    return (
      <section key={s.id} className="rounded-xl border border-earth-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-earth-900">
              {t('platform.shipments.shipmentId', { id: String(s.id).slice(0, 8) })}
            </h3>
            <p className="mt-1 text-sm text-earth-600">
              {t('platform.shipments.statusLine')}{' '}
              <span className="font-medium text-earth-800">{statusLabel}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => toggleDetails(s.id)}
              className="rounded-lg border border-earth-300 bg-white px-3 py-1.5 text-sm font-medium text-earth-800 hover:bg-earth-50"
            >
              {isOpen ? t('platform.shipments.hideDetails') : t('platform.shipments.showDetails')}
            </button>
            {allowCancel && s.status === 'requested' && (
              <button
                type="button"
                onClick={() => handleCancel(s)}
                disabled={cancellingId === s.id}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {cancellingId === s.id ? t('platform.shipments.cancelling') : t('platform.shipments.cancelShipment')}
              </button>
            )}
            {cost != null && cost > 0 && (
              <p className="text-sm font-medium text-earth-700">
                {t('platform.shipments.freight')} {fp.byCurrency(cost, currency)}
              </p>
            )}
            {cost != null && cost > 0 && currency !== 'BRL' && (
              <p className="text-xs text-earth-600">
                {t('platform.shipments.approxBrl')} {formatBRL(jpyToBrl(cost))}
              </p>
            )}
          </div>
        </div>

        {s.tracking_code && (
          <div className="mt-3 rounded-lg border border-earth-100 bg-earth-50 p-3">
            <p className="text-sm font-medium text-earth-800">{t('platform.shipments.tracking')}</p>
            <p className="mt-1 text-sm text-earth-600">{s.tracking_code}</p>
          </div>
        )}

        {s.extra_services && (
          <div className="mt-3 flex flex-wrap gap-2">
            {s.extra_services.photos && (
              <span className="rounded bg-earth-100 px-2 py-0.5 text-xs text-earth-700">
                {t('platform.shipments.extra.photos')}
              </span>
            )}
            {s.extra_services.video && (
              <span className="rounded bg-earth-100 px-2 py-0.5 text-xs text-earth-700">
                {t('platform.shipments.extra.video')}
              </span>
            )}
          </div>
        )}

        {isOpen && (
          <div className="mt-4 rounded-lg border border-earth-100 bg-earth-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-earth-900">{t('platform.shipments.detailsTitle')}</p>
              <p className="text-xs text-earth-600">
                {t('platform.shipments.createdAt')}{' '}
                {s.created_at ? new Date(s.created_at).toLocaleString(dateLocale) : '—'}
                {s.updated_at && s.status === 'completed' ? (
                  <>
                    {t('platform.shipments.finishedAt')}{' '}
                    {new Date(s.updated_at).toLocaleString(dateLocale)}
                  </>
                ) : null}
              </p>
            </div>

            {detailsLoadingId === s.id && (
              <p className="mt-3 text-sm text-earth-600">{t('platform.shipments.loadingItems')}</p>
            )}

            {detailsLoadingId !== s.id && items && (
              <>
                {items.length === 0 ? (
                  <p className="mt-3 text-sm text-earth-600">{t('platform.shipments.noItemsInShipment')}</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {items.map((row) => {
                      const it = row.user_inventory
                      const productLines = parseInventoryProductLines(it?.products_description)
                      return (
                        <li
                          key={row.id}
                          className="rounded-lg border border-earth-200 bg-white px-3 py-2"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-earth-900">
                                {it?.name || t('platform.shipments.itemFallback')}
                              </p>
                              <p className="mt-0.5 text-xs text-earth-600">
                                {it?.items_count != null
                                  ? t('platform.shipments.itemsCount', { count: it.items_count })
                                  : t('platform.shipments.itemsDash')}
                                {it?.weight_kg != null
                                  ? t('platform.shipments.weightDot', { w: formatWeight(it.weight_kg) })
                                  : ''}
                              </p>
                            </div>
                            <span className="rounded bg-earth-100 px-2 py-0.5 text-xs text-earth-700">
                              {it?.status || '—'}
                            </span>
                          </div>
                          {productLines.length > 0 && (
                            <ul className="mt-2 space-y-1 border-t border-earth-100 pt-2 text-xs text-earth-600">
                              {productLines.map((line, idx) => (
                                <li key={`${row.id}-line-${idx}`} className="truncate">
                                  {line.name} {line.quantity > 1 ? `x${line.quantity}` : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </section>
    )
  }

  if (!user) {
    return (
      <div className="py-8">
        <p className="text-earth-600">
          <Link to={lp('login')} className="font-medium text-earth-900 underline">
            {t('platform.shipments.loginLink')}
          </Link>
          {t('platform.shipments.loginSuffix')}
        </p>
      </div>
    )
  }

  return (
    <>
      <PageSeo
        routeKey="appLounge"
        title={t('meta.appShipments.title')}
        description={t('meta.appShipments.description')}
        noindex
      />

      <div>
        <h1 className="text-2xl font-bold text-earth-900">{t('platform.shipments.pageTitle')}</h1>
        <p className="mt-2 text-earth-600">{t('platform.shipments.intro')}</p>

        {feedback && (
          <p className="mt-4 rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800">{feedback}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-2 rounded-xl border border-earth-200 bg-earth-50 p-3">
          {enviosSubTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.set('tab', 'envios')
                if (tab.id === 'processo') next.delete('envSub')
                else next.set('envSub', tab.id)
                setSearchParams(next, { replace: true })
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                activeSubTab === tab.id
                  ? 'bg-earth-900 text-white'
                  : 'bg-white text-earth-700 hover:bg-earth-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeSubTab === 'processo' && (
          <section className="mt-6 rounded-xl border border-sky-300 bg-gradient-to-r from-sky-50 to-blue-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-900">{t('platform.shipments.ctaTitle')}</p>
                <p className="mt-1 text-xs text-sky-800">{t('platform.shipments.ctaBody')}</p>
              </div>
              <button
                type="button"
                onClick={openRequestModal}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
              >
                {t('platform.shipments.ctaButton')}
              </button>
            </div>
          </section>
        )}

        {activeSubTab === 'processo' && <LoungeShippingOrdersSection />}

        {activeSubTab === 'recebidos' && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-earth-900">{t('platform.shipments.deliveredHeading')}</h2>
            <p className="mt-1 text-sm text-earth-600">{t('platform.shipments.deliveredIntro')}</p>

            {loadingDelivered && <p className="mt-4 text-earth-600">{t('platform.shipments.loading')}</p>}

            {!loadingDelivered && deliveredShipments.length === 0 && (
              <p className="mt-4 text-earth-600">{t('platform.shipments.deliveredEmpty')}</p>
            )}

            {!loadingDelivered && deliveredShipments.length > 0 && (
              <div className="mt-4 space-y-4">
                {deliveredShipments.map((s) => renderShipmentCard(s, { allowCancel: false }))}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-white px-3 py-2">
                  <p className="text-xs text-earth-600">
                    {t('platform.shipments.pageIndicator', { page: deliveredPage + 1 })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveredPage((p) => Math.max(0, p - 1))}
                      disabled={loadingDelivered || deliveredPage <= 0}
                      className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                    >
                      {t('platform.shipments.paginationPrev')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveredPage((p) => p + 1)}
                      disabled={loadingDelivered || !deliveredHasMore}
                      className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                    >
                      {t('platform.shipments.paginationNext')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeSubTab === 'processo' && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-earth-900">{t('platform.shipments.processHeading')}</h2>
            <p className="mt-1 text-sm text-earth-600">{t('platform.shipments.processIntro')}</p>

            {loadingShipments && <p className="mt-4 text-earth-600">{t('platform.shipments.loading')}</p>}

            {!loadingShipments && shipments.length === 0 && (
              <p className="mt-4 text-earth-600">{t('platform.shipments.processEmpty')}</p>
            )}

            {!loadingShipments && shipments.length > 0 && (
              <div className="mt-4 space-y-4">
                {shipments.map((s) => renderShipmentCard(s, { allowCancel: true }))}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-white px-3 py-2">
                  <p className="text-xs text-earth-600">
                    {t('platform.shipments.pageIndicator', { page: shipmentsPage + 1 })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShipmentsPage((p) => Math.max(0, p - 1))}
                      disabled={loadingShipments || shipmentsPage <= 0}
                      className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                    >
                      {t('platform.shipments.paginationPrev')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShipmentsPage((p) => p + 1)}
                      disabled={loadingShipments || !shipmentsHasMore}
                      className="rounded border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                    >
                      {t('platform.shipments.paginationNext')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
      {requestModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
            <div
              className="w-full max-w-3xl rounded-xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="shipment-request-title"
            >
              <div className="border-b border-earth-200 px-6 py-4">
                <h2 id="shipment-request-title" className="text-lg font-semibold text-earth-900">
                  {t('platform.shipments.requestModalTitle')}
                </h2>
                <p className="mt-1 text-sm text-earth-600">{t('platform.shipments.requestModalSubtitle')}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {requestSteps.map((step) => (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setRequestStep(step.id)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-medium sm:text-sm ${
                        requestStep === step.id ? 'bg-earth-900 text-white' : 'bg-earth-100 text-earth-700 hover:bg-earth-200'
                      }`}
                    >
                      {step.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[62vh] overflow-y-auto px-6 py-5">
                {requestStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-earth-800">{t('platform.shipments.step1Heading')}</h3>
                      <label className="flex items-center gap-2 text-sm text-earth-700">
                        <input
                          type="checkbox"
                          checked={inventoryForRequest.length > 0 && selectedInventoryIds.size === inventoryForRequest.length}
                          onChange={toggleSelectAllInventory}
                          className="rounded border-earth-300"
                        />
                        {t('platform.shipments.selectAll')}
                      </label>
                    </div>
                    {inventoryLoading && (
                      <p className="text-sm text-earth-600">{t('platform.shipments.loadingInventory')}</p>
                    )}
                    {!inventoryLoading && inventoryForRequest.length === 0 && (
                      <p className="text-sm text-earth-600">{t('platform.shipments.noInventory')}</p>
                    )}
                    {!inventoryLoading && inventoryForRequest.length > 0 && (
                      <ul className="space-y-2">
                        {inventoryForRequest.map((it) => (
                          <li key={it.id} className="rounded-lg border border-earth-200 bg-earth-50 px-3 py-2">
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedInventoryIds.has(it.id)}
                                onChange={() => toggleInventorySelection(it.id)}
                                className="mt-1 rounded border-earth-300"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-earth-900">
                                  {it.name || t('platform.shipments.itemFallback')}
                                </p>
                                <p className="text-xs text-earth-600">
                                  {it.items_count != null
                                    ? t('platform.shipments.unitsCount', { count: it.items_count })
                                    : t('platform.shipments.unitsDash')}
                                  {it.weight_kg != null
                                    ? t('platform.shipments.weightDot', { w: formatWeight(it.weight_kg) })
                                    : ''}
                                </p>
                                {parseInventoryProductLines(it.products_description).length > 0 && (
                                  <ul className="mt-1 space-y-0.5 text-xs text-earth-600">
                                    {parseInventoryProductLines(it.products_description).map((line, idx) => (
                                      <li key={`${it.id}-product-${idx}`} className="truncate">
                                        {line.name} {line.quantity > 1 ? `x${line.quantity}` : ''}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-earth-600">
                      {t('platform.shipments.selectedSummary', {
                        items: selectedInventoryItems.length,
                        units: selectedUnits,
                        weight: formatWeight(selectedWeightKg),
                      })}
                    </p>
                  </div>
                )}

                {requestStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-earth-800">{t('platform.shipments.step2Heading')}</h3>
                    <p className="text-xs text-earth-600">{t('platform.shipments.step2Hint')}</p>
                    <div className="space-y-2 rounded-lg border border-earth-200 bg-earth-50 p-3">
                      <label className="flex items-start gap-2 text-sm text-earth-800">
                        <input
                          type="radio"
                          name="customs-mode-envios"
                          value="team_fill"
                          checked={customsMode === 'team_fill'}
                          onChange={(e) => setCustomsMode(e.target.value)}
                          className="mt-0.5"
                        />
                        {t('platform.shipments.customsTeamFill')}
                      </label>
                      <label className="flex items-start gap-2 text-sm text-earth-800">
                        <input
                          type="radio"
                          name="customs-mode-envios"
                          value="self_fill"
                          checked={customsMode === 'self_fill'}
                          onChange={(e) => setCustomsMode(e.target.value)}
                          className="mt-0.5"
                        />
                        {t('platform.shipments.customsSelfFill')}
                      </label>
                    </div>
                    {customsMode === 'self_fill' && (
                      <div className="space-y-3">
                        {selectedInventoryItems.map((it, idx) => (
                          <article
                            key={it.id}
                            className="overflow-hidden rounded-xl border-2 border-sky-200 bg-white shadow-sm"
                            aria-label={t('platform.shipments.declarationFormAria', { n: idx + 1 })}
                          >
                            <header className="flex items-center justify-between border-b border-sky-100 bg-sky-50 px-3 py-2">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-sky-700">
                                  {t('platform.shipments.declarationHeader')}
                                </p>
                                <p className="text-sm font-semibold text-sky-900">
                                  {t('platform.shipments.itemNumberName', {
                                    n: idx + 1,
                                    name: it.name || t('platform.shipments.itemFallback'),
                                  })}
                                </p>
                              </div>
                              <span className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200">
                                {t('platform.shipments.fillInBadge')}
                              </span>
                            </header>
                            <div className="p-3">
                              <p className="mb-2 text-xs text-earth-600">
                                {t('platform.shipments.declarationPerItemHint')}
                              </p>
                            <CustomsDeclarationForm
                              value={customsDeclarations[it.id] || getDefaultDeclaration(it)}
                              onChange={(next) =>
                                setCustomsDeclarations((prev) => ({ ...prev, [it.id]: next }))
                              }
                              required
                            />
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {requestStep === 3 && (
                  <div className="space-y-6">
                    {EXTRA_SERVICE_DEFS.map((cat) => (
                      <div key={cat.categoryId}>
                        <h3 className="mb-2 text-sm font-semibold text-earth-700">
                          {t(`platform.shipments.extraCat.${cat.categoryId}`)}
                        </h3>
                        <div className="space-y-1.5">
                          {cat.items.map((item) => (
                            <label
                              key={item.id}
                              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-earth-200 px-4 py-3 hover:bg-earth-50"
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={extraServices[item.id] ?? false}
                                  onChange={(e) => setExtraServices((s) => ({ ...s, [item.id]: e.target.checked }))}
                                  className="rounded border-earth-300"
                                />
                                <span className="text-sm font-medium text-earth-900">
                                  {t(`platform.shipments.extra.${item.id}`)}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-earth-600">{fp.jpy(item.precoJpy)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="rounded-lg border border-earth-200 bg-earth-50 px-3 py-2 text-sm text-earth-700">
                      {t('platform.shipments.step3TotalExtras')} {fp.jpy(requestExtrasTotalJpy)}
                    </div>
                  </div>
                )}

                {requestStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-earth-800">{t('platform.shipments.step4Heading')}</h3>
                    <div className="rounded-lg border border-earth-200 bg-earth-50 p-3 text-sm text-earth-700">
                      <p>
                        <strong>{t('platform.shipments.confirmSelectedCount')}</strong> {selectedInventoryItems.length}
                      </p>
                      <p>
                        <strong>{t('platform.shipments.confirmUnits')}</strong> {selectedUnits}
                      </p>
                      <p>
                        <strong>{t('platform.shipments.confirmWeight')}</strong> {formatWeight(selectedWeightKg)}
                      </p>
                      <p>
                        <strong>{t('platform.shipments.confirmCustoms')}</strong>{' '}
                        {customsMode === 'self_fill'
                          ? t('platform.shipments.customsFilledByYou')
                          : t('platform.shipments.customsFilledByTeam')}
                      </p>
                      <p>
                        <strong>{t('platform.shipments.confirmExtras')}</strong>{' '}
                        {selectedExtraItems.length > 0
                          ? selectedExtraItems.map((x) => t(`platform.shipments.extra.${x.id}`)).join(', ')
                          : t('platform.shipments.confirmExtrasNone')}
                      </p>
                      <p>
                        <strong>{t('platform.shipments.confirmExtrasTotal')}</strong> {fp.jpy(requestExtrasTotalJpy)}
                      </p>
                      {customsMode === 'self_fill' ? (
                        <>
                          <p className="mt-2">
                            <strong>{t('platform.shipments.declaredValuesTitle')}</strong>
                          </p>
                          <ul className="mt-1 space-y-1 text-xs">
                            {declaredProductRows.map((row) => (
                              <li key={row.inventoryId}>
                                {row.itemName}: {fp.jpy(row.unitValue)} x {row.quantity} = {fp.jpy(row.subtotal)}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1">
                            <strong>{t('platform.shipments.declaredTotal')}</strong> {fp.jpy(declaredProductsTotal)}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-earth-600">{t('platform.shipments.teamWillDeclareValues')}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-earth-700">
                        {t('platform.shipments.destinationAddress')}
                      </label>
                      {addressesLoading ? (
                        <p className="mt-2 text-sm text-earth-600">{t('platform.shipments.loadingAddresses')}</p>
                      ) : addresses.length === 0 ? (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          {t('platform.shipments.noAddressesBefore')}{' '}
                          <Link to={lp('appConta')} className="font-medium underline">
                            {t('platform.shipments.accountDataLink')}
                          </Link>
                          .
                        </div>
                      ) : (
                        <select
                          value={selectedAddressId}
                          onChange={(e) => setSelectedAddressId(e.target.value)}
                          className="mt-2 w-full rounded border border-earth-300 px-3 py-2 text-earth-900"
                        >
                          {addresses.map((a) => (
                            <option key={a.id} value={a.id}>
                              {t('platform.shipments.addressOption', {
                                label: a.label || t('platform.shipments.defaultAddressLabel'),
                                name: a.recipient_name,
                                city: a.city,
                                state: a.state,
                              })}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {selectedAddress && (
                      <div className="rounded-lg border border-earth-200 bg-earth-50 p-3 text-xs text-earth-700">
                        <p className="font-medium text-earth-900">{selectedAddress.recipient_name}</p>
                        <p>
                          {selectedAddress.street}, {selectedAddress.number}
                          {selectedAddress.complement ? ` - ${selectedAddress.complement}` : ''}
                        </p>
                        <p>
                          {selectedAddress.neighborhood} - {selectedAddress.city}/{selectedAddress.state}
                        </p>
                        <p>
                          {selectedAddress.postal_code} -{' '}
                          {selectedAddress.country || t('platform.shipments.defaultCountry')}
                        </p>
                      </div>
                    )}

                    <label className="block text-sm">
                      <span className="text-earth-700">{t('platform.shipments.notesOptional')}</span>
                      <textarea
                        rows={3}
                        value={requestNotes}
                        onChange={(e) => setRequestNotes(e.target.value)}
                        className="mt-1 w-full rounded border border-earth-300 px-3 py-2 text-earth-900"
                        placeholder={t('platform.shipments.notesPlaceholder')}
                      />
                    </label>

                    <label className="flex items-start gap-2 text-sm text-earth-800">
                      <input
                        type="checkbox"
                        checked={agreeRequestConfirmation}
                        onChange={(e) => setAgreeRequestConfirmation(e.target.checked)}
                        className="mt-0.5"
                      />
                      {t('platform.shipments.confirmCheckbox')}
                    </label>
                  </div>
                )}
              </div>

              <div className="flex justify-between border-t border-earth-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => (requestStep > 1 ? setRequestStep((s) => s - 1) : closeRequestModal())}
                  className="rounded-lg border border-earth-300 px-4 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
                >
                  {requestStep === 1 ? t('platform.shipments.wizardCancel') : t('platform.shipments.wizardBack')}
                </button>
                {requestStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setRequestStep((s) => s + 1)}
                    disabled={!canAdvanceRequestStep(requestStep)}
                    className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-60"
                  >
                    {t('platform.shipments.wizardNext')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitShipmentRequest}
                    disabled={requestSubmitting || !canAdvanceRequestStep(4)}
                    className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-60"
                  >
                    {requestSubmitting ? t('platform.shipments.submitting') : t('platform.shipments.submitRequest')}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

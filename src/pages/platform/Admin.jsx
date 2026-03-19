/**
 * Admin - Painel de administração da plataforma.
 * Inclui gestão de produtos e pedidos.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import {
  getProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
} from '../../services/productService'
import {
  getAllOrdersAdmin,
  getServices,
  updateOrderStatusAdmin,
  setShippingAndAwaitPaymentAdmin,
  setQuoteAdmin,
  updateOrderAdmin,
  deleteOrderAdmin,
  approveOrderAdmin,
  rejectOrderAdmin,
  createOrderForUserAdmin,
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
} from '../../services/orderService'
import {
  addInventoryFromOrderAdmin,
  registerPackageAdmin,
  getShippingPanelAdmin,
  setShipmentFreightAdmin,
  setShipmentShippedAdmin,
  setShipmentCompletedAdmin,
  setShipmentPaidAdmin,
} from '../../services/inventoryService'
import { getUsersAdmin } from '../../services/profileService'
import {
  createPurchaseGroup,
  getPurchaseGroupsAdmin,
  updatePurchaseGroup,
  deletePurchaseGroup,
  createPurchaseGroupProduct,
  updatePurchaseGroupProduct,
  deletePurchaseGroupProduct,
} from '../../services/groupService'
import { getPurchaseGroupProducts } from '../../services/productService'
import { getUserLogs, getAuthLogs, logAdminAction } from '../../services/logService'
import { brlToJpy, jpyToBrl, formatJPY } from '../../lib/fx'

function formatMoney(v, currency = 'BRL') {
  return Number(v)?.toLocaleString('pt-BR', { style: 'currency', currency }) ?? '—'
}

function formatOrderModuleLabel(order) {
  if (!order) return null
  if (order.order_module === 'self_buy') return 'Redirecionamento: 📦 Você Compra'
  if (order.order_module === 'assisted_buy') return 'Redirecionamento: 🛍️ Nós Compramos'
  return null
}

export default function Admin() {
  const { user, profile } = useAuth()
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    weight_kg: '',
    stock_quantity: '',
    image_url: '',
    image_urls: [],
    is_active: true,
  })
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUploadError, setImageUploadError] = useState('')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [shippingModal, setShippingModal] = useState({ open: false, orderId: null, cost: '', currency: 'JPY' })
  const [quoteModal, setQuoteModal] = useState({ open: false, orderId: null, amount: '', currency: 'JPY', message: '' })
  const [orderEditModal, setOrderEditModal] = useState({
    open: false,
    orderId: null,
    service_id: '',
    status: ORDER_STATUS.PENDING_APPROVAL,
    message: '',
    shipping_cost: '',
    shipping_currency: 'JPY',
    extra_services: { photos: false, video: false },
  })
  const [inventoryModal, setInventoryModal] = useState({
    open: false,
    orderId: null,
    orderMessage: '',
    name: '',
    notes: '',
    weight_kg: '',
    photo_url: '',
    video_url: '',
  })
  const [users, setUsers] = useState([])
  const [createOrderModal, setCreateOrderModal] = useState({
    open: false,
    user_id: '',
    service_id: '',
    message: '',
  })
  const [registerPackageModal, setRegisterPackageModal] = useState({
    open: false,
    user_id: '',
    products_description: '',
    items_count: '',
    weight_kg: '',
    order_id: '',
    photo_url: '',
    video_url: '',
  })
  const [activeTab, setActiveTab] = useState('pedidos')

  // Grupo de Compras (admin)
  const [purchaseGroups, setPurchaseGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupSubmitting, setGroupSubmitting] = useState(false)
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    image_url: '',
    image_urls: [],
    is_active: true,
  })
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [groupImageUploading, setGroupImageUploading] = useState(false)
  const [groupImageUploadError, setGroupImageUploadError] = useState('')
  const [newGroupImageUrl, setNewGroupImageUrl] = useState('')
  const [groupProducts, setGroupProducts] = useState([])
  const [pendingGroupProducts, setPendingGroupProducts] = useState([])
  const [groupProductForm, setGroupProductForm] = useState({
    name: '',
    price: '',
    description: '',
    image_url: '',
    image_urls: [],
    weight_kg: '0',
  })
  const [editingGroupProductId, setEditingGroupProductId] = useState(null)
  const [editingPendingProductIndex, setEditingPendingProductIndex] = useState(null)
  const [groupProductSubmitting, setGroupProductSubmitting] = useState(false)

  const TABS = [
    { id: 'pedidos', label: 'Pedidos', icon: '📦' },
    { id: 'envios', label: 'Envios', icon: '🚚' },
    { id: 'produtos', label: 'Produtos', icon: '🛒' },
    { id: 'grupos', label: 'Grupo de Compras', icon: '👥' },
    { id: 'logs', label: 'Logs', icon: '📋' },
  ]

  const [userLogs, setUserLogs] = useState([])
  const [userLogsLoading, setUserLogsLoading] = useState(false)
  const [authLogs, setAuthLogs] = useState([])
  const [authLogsLoading, setAuthLogsLoading] = useState(false)

  const [shippingPanel, setShippingPanel] = useState({ shipments: [], orders: [], inventoryReady: [] })
  const [shippingPanelLoading, setShippingPanelLoading] = useState(false)
  const [shipmentFreightModal, setShipmentFreightModal] = useState({ open: false, shipmentId: null, cost: '', currency: 'JPY' })
  const [shipmentShippedModal, setShipmentShippedModal] = useState({ open: false, shipmentId: null, trackingCode: '' })

  const loadProducts = async (active = () => true) => {
    if (active()) setLoading(true)
    try {
      const { data, error } = await getProductsAdmin()
      if (!active()) return
      setProducts(data ?? [])
      if (error) setMessage(error.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar produtos')
    } finally {
      if (active()) setLoading(false)
    }
  }

  const loadOrders = async (active = () => true) => {
    if (active()) setOrdersLoading(true)
    try {
      const { data, error } = await getAllOrdersAdmin()
      if (!active()) return
      setOrders(data ?? [])
      if (error) setMessage(error.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar pedidos')
    } finally {
      if (active()) setOrdersLoading(false)
    }
  }

  const loadServices = async (active = () => true) => {
    try {
      const { data, error } = await getServices()
      if (!active()) return
      setServices(data ?? [])
      if (error) setMessage(error.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar serviços')
    }
  }

  useEffect(() => {
    let isActive = true
    loadProducts(() => isActive)
    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let isActive = true
    loadOrders(() => isActive)
    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let isActive = true
    loadServices(() => isActive)
    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let isActive = true
    loadGroups(() => isActive)
    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'logs') {
      let isActive = true
      loadUserLogs(() => isActive)
      loadAuthLogs(() => isActive)
      return () => {
        isActive = false
      }
    }
  }, [activeTab])

  const loadShippingPanel = async (active = () => true) => {
    if (active()) setShippingPanelLoading(true)
    try {
      const { data, error } = await getShippingPanelAdmin()
      if (!active()) return
      setShippingPanel(data ?? { shipments: [], orders: [], inventoryReady: [] })
      if (error) setMessage(error?.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar painel de envios')
    } finally {
      if (active()) setShippingPanelLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'envios') {
      let isActive = true
      loadShippingPanel(() => isActive)
      return () => { isActive = false }
    }
  }, [activeTab])

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      price: '',
      weight_kg: '',
      stock_quantity: '',
      image_url: '',
      image_urls: [],
      is_active: true,
    })
    setEditingId(null)
    setImageUploadError('')
    setNewImageUrl('')
  }

  const resetGroupForm = () => {
    setGroupForm({
      name: '',
      description: '',
      image_url: '',
      image_urls: [],
      is_active: true,
    })
    setEditingGroupId(null)
    setGroupImageUploadError('')
    setNewGroupImageUrl('')
    setGroupProducts([])
    setPendingGroupProducts([])
    setGroupProductForm({ name: '', price: '', description: '', image_url: '', image_urls: [], weight_kg: '0' })
    setEditingGroupProductId(null)
    setEditingPendingProductIndex(null)
  }

  const loadGroupProducts = async (groupId) => {
    if (!groupId) return
    const { data } = await getPurchaseGroupProducts(groupId)
    setGroupProducts(data ?? [])
  }

  const handleEditGroup = (g) => {
    setGroupForm({
      name: g.name ?? '',
      description: g.description ?? '',
      image_url: g.image_url ?? '',
      image_urls: Array.isArray(g.image_urls) ? g.image_urls.filter(Boolean) : [],
      is_active: g.is_active ?? true,
    })
    setEditingGroupId(g.id)
    setGroupImageUploadError('')
    setNewGroupImageUrl('')
    setEditingGroupProductId(null)
    setEditingPendingProductIndex(null)
    setPendingGroupProducts([])
    setGroupProductForm({ name: '', price: '', description: '', image_url: '', image_urls: [], weight_kg: '0' })
    loadGroupProducts(g.id)
  }

  const resetGroupProductForm = () => {
    setGroupProductForm({ name: '', price: '', description: '', image_url: '', image_urls: [], weight_kg: '0' })
    setEditingGroupProductId(null)
    setEditingPendingProductIndex(null)
  }

  const buildGroupProductPayload = () => {
    const price = parseFloat(groupProductForm.price)
    if (isNaN(price) || price < 0) return null
    const imageUrls = Array.isArray(groupProductForm.image_urls)?.length
      ? groupProductForm.image_urls.filter(Boolean)
      : groupProductForm.image_url ? [groupProductForm.image_url] : []
    return {
      name: groupProductForm.name.trim(),
      description: groupProductForm.description?.trim() || '',
      price: jpyToBrl(price),
      image_url: imageUrls[0] || groupProductForm.image_url || '',
      image_urls: imageUrls,
      weight_kg: parseFloat(groupProductForm.weight_kg) || 0,
    }
  }

  const handleSaveGroupProduct = async (e) => {
    e.preventDefault()
    const price = parseFloat(groupProductForm.price)
    if (isNaN(price) || price < 0) {
      setMessage('Preço inválido')
      return
    }
    const payload = buildGroupProductPayload()
    if (!payload) return

    if (editingGroupId) {
      setGroupProductSubmitting(true)
      setMessage('')
      try {
        if (editingGroupProductId) {
          const { error } = await updatePurchaseGroupProduct(editingGroupId, editingGroupProductId, payload)
          if (error) setMessage(error.message)
          else {
            resetGroupProductForm()
            loadGroupProducts(editingGroupId)
          }
        } else {
          const { error } = await createPurchaseGroupProduct(editingGroupId, payload)
          if (error) setMessage(error.message)
          else {
            resetGroupProductForm()
            loadGroupProducts(editingGroupId)
          }
        }
      } finally {
        setGroupProductSubmitting(false)
      }
    } else {
      const item = { id: crypto.randomUUID(), ...payload }
      if (editingPendingProductIndex != null) {
        setPendingGroupProducts((prev) => {
          const next = [...prev]
          next[editingPendingProductIndex] = item
          return next
        })
        setEditingPendingProductIndex(null)
      } else {
        setPendingGroupProducts((prev) => [...prev, item])
      }
      resetGroupProductForm()
      setMessage('')
    }
  }

  const handleEditGroupProduct = (p) => {
    setGroupProductForm({
      name: p.name ?? '',
      price: String(Math.round(brlToJpy(Number(p.price ?? 0)))),
      description: p.description ?? '',
      image_url: p.image_url ?? '',
      image_urls: Array.isArray(p.image_urls) ? p.image_urls : (p.image_url ? [p.image_url] : []),
      weight_kg: String(Number(p.weight_kg ?? 0)),
    })
    setEditingGroupProductId(p.id)
  }

  const handleDeleteGroupProduct = async (productId) => {
    if (!editingGroupId || !confirm('Remover este produto do grupo?')) return
    const { error } = await deletePurchaseGroupProduct(editingGroupId, productId)
    if (error) setMessage(error.message)
    else {
      loadGroupProducts(editingGroupId)
      resetGroupProductForm()
    }
  }

  const handleEditPendingGroupProduct = (item, index) => {
    setGroupProductForm({
      name: item.name ?? '',
      price: String(Math.round(brlToJpy(Number(item.price ?? 0)))),
      description: item.description ?? '',
      image_url: item.image_url ?? '',
      image_urls: Array.isArray(item.image_urls) ? item.image_urls : (item.image_url ? [item.image_url] : []),
      weight_kg: String(Number(item.weight_kg ?? 0)),
    })
    setEditingPendingProductIndex(index)
  }

  const handleRemovePendingGroupProduct = (index) => {
    setPendingGroupProducts((prev) => prev.filter((_, i) => i !== index))
    if (editingPendingProductIndex === index) {
      resetGroupProductForm()
      setEditingPendingProductIndex(null)
    } else if (editingPendingProductIndex != null && editingPendingProductIndex > index) {
      setEditingPendingProductIndex(editingPendingProductIndex - 1)
    }
  }

  const loadGroups = async (active = () => true) => {
    if (active()) setGroupsLoading(true)
    try {
      const { data, error } = await getPurchaseGroupsAdmin()
      if (!active()) return
      setPurchaseGroups(data ?? [])
      if (error) setMessage(error.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar grupos de compra')
    } finally {
      if (active()) setGroupsLoading(false)
    }
  }

  const loadUserLogs = async (active = () => true) => {
    if (active()) setUserLogsLoading(true)
    try {
      const { data, error } = await getUserLogs(200, 0)
      if (!active()) return
      setUserLogs(data ?? [])
      if (error) setMessage(error.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar logs')
    } finally {
      if (active()) setUserLogsLoading(false)
    }
  }

  const loadAuthLogs = async (active = () => true) => {
    if (active()) setAuthLogsLoading(true)
    try {
      const { data, error } = await getAuthLogs(200, 0)
      if (!active()) return
      setAuthLogs(data ?? [])
      if (error) setMessage(error.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar logs de autenticação')
    } finally {
      if (active()) setAuthLogsLoading(false)
    }
  }

  const handleSaveGroup = async (e) => {
    e.preventDefault()
    setMessage('')

    const name = groupForm.name?.trim()
    if (!name) {
      setMessage('Nome do grupo é obrigatório')
      return
    }

    const imageUrls = Array.isArray(groupForm.image_urls) ? groupForm.image_urls.filter(Boolean) : []
    if (!imageUrls.length) {
      setMessage('Fotos do grupo são obrigatórias')
      return
    }

    setGroupSubmitting(true)
    try {
      const payload = {
        name,
        description: groupForm.description || '',
        image_urls: imageUrls,
        image_url: groupForm.image_url || imageUrls[0] || '',
        is_active: groupForm.is_active ?? true,
      }

      const { data: groupData, error } = editingGroupId
        ? await updatePurchaseGroup(editingGroupId, payload)
        : await createPurchaseGroup(payload)
      if (error) {
        setMessage(error.message || (editingGroupId ? 'Erro ao atualizar grupo' : 'Erro ao criar grupo'))
        return
      }

      logAdminAction(
        editingGroupId ? 'group_update' : 'group_create',
        'purchase_group',
        editingGroupId || groupData?.id,
        { name: payload.name }
      )

      if (!editingGroupId && pendingGroupProducts.length > 0) {
        for (const prod of pendingGroupProducts) {
          const { error: prodErr } = await createPurchaseGroupProduct(groupData?.id, prod)
          if (prodErr) {
            setMessage(prodErr.message || 'Erro ao criar alguns produtos')
            return
          }
        }
        setPendingGroupProducts([])
      }

      setMessage(editingGroupId ? 'Grupo atualizado com sucesso' : 'Grupo criado com sucesso')
      if (editingGroupId) {
        loadGroups()
        loadGroupProducts(editingGroupId)
      } else {
        setEditingGroupId(groupData?.id)
        setGroupForm((f) => ({ ...f, ...payload }))
        loadGroupProducts(groupData?.id)
      }
    } finally {
      setGroupSubmitting(false)
    }
  }

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Remover este grupo de compras?')) return
    const { error } = await deletePurchaseGroup(groupId)
    setMessage(error ? error.message : 'Grupo removido')
    if (!error) {
      logAdminAction('group_delete', 'purchase_group', groupId)
      if (editingGroupId === groupId) resetGroupForm()
      loadGroups()
    }
  }

  const getProductImageUrls = (p) => {
    if (Array.isArray(p?.image_urls) && p.image_urls.length > 0) return [...p.image_urls]
    if (p?.image_url) return [p.image_url]
    return []
  }

  const handleEdit = (p) => {
    const urls = getProductImageUrls(p)
    setForm({
      name: p.name,
      description: p.description ?? '',
      // UI do admin em JPY (mantemos persistência em BRL no banco)
      price: String(Math.round(brlToJpy(Number(p.price ?? 0)))),
      weight_kg: String(Number(p.weight_kg ?? 0)),
      stock_quantity: p.stock_quantity != null ? String(p.stock_quantity) : '',
      image_url: p.image_url ?? urls[0] ?? '',
      image_urls: urls,
      is_active: p.is_active ?? true,
    })
    setEditingId(p.id)
    setImageUploadError('')
    setNewImageUrl('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setMessage('')
    const priceJpy = parseFloat(form.price)
    if (isNaN(priceJpy) || priceJpy < 0) {
      setMessage('Preço inválido')
      return
    }
    const weightKg = parseFloat(form.weight_kg)
    if (isNaN(weightKg) || weightKg <= 0) {
      setMessage('Peso inválido (informe o peso do produto em kg)')
      return
    }
    // Converter JPY (UI) -> BRL (banco), já que o projeto salva preços da loja em BRL.
    const price = jpyToBrl(priceJpy)
    const imageUrls = Array.isArray(form.image_urls) && form.image_urls.length > 0
      ? form.image_urls.filter(Boolean)
      : (form.image_url ? [form.image_url] : [])
    const stockQty = form.stock_quantity === '' || form.stock_quantity == null
      ? null
      : Math.max(0, parseInt(form.stock_quantity, 10) || 0)
    const payload = {
      name: form.name,
      description: form.description || null,
      price,
      weight_kg: weightKg,
      stock_quantity: stockQty,
      image_url: imageUrls[0] || form.image_url || null,
      image_urls: imageUrls,
      is_active: form.is_active,
    }
    setSubmitting(true)
    try {
      if (editingId) {
        const { error } = await updateProduct(editingId, payload)
        setMessage(error ? error.message : 'Produto atualizado')
        if (!error) {
          logAdminAction('product_update', 'product', editingId, { name: payload.name })
          resetForm()
          loadProducts()
        }
      } else {
        const { data, error } = await createProduct(payload)
        setMessage(error ? error.message : 'Produto criado')
        if (!error) {
          logAdminAction('product_create', 'product', data?.id, { name: payload.name })
          resetForm()
          loadProducts()
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remover este produto?')) return
    const { error } = await deleteProduct(id)
    if (error) {
      setMessage(error.message || 'Erro ao remover produto')
      return
    }

    setMessage('Produto removido')
    loadProducts()
    // Log não deve interferir no UX de remoção.
    logAdminAction('product_delete', 'product', id).catch(() => {})
  }

  const handleOrderStatus = async (orderId, status) => {
    const { error } = await updateOrderStatusAdmin(orderId, status)
    setMessage(error ? error.message : 'Status atualizado')
    if (!error) {
      logAdminAction('order_status_update', 'order', orderId, { status })
      loadOrders()
    }
  }

  const openShippingModal = (order) => {
    setShippingModal({
      open: true,
      orderId: order.id,
      cost: order.shipping_cost ? String(order.shipping_cost) : '',
      currency: order.shipping_currency || 'JPY',
    })
  }

  const handleSetShipping = async (e) => {
    e.preventDefault()
    const cost = parseFloat(shippingModal.cost)
    if (isNaN(cost) || cost < 0) {
      setMessage('Valor do frete inválido')
      return
    }
    const { error } = await setShippingAndAwaitPaymentAdmin(
      shippingModal.orderId,
      cost,
      shippingModal.currency
    )
    setMessage(error ? error.message : 'Frete definido. Aguardando pagamento do cliente.')
    if (!error) {
      logAdminAction('order_set_shipping', 'order', shippingModal.orderId, { cost, currency: shippingModal.currency })
      setShippingModal({ open: false, orderId: null, cost: '', currency: 'JPY' })
      loadOrders()
    }
  }

  const openShipmentFreightModal = (s) => {
    setShipmentFreightModal({ open: true, shipmentId: s.id, cost: s.shipping_cost ? String(s.shipping_cost) : '', currency: s.shipping_currency || 'JPY' })
  }

  const handleSetShipmentFreight = async (e) => {
    e.preventDefault()
    const cost = parseFloat(shipmentFreightModal.cost)
    if (isNaN(cost) || cost < 0) {
      setMessage('Valor do frete inválido')
      return
    }
    setSubmitting(true)
    setMessage('')
    const { error } = await setShipmentFreightAdmin(shipmentFreightModal.shipmentId, cost, shipmentFreightModal.currency)
    setSubmitting(false)
    setMessage(error ? error.message : 'Frete definido no envio. Aguardando pagamento.')
    if (!error) {
      setShipmentFreightModal({ open: false, shipmentId: null, cost: '', currency: 'JPY' })
      loadShippingPanel()
      loadOrders()
    }
  }

  const openShipmentShippedModal = (s) => {
    setShipmentShippedModal({ open: true, shipmentId: s.id, trackingCode: s.tracking_code || '' })
  }

  const handleSetShipmentShipped = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')
    const { error } = await setShipmentShippedAdmin(shipmentShippedModal.shipmentId, shipmentShippedModal.trackingCode)
    setSubmitting(false)
    setMessage(error ? error.message : 'Envio marcado como enviado.')
    if (!error) {
      setShipmentShippedModal({ open: false, shipmentId: null, trackingCode: '' })
      loadShippingPanel()
      loadOrders()
    }
  }

  const handleSetShipmentPaid = async (shipmentId) => {
    setSubmitting(true)
    setMessage('')
    const { error } = await setShipmentPaidAdmin(shipmentId)
    setSubmitting(false)
    setMessage(error ? error.message : 'Envio marcado como pago.')
    if (!error) {
      loadShippingPanel()
    }
  }

  const handleSetShipmentCompleted = async (shipmentId) => {
    setSubmitting(true)
    setMessage('')
    const { error } = await setShipmentCompletedAdmin(shipmentId)
    setSubmitting(false)
    setMessage(error ? error.message : 'Envio finalizado.')
    if (!error) {
      loadShippingPanel()
      loadOrders()
    }
  }

  const handleSetQuote = async (e) => {
    e.preventDefault()
    const amount = parseFloat(quoteModal.amount)
    if (isNaN(amount) || amount <= 0) {
      setMessage('Informe um valor válido para o orçamento.')
      return
    }
    setSubmitting(true)
    setMessage('')
    const { error } = await setQuoteAdmin(quoteModal.orderId, amount, 'JPY', quoteModal.message)
    setSubmitting(false)
    setMessage(error ? error.message : 'Orçamento definido. Cliente pode pagar em Pedidos.')
    if (!error) {
      logAdminAction('order_set_quote', 'order', quoteModal.orderId, { amount, currency: 'JPY' })
      setQuoteModal({ open: false, orderId: null, amount: '', currency: 'JPY', message: '' })
      loadOrders()
    }
  }

  const openOrderEditModal = (order) => {
    setOrderEditModal({
      open: true,
      orderId: order.id,
      service_id: order.service_id ?? '',
      status: order.status ?? ORDER_STATUS.PENDING_APPROVAL,
      message: order.message ?? '',
      shipping_cost: order.shipping_cost != null ? String(order.shipping_cost) : '',
      shipping_currency: order.shipping_currency || 'JPY',
      extra_services: order.extra_services && typeof order.extra_services === 'object'
        ? { photos: !!order.extra_services.photos, video: !!order.extra_services.video }
        : { photos: false, video: false },
    })
  }

  const closeOrderEditModal = () => {
    setOrderEditModal({
      open: false,
      orderId: null,
      service_id: '',
    status: ORDER_STATUS.PENDING_APPROVAL,
    message: '',
      shipping_cost: '',
      shipping_currency: 'JPY',
      extra_services: { photos: false, video: false },
    })
  }

  const handleSaveOrderEdit = async (e) => {
    e.preventDefault()
    const hasShipping = orderEditModal.shipping_cost.trim() !== ''
    const shippingCost = hasShipping ? parseFloat(orderEditModal.shipping_cost) : null
    if (hasShipping && (isNaN(shippingCost) || shippingCost < 0)) {
      setMessage('Valor do frete inválido')
      return
    }

    const payload = {
      service_id: orderEditModal.service_id || null,
      status: orderEditModal.status,
      message: orderEditModal.message,
      shipping_cost: shippingCost,
      shipping_currency: orderEditModal.shipping_currency || 'JPY',
      extra_services: orderEditModal.extra_services,
    }

    const { error } = await updateOrderAdmin(orderEditModal.orderId, payload)
    setMessage(error ? error.message : 'Pedido atualizado')
    if (!error) {
      logAdminAction('order_edit', 'order', orderEditModal.orderId, { status: payload.status })
      closeOrderEditModal()
      loadOrders()
    }
  }

  const handleDeleteOrder = async (orderId) => {
    if (!confirm('Remover este pedido? Esta ação não pode ser desfeita.')) return
    const { error } = await deleteOrderAdmin(orderId)
    setMessage(error ? error.message : 'Pedido removido')
    if (!error) {
      logAdminAction('order_delete', 'order', orderId)
      loadOrders()
    }
  }

  const openInventoryModal = (order) => {
    const name = order.message?.trim() || `Item do pedido ${order.id?.slice(0, 8)}`
    setInventoryModal({
      open: true,
      orderId: order.id,
      orderMessage: order.message ?? '',
      name,
      notes: '',
      weight_kg: '',
      photo_url: '',
      video_url: '',
    })
  }

  const handleAddToInventory = async (e) => {
    e.preventDefault()
    if (!inventoryModal.orderId) return
    const name = inventoryModal.name?.trim()
    if (!name) {
      setMessage('Informe o nome do item.')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const { error } = await addInventoryFromOrderAdmin(inventoryModal.orderId, {
        name,
        notes: inventoryModal.notes?.trim() || null,
        weight_kg: inventoryModal.weight_kg ? parseFloat(inventoryModal.weight_kg) : null,
        photo_url: inventoryModal.photo_url?.trim() || null,
        video_url: inventoryModal.video_url?.trim() || null,
      })
      setMessage(error ? error.message : 'Item adicionado ao inventário do usuário.')
      if (!error) {
        logAdminAction('inventory_add_from_order', 'order', inventoryModal.orderId, { name })
        setInventoryModal({ open: false, orderId: null, orderMessage: '', name: '', notes: '', weight_kg: '', photo_url: '', video_url: '' })
        loadOrders()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateOrderForUser = async (e) => {
    e.preventDefault()
    const uid = createOrderModal.user_id?.trim()
    if (!uid) {
      setMessage('Selecione o usuário.')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const { error } = await createOrderForUserAdmin(uid, {
        service_id: createOrderModal.service_id || null,
        message: createOrderModal.message?.trim() || null,
      })
      setMessage(error ? error.message : 'Pedido criado na conta do usuário.')
      if (!error) {
        logAdminAction('order_create_for_user', 'order', null, { user_id: createOrderModal.user_id })
        setCreateOrderModal({ open: false, user_id: '', service_id: '', message: '' })
        loadOrders()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegisterPackage = async (e) => {
    e.preventDefault()
    const uid = registerPackageModal.user_id?.trim()
    if (!uid) {
      setMessage('Selecione o usuário.')
      return
    }
    const desc = registerPackageModal.products_description?.trim()
    if (!desc) {
      setMessage('Informe a descrição dos produtos do pacote.')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const { error } = await registerPackageAdmin(uid, {
        products_description: desc,
        items_count: registerPackageModal.items_count ? parseInt(registerPackageModal.items_count, 10) : null,
        weight_kg: registerPackageModal.weight_kg ? parseFloat(registerPackageModal.weight_kg) : null,
        order_id: registerPackageModal.order_id?.trim() || null,
        photo_url: registerPackageModal.photo_url?.trim() || null,
        video_url: registerPackageModal.video_url?.trim() || null,
      })
      setMessage(error ? error.message : 'Pacote registrado na conta do usuário.')
      if (!error) {
        logAdminAction('package_register', null, null, { user_id: registerPackageModal.user_id })
        setRegisterPackageModal({ open: false, user_id: '', products_description: '', items_count: '', weight_kg: '', order_id: '', photo_url: '', video_url: '' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Admin | Plataforma</title>
      </Helmet>
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-earth-900">Admin</h1>
          <span className="text-sm text-earth-600">{user?.email}</span>
        </div>

        {message && (
          <div className="mt-4 rounded-lg bg-earth-100 px-4 py-2 text-sm text-earth-800">
            {message}
          </div>
        )}

        {/* Navegação por abas */}
        <nav className="mt-6 border-b border-earth-200">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-earth-900 bg-earth-50 text-earth-900'
                    : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Pedidos - Fluxo Redirecionamento */}
        {activeTab === 'pedidos' && (
        <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
          <h2 className="text-lg font-semibold text-earth-900">Pedidos</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                const { data } = await getUsersAdmin()
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
                const { data } = await getUsersAdmin()
                setUsers(data ?? [])
                setRegisterPackageModal({ open: true, user_id: '', products_description: '', items_count: '', weight_kg: '', order_id: '', photo_url: '', video_url: '' })
              }}
              className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              Registrar pacote
            </button>
          </div>
          {ordersLoading && <p className="mt-4 text-sm text-earth-600">Carregando pedidos...</p>}
          {!ordersLoading && orders.length === 0 && (
            <p className="mt-4 text-sm text-earth-600">Nenhum pedido ainda.</p>
          )}
          {!ordersLoading && orders.length > 0 && (
            <div className="mt-4 space-y-4">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg border border-earth-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="font-medium text-earth-900">
                        Pedido {o.id?.slice(0, 8)}…
                      </span>
                      <span className="ml-2 rounded bg-earth-200 px-2 py-0.5 text-xs text-earth-700">
                        {ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </span>
                      <p className="mt-1 text-sm text-earth-600">
                        {o.user_name || o.user_email || o.user_id} • {o.service_name || o.order_source === 'store' ? 'Loja' : '—'}
                      </p>
                      {formatOrderModuleLabel(o) && (
                        <p className="mt-1">
                          <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            {formatOrderModuleLabel(o)}
                          </span>
                        </p>
                      )}
                      {o.message && (
                        <p className="mt-1 text-sm text-earth-500 italic">{o.message}</p>
                      )}
                      {Array.isArray(o.attachment_urls) && o.attachment_urls.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {o.attachment_urls.slice(0, 5).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-earth-600 underline">
                              Imagem {i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                      {o.quote_amount != null && (
                        <p className="mt-1 text-sm font-medium text-earth-700">
                          Orçamento: {formatMoney(o.quote_amount, o.quote_currency || 'BRL')}
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
                      {o.status === ORDER_STATUS.AWAITING_QUOTE && (
                        <button
                          type="button"
                          onClick={() => setQuoteModal({ open: true, orderId: o.id, amount: '', currency: 'JPY', message: o.message ?? '' })}
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
                            const { data } = await getUsersAdmin()
                            setUsers(data ?? [])
                            setRegisterPackageModal({
                              open: true,
                              user_id: o.user_id ?? '',
                              products_description: o.message ?? '',
                              items_count: '',
                              weight_kg: '',
                              order_id: o.id ?? '',
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
            </div>
          )}

          {shippingModal.open && (
            <form
              onSubmit={handleSetShipping}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            >
              <div
                className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-earth-900">Definir valor do frete</h3>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Valor (¥)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={shippingModal.cost}
                      onChange={(e) =>
                        setShippingModal((m) => ({ ...m, cost: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Moeda</label>
                    <input
                      value="JPY (¥)"
                      disabled
                      className="mt-1 block w-full rounded-lg border border-earth-300 bg-earth-50 px-3 py-2 text-earth-900"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800"
                  >
                    Definir e notificar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShippingModal({ open: false, orderId: null, cost: '', currency: 'JPY' })}
                    className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          )}

          {shipmentFreightModal.open && (
            <form
              onSubmit={handleSetShipmentFreight}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            >
              <div
                className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-earth-900">Definir frete no envio</h3>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Valor do frete (¥)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={shipmentFreightModal.cost}
                      onChange={(e) =>
                        setShipmentFreightModal((m) => ({ ...m, cost: e.target.value }))
                      }
                      placeholder="Ex: 5000"
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Moeda</label>
                    <input
                      value="JPY (¥)"
                      disabled
                      className="mt-1 block w-full rounded-lg border border-earth-300 bg-earth-50 px-3 py-2 text-earth-900"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60"
                  >
                    {submitting ? 'Salvando...' : 'Definir frete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShipmentFreightModal({ open: false, shipmentId: null, cost: '', currency: 'JPY' })}
                    className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          )}

          {shipmentShippedModal.open && (
            <form
              onSubmit={handleSetShipmentShipped}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            >
              <div
                className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-earth-900">Marcar envio como enviado</h3>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Código de rastreio (opcional)</label>
                    <input
                      type="text"
                      value={shipmentShippedModal.trackingCode}
                      onChange={(e) =>
                        setShipmentShippedModal((m) => ({ ...m, trackingCode: e.target.value }))
                      }
                      placeholder="Ex: RR123456789JP"
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                </div>
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
            <form
              onSubmit={handleSetQuote}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            >
              <div
                className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-earth-900">Definir orçamento (Personal Shopping)</h3>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Valor (¥)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={quoteModal.amount}
                      onChange={(e) =>
                        setQuoteModal((m) => ({ ...m, amount: e.target.value }))
                      }
                      placeholder="Ex: 150.00"
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Moeda</label>
                    <input
                      value="JPY (¥)"
                      disabled
                      className="mt-1 block w-full rounded-lg border border-earth-300 bg-earth-50 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Mensagem / descrição do pedido</label>
                    <textarea
                      value={quoteModal.message}
                      onChange={(e) =>
                        setQuoteModal((m) => ({ ...m, message: e.target.value }))
                      }
                      rows={4}
                      placeholder="Descreva o orçamento (itens, quantidades, links, observações...)"
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
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
                    onClick={() => setQuoteModal({ open: false, orderId: null, amount: '', currency: 'JPY', message: '' })}
                    className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          )}

          {orderEditModal.open && (
            <form
              onSubmit={handleSaveOrderEdit}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            >
              <div
                className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-earth-900">Editar pedido</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Serviço</label>
                    <select
                      value={orderEditModal.service_id}
                      onChange={(e) =>
                        setOrderEditModal((m) => ({ ...m, service_id: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    >
                      <option value="">Sem serviço</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Status</label>
                    <select
                      value={orderEditModal.status}
                      onChange={(e) =>
                        setOrderEditModal((m) => ({ ...m, status: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    >
                      {Object.values(ORDER_STATUS).map((status) => (
                        <option key={status} value={status}>
                          {ORDER_STATUS_LABELS[status] ?? status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-earth-700">Mensagem</label>
                  <textarea
                    value={orderEditModal.message}
                    onChange={(e) =>
                      setOrderEditModal((m) => ({ ...m, message: e.target.value }))
                    }
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />
                </div>
                {(orderEditModal.status === 'item_received' || orderEditModal.status === 'stored') && (
                  <div className="mt-3">
                    <span className="block text-sm font-medium text-earth-700">Serviços extras</span>
                    <div className="mt-2 flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={orderEditModal.extra_services?.photos ?? false}
                          onChange={(e) =>
                            setOrderEditModal((m) => ({
                              ...m,
                              extra_services: { ...m.extra_services, photos: e.target.checked },
                            }))
                          }
                          className="rounded border-earth-300"
                        />
                        <span className="text-sm text-earth-700">Fotos</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={orderEditModal.extra_services?.video ?? false}
                          onChange={(e) =>
                            setOrderEditModal((m) => ({
                              ...m,
                              extra_services: { ...m.extra_services, video: e.target.checked },
                            }))
                          }
                          className="rounded border-earth-300"
                        />
                        <span className="text-sm text-earth-700">Vídeo</span>
                      </label>
                    </div>
                  </div>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Frete</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={orderEditModal.shipping_cost}
                      onChange={(e) =>
                        setOrderEditModal((m) => ({ ...m, shipping_cost: e.target.value }))
                      }
                      placeholder="Ex: 1200"
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Moeda</label>
                    <input
                      value="JPY (¥)"
                      disabled
                      className="mt-1 block w-full rounded-lg border border-earth-300 bg-earth-50 px-3 py-2 text-earth-900"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800"
                  >
                    Salvar alterações
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
            <form
              onSubmit={handleAddToInventory}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            >
              <div
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-earth-900">Adicionar ao inventário do usuário</h3>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Nome do item *</label>
                    <input
                      type="text"
                      required
                      value={inventoryModal.name}
                      onChange={(e) => setInventoryModal((m) => ({ ...m, name: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Observações</label>
                    <textarea
                      value={inventoryModal.notes}
                      onChange={(e) => setInventoryModal((m) => ({ ...m, notes: e.target.value }))}
                      rows={2}
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Peso (kg)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={inventoryModal.weight_kg}
                      onChange={(e) => setInventoryModal((m) => ({ ...m, weight_kg: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">URL da foto</label>
                    <input
                      type="url"
                      value={inventoryModal.photo_url}
                      onChange={(e) => setInventoryModal((m) => ({ ...m, photo_url: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">URL do vídeo</label>
                    <input
                      type="url"
                      value={inventoryModal.video_url}
                      onChange={(e) => setInventoryModal((m) => ({ ...m, video_url: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
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
            <form
              onSubmit={handleCreateOrderForUser}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            >
              <div
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-earth-900">Criar pedido para usuário</h3>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Usuário *</label>
                    <select
                      required
                      value={createOrderModal.user_id}
                      onChange={(e) =>
                        setCreateOrderModal((m) => ({ ...m, user_id: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    >
                      <option value="">Selecione</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email} {u.account_code ? `(${u.account_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Serviço</label>
                    <select
                      value={createOrderModal.service_id}
                      onChange={(e) =>
                        setCreateOrderModal((m) => ({ ...m, service_id: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    >
                      <option value="">Sem serviço</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Mensagem</label>
                    <textarea
                      value={createOrderModal.message}
                      onChange={(e) =>
                        setCreateOrderModal((m) => ({ ...m, message: e.target.value }))
                      }
                      rows={2}
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
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
            <form
              onSubmit={handleRegisterPackage}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            >
              <div
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-earth-900">Registrar pacote na conta do usuário</h3>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Usuário *</label>
                    <select
                      required
                      value={registerPackageModal.user_id}
                      onChange={(e) =>
                        setRegisterPackageModal((m) => ({ ...m, user_id: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    >
                      <option value="">Selecione</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email} {u.account_code ? `(${u.account_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Descrição dos produtos *</label>
                    <textarea
                      required
                      value={registerPackageModal.products_description}
                      onChange={(e) =>
                        setRegisterPackageModal((m) => ({ ...m, products_description: e.target.value }))
                      }
                      rows={3}
                      placeholder="Ex: 2 camisetas, 1 calça..."
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-earth-700">Quantidade de itens</label>
                      <input
                        type="number"
                        min="0"
                        value={registerPackageModal.items_count}
                        onChange={(e) =>
                          setRegisterPackageModal((m) => ({ ...m, items_count: e.target.value }))
                        }
                        className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-earth-700">Peso (kg)</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={registerPackageModal.weight_kg}
                        onChange={(e) =>
                          setRegisterPackageModal((m) => ({ ...m, weight_kg: e.target.value }))
                        }
                        className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Pedido (ID) — opcional</label>
                    <input
                      type="text"
                      value={registerPackageModal.order_id}
                      onChange={(e) =>
                        setRegisterPackageModal((m) => ({ ...m, order_id: e.target.value }))
                      }
                      placeholder="UUID do pedido"
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">URL da foto</label>
                    <input
                      type="url"
                      value={registerPackageModal.photo_url}
                      onChange={(e) =>
                        setRegisterPackageModal((m) => ({ ...m, photo_url: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-earth-700">URL do vídeo</label>
                    <input
                      type="url"
                      value={registerPackageModal.video_url}
                      onChange={(e) =>
                        setRegisterPackageModal((m) => ({ ...m, video_url: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {submitting ? 'Registrando...' : 'Registrar pacote'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterPackageModal((m) => ({ ...m, open: false }))}
                    className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
        )}

        {/* Grupo de Compras */}
        {activeTab === 'grupos' && (
          <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
            <h2 className="text-lg font-semibold text-earth-900">Grupo de Compras</h2>

            <form onSubmit={handleSaveGroup} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-earth-700">Nome *</label>
                <input
                  required
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-earth-700">Descrição</label>
                <textarea
                  value={groupForm.description}
                  onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-earth-700">Produtos do grupo</label>
                <p className="mt-1 text-xs text-earth-500">
                  {editingGroupId ? 'Crie produtos específicos deste grupo' : 'Adicione produtos antes de criar o grupo'}
                </p>
                {editingGroupId && groupProducts.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {groupProducts.map((p) => (
                      <li key={p.id} className="flex items-center justify-between rounded-lg border border-earth-200 bg-white px-3 py-2">
                        <span className="text-sm text-earth-800">{p.name} — {formatJPY(brlToJpy(p.price))}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleEditGroupProduct(p)} className="text-sm font-medium text-earth-600 hover:text-earth-900">
                            Editar
                          </button>
                          <button type="button" onClick={() => handleDeleteGroupProduct(p.id)} className="text-sm font-medium text-red-600 hover:text-red-800">
                            Remover
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {!editingGroupId && pendingGroupProducts.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {pendingGroupProducts.map((p, i) => (
                      <li key={p.id} className="flex items-center justify-between rounded-lg border border-earth-200 bg-white px-3 py-2">
                        <span className="text-sm text-earth-800">{p.name} — {formatJPY(brlToJpy(p.price))}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleEditPendingGroupProduct(p, i)} className="text-sm font-medium text-earth-600 hover:text-earth-900">
                            Editar
                          </button>
                          <button type="button" onClick={() => handleRemovePendingGroupProduct(i)} className="text-sm font-medium text-red-600 hover:text-red-800">
                            Remover
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={handleSaveGroupProduct} className="mt-3 space-y-2 rounded-lg border border-earth-200 bg-earth-50 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Nome do produto"
                      value={groupProductForm.name}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, name: e.target.value }))}
                      className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                    <input
                      type="number"
                      placeholder="Preço (¥)"
                      value={groupProductForm.price}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, price: e.target.value }))}
                      className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="URL da imagem"
                      value={groupProductForm.image_url}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, image_url: e.target.value }))}
                      className="flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                    <input
                      type="number"
                      step="0.001"
                      placeholder="Peso kg"
                      value={groupProductForm.weight_kg}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, weight_kg: e.target.value }))}
                      className="w-24 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={groupProductSubmitting || !groupProductForm.name?.trim()} className="rounded-lg bg-earth-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-900 disabled:opacity-60">
                      {editingGroupProductId || editingPendingProductIndex != null ? 'Salvar' : 'Adicionar'} produto
                    </button>
                    {(editingGroupProductId || editingPendingProductIndex != null) && (
                      <button type="button" onClick={resetGroupProductForm} className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100">
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="group_is_active"
                  checked={groupForm.is_active}
                  onChange={(e) => setGroupForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-earth-300"
                />
                <label htmlFor="group_is_active" className="text-sm font-medium text-earth-700">
                  Ativo (visível na página de grupo de compras)
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-earth-700">Fotos do grupo (obrigatório)</label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50">
                    {groupImageUploading ? 'Enviando...' : 'Enviar arquivo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={groupImageUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setGroupImageUploadError('')
                        setGroupImageUploading(true)
                        try {
                          const { data, error } = await uploadProductImage(file)
                          if (error) {
                            setGroupImageUploadError(error.message || 'Falha no upload')
                            return
                          }
                          if (data) {
                            setGroupForm((f) => ({
                              ...f,
                              image_urls: [...(f.image_urls || []), data],
                              image_url: f.image_url || data,
                            }))
                          }
                        } finally {
                          setGroupImageUploading(false)
                          e.target.value = ''
                        }
                      }}
                    />
                  </label>

                  <input
                    type="url"
                    value={newGroupImageUrl}
                    onChange={(e) => {
                      setNewGroupImageUrl(e.target.value)
                      setGroupImageUploadError('')
                    }}
                    placeholder="Cole a URL e pressione Enter"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const url = newGroupImageUrl?.trim()
                        if (!url) return
                        setGroupForm((f) => ({
                          ...f,
                          image_urls: [...(f.image_urls || []), url],
                          image_url: f.image_url || url,
                        }))
                        setNewGroupImageUrl('')
                      }
                    }}
                    className="min-w-[200px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const url = newGroupImageUrl?.trim()
                      if (!url) return
                      setGroupForm((f) => ({
                        ...f,
                        image_urls: [...(f.image_urls || []), url],
                        image_url: f.image_url || url,
                      }))
                      setNewGroupImageUrl('')
                    }}
                    className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50"
                  >
                    Adicionar URL
                  </button>
                </div>

                {groupImageUploadError && <p className="mt-2 text-sm text-red-600">{groupImageUploadError}</p>}

                {groupForm.image_urls?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(groupForm.image_urls || []).filter(Boolean).map((url, i) => (
                      <div key={i} className="relative inline-block">
                        <img src={url} alt="" className="h-20 w-20 rounded border border-earth-200 object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const list = [...(groupForm.image_urls || [])]
                            list.splice(i, 1)
                            setGroupForm((f) => ({
                              ...f,
                              image_urls: list,
                              image_url: list[0] || '',
                            }))
                          }}
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                          aria-label="Remover foto"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={groupSubmitting}
                  className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {groupSubmitting ? (editingGroupId ? 'Salvando...' : 'Criando...') : (editingGroupId ? 'Salvar alterações' : 'Criar grupo de compra')}
                </button>
                <button
                  type="button"
                  onClick={resetGroupForm}
                  disabled={groupSubmitting}
                  className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                >
                  Cancelar
                </button>
              </div>
            </form>

            <div className="mt-6">
              <h3 className="font-medium text-earth-900">Grupos cadastrados</h3>
              {groupsLoading && <p className="mt-2 text-sm text-earth-600">Carregando...</p>}
              {!groupsLoading && purchaseGroups.length === 0 && (
                <p className="mt-2 text-sm text-earth-600">Nenhum grupo ainda.</p>
              )}
              {!groupsLoading && purchaseGroups.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {purchaseGroups.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-start justify-between gap-4 rounded-lg border border-earth-200 bg-white p-4"
                    >
                      <div className="flex items-start gap-4">
                        {g.image_url ? (
                          <img src={g.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                        ) : (
                          <div className="h-12 w-12 rounded bg-earth-200" />
                        )}
                        <div>
                          <p className="font-medium text-earth-900">{g.name}</p>
                          {g.description && <p className="mt-1 text-sm text-earth-600 line-clamp-2">{g.description}</p>}
                          <p className="mt-1 text-xs text-earth-500">
                            Produtos: {g.products_count ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {!g.is_active && (
                          <span className="rounded bg-amber-200 px-2 py-0.5 text-xs text-amber-900">Inativo</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditGroup(g)}
                          className="text-sm font-medium text-earth-600 hover:text-earth-900"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(g.id)}
                          className="text-sm font-medium text-red-600 hover:text-red-800"
                        >
                          Remover
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Logs */}
        {activeTab === 'logs' && (
          <section className="mt-0 space-y-6 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
            {/* Painel 1: Atividades dos usuários */}
            <div>
              <h2 className="text-lg font-semibold text-earth-900">Atividades dos usuários</h2>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => loadUserLogs()}
                  disabled={userLogsLoading}
                  className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
                >
                  {userLogsLoading ? 'Atualizando...' : 'Atualizar'}
                </button>
              </div>
              {userLogsLoading && <p className="mt-4 text-sm text-earth-600">Carregando...</p>}
              {!userLogsLoading && userLogs.length === 0 && (
                <p className="mt-4 text-sm text-earth-600">Nenhum registro ainda.</p>
              )}
              {!userLogsLoading && userLogs.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-earth-200 bg-white">
                  <table className="min-w-full divide-y divide-earth-200 text-left text-sm">
                    <thead>
                      <tr className="bg-earth-50">
                        <th className="px-4 py-3 font-medium text-earth-900">Data</th>
                        <th className="px-4 py-3 font-medium text-earth-900">Usuário</th>
                        <th className="px-4 py-3 font-medium text-earth-900">Ação</th>
                        <th className="px-4 py-3 font-medium text-earth-900">Entidade</th>
                        <th className="px-4 py-3 font-medium text-earth-900">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-earth-200">
                      {userLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-earth-50/50">
                          <td className="whitespace-nowrap px-4 py-2 text-earth-600">
                            {log.created_at
                              ? new Date(log.created_at).toLocaleString('pt-BR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-2 text-earth-700">
                            {log.user_name || log.user_email || log.user_id?.slice(0, 8) || '—'}
                          </td>
                          <td className="px-4 py-2 font-medium text-earth-900">
                            {log.action === 'order_create' ? 'Criou pedido' : log.action === 'cart_add' ? 'Adicionou ao carrinho' : log.action === 'profile_update' ? 'Atualizou perfil' : log.action || '—'}
                          </td>
                          <td className="px-4 py-2 text-earth-600">
                            {log.entity_type && log.entity_id ? (
                              <span>
                                {log.entity_type === 'order' ? 'Pedido' : log.entity_type === 'product' ? 'Produto' : log.entity_type} · {String(log.entity_id).slice(0, 8)}…
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2 text-earth-600">
                            {log.details && Object.keys(log.details).length > 0
                              ? JSON.stringify(log.details)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Painel 2: Registro / Login dos usuários */}
            <div>
              <h2 className="text-lg font-semibold text-earth-900">Registro e login</h2>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => loadAuthLogs()}
                  disabled={authLogsLoading}
                  className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
                >
                  {authLogsLoading ? 'Atualizando...' : 'Atualizar'}
                </button>
              </div>
              {authLogsLoading && <p className="mt-4 text-sm text-earth-600">Carregando...</p>}
              {!authLogsLoading && authLogs.length === 0 && (
                <p className="mt-4 text-sm text-earth-600">Nenhum registro ainda.</p>
              )}
              {!authLogsLoading && authLogs.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-earth-200 bg-white">
                  <table className="min-w-full divide-y divide-earth-200 text-left text-sm">
                    <thead>
                      <tr className="bg-earth-50">
                        <th className="px-4 py-3 font-medium text-earth-900">Data</th>
                        <th className="px-4 py-3 font-medium text-earth-900">Evento</th>
                        <th className="px-4 py-3 font-medium text-earth-900">Email / Usuário</th>
                        <th className="px-4 py-3 font-medium text-earth-900">ID usuário</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-earth-200">
                      {authLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-earth-50/50">
                          <td className="whitespace-nowrap px-4 py-2 text-earth-600">
                            {log.created_at
                              ? new Date(log.created_at).toLocaleString('pt-BR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-2 font-medium text-earth-900">
                            {log.action === 'user_signedup' ? 'Cadastro' : log.action === 'login' ? 'Login' : log.action || '—'}
                          </td>
                          <td className="px-4 py-2 text-earth-700">{log.email || '—'}</td>
                          <td className="px-4 py-2 text-earth-600 font-mono text-xs">
                            {log.user_id ? String(log.user_id).slice(0, 8) + '…' : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Painel de Envios */}
        {activeTab === 'envios' && (
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
              {/* Pedidos em fluxo de envio */}
              <div>
                <h3 className="font-medium text-earth-900">Pedidos em fluxo de envio</h3>
                {(!shippingPanel.orders || shippingPanel.orders.length === 0) ? (
                  <p className="mt-4 text-sm text-earth-500">Nenhum pedido em fluxo de envio.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {shippingPanel.orders.map((o) => (
                      <li key={o.id} className="rounded-lg border border-earth-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <span className="font-medium text-earth-900">Pedido {o.id?.slice(0, 8)}…</span>
                            <span className="ml-2 rounded bg-earth-200 px-2 py-0.5 text-xs text-earth-700">
                              {ORDER_STATUS_LABELS[o.status] ?? o.status}
                            </span>
                            <p className="mt-1 text-sm text-earth-600">
                              {o.user_name || o.user_email || o.user_id} • {o.order_source === 'store' ? 'Loja' : o.service_name || '—'}
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
                                onClick={() => {
                                  setActiveTab('pedidos')
                                  loadOrders()
                                  openShippingModal(o)
                                }}
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

              {/* Solicitações de envio (shipments) */}
              <div>
                <h3 className="font-medium text-earth-900">Solicitações de envio</h3>
                {(!shippingPanel.shipments || shippingPanel.shipments.length === 0) ? (
                  <p className="mt-4 text-sm text-earth-500">Nenhuma solicitação de envio.</p>
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
                              <span className="font-medium text-earth-900">Envio {s.id?.slice(0, 8)}…</span>
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
                                  Pedidos vinculados: {s.order_ids.filter(Boolean).map((id) => id?.slice(0, 8)).join(', ')}…
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
                                    setActiveTab('pedidos')
                                    await loadOrders()
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

              {/* Inventário pronto para envio */}
              <div>
                <h3 className="font-medium text-earth-900">Itens prontos para envio</h3>
                {(!shippingPanel.inventoryReady || shippingPanel.inventoryReady.length === 0) ? (
                  <p className="mt-4 text-sm text-earth-500">Nenhum item pronto para envio.</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {shippingPanel.inventoryReady.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between rounded border border-earth-100 bg-white px-4 py-2 text-sm">
                        <span className="text-earth-800">{inv.name || inv.id?.slice(0, 8)}</span>
                        <span className="text-earth-600">{inv.user_name || inv.user_email} • Pedido {inv.order_id?.slice(0, 8)}…</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
        )}

        {/* Loja - Produtos */}
        {activeTab === 'produtos' && (
        <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
          <h2 className="text-lg font-semibold text-earth-900">Produtos</h2>

          <form onSubmit={handleSave} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-earth-700">Nome *</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-earth-700">Preço (¥ JPY) *</label>
                <input
                  required
                  type="number"
                  step="1"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-earth-700">Peso do produto (kg) *</label>
                <input
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.weight_kg}
                  onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-earth-700">Estoque</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                  placeholder="Ilimitado (deixe vazio)"
                  className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-earth-700">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-earth-700">Fotos do produto (pode adicionar várias)</label>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50">
                  {imageUploading ? 'Enviando...' : 'Enviar arquivo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={imageUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setImageUploadError('')
                      setImageUploading(true)
                      try {
                        const { data, error } = await uploadProductImage(file)
                        if (error) {
                          setImageUploadError(error.message || 'Falha no upload')
                          return
                        }
                        if (data) {
                          setForm((f) => ({
                            ...f,
                            image_urls: [...(f.image_urls || []), data],
                            image_url: f.image_url || data,
                          }))
                        }
                      } finally {
                        setImageUploading(false)
                        e.target.value = ''
                      }
                    }}
                  />
                </label>
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => {
                    setNewImageUrl(e.target.value)
                    setImageUploadError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const url = newImageUrl?.trim()
                      if (url) {
                        setForm((f) => ({
                          ...f,
                          image_urls: [...(f.image_urls || []), url],
                          image_url: f.image_url || url,
                        }))
                        setNewImageUrl('')
                      }
                    }
                  }}
                  placeholder="Cole a URL e pressione Enter"
                  className="min-w-[200px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = newImageUrl?.trim()
                    if (url) {
                      setForm((f) => ({
                        ...f,
                        image_urls: [...(f.image_urls || []), url],
                        image_url: f.image_url || url,
                      }))
                      setNewImageUrl('')
                    }
                  }}
                  className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50"
                >
                  Adicionar URL
                </button>
              </div>
              {imageUploadError && (
                <p className="mt-1 text-sm text-red-600">{imageUploadError}</p>
              )}
              {(form.image_urls?.length > 0 || form.image_url) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(form.image_urls?.length ? form.image_urls : [form.image_url]).filter(Boolean).map((url, i) => (
                    <div key={i} className="relative inline-block">
                      <img src={url} alt="" className="h-20 w-20 rounded border border-earth-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const list = [...(form.image_urls || [])]
                          if (!list.length && form.image_url) list.push(form.image_url)
                          list.splice(i, 1)
                          setForm((f) => ({
                            ...f,
                            image_urls: list,
                            image_url: list[0] || '',
                          }))
                        }}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                        aria-label="Remover foto"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-earth-300"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-earth-700">
                Ativo (visível na loja)
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-earth-900 px-4 py-2 font-medium text-earth-50 hover:bg-earth-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (editingId ? 'Atualizando...' : 'Criando...') : (editingId ? 'Atualizar' : 'Criar produto')}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-earth-300 px-4 py-2 font-medium text-earth-700 hover:bg-earth-100"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="mt-6">
            <h3 className="font-medium text-earth-900">Produtos cadastrados</h3>
            {loading && <p className="mt-2 text-sm text-earth-600">Carregando...</p>}
            {!loading && products.length === 0 && (
              <p className="mt-2 text-sm text-earth-600">Nenhum produto ainda.</p>
            )}
            {!loading && products.length > 0 && (
              <ul className="mt-4 space-y-2">
                {products.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-earth-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-4">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-earth-200" />
                      )}
                      <div>
                        <span className="font-medium text-earth-900">{p.name}</span>
                        <span className="ml-2 text-sm text-earth-600">{formatJPY(brlToJpy(p.price))}</span>
                        <span className="ml-2 text-xs text-earth-500">
                          {Number(p.weight_kg ?? 0) > 0 ? `• ${p.weight_kg}kg` : '• peso não definido'}
                        </span>
                        <span className="ml-2 text-xs text-earth-500">
                          • Estoque: {p.stock_quantity != null ? p.stock_quantity : 'ilimitado'}
                        </span>
                        {!p.is_active && (
                          <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs text-amber-900">
                            Inativo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(p)}
                        className="text-sm font-medium text-earth-600 hover:text-earth-900"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        )}
      </div>
    </>
  )
}

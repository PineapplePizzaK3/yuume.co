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
import { addInventoryFromOrderAdmin, registerPackageAdmin } from '../../services/inventoryService'
import { getUsersAdmin } from '../../services/profileService'
import {
  createPurchaseGroup,
  getPurchaseGroupsAdmin,
  updatePurchaseGroup,
  deletePurchaseGroup,
} from '../../services/groupService'
import { brlToJpy, jpyToBrl, formatJPY } from '../../lib/fx'

function formatMoney(v, currency = 'BRL') {
  return Number(v)?.toLocaleString('pt-BR', { style: 'currency', currency }) ?? '—'
}

function formatOrderModuleLabel(order) {
  if (!order) return null
  if (order.order_module === 'self_buy') return 'Redirecionamento: eu compro'
  if (order.order_module === 'assisted_buy') return 'Redirecionamento: pré-pagamento'
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
    product_ids: [],
  })
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [groupImageUploading, setGroupImageUploading] = useState(false)
  const [groupImageUploadError, setGroupImageUploadError] = useState('')
  const [newGroupImageUrl, setNewGroupImageUrl] = useState('')

  const TABS = [
    { id: 'pedidos', label: 'Pedidos', icon: '📦' },
    { id: 'produtos', label: 'Loja / Produtos', icon: '🛒' },
    { id: 'grupos', label: 'Grupo de Compras', icon: '👥' },
  ]

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

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      price: '',
      weight_kg: '',
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
      product_ids: [],
    })
    setEditingGroupId(null)
    setGroupImageUploadError('')
    setNewGroupImageUrl('')
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
        product_ids: Array.isArray(groupForm.product_ids) ? groupForm.product_ids : [],
      }

      const { error } = editingGroupId
        ? await updatePurchaseGroup(editingGroupId, payload)
        : await createPurchaseGroup(payload)
      if (error) {
        setMessage(error.message || (editingGroupId ? 'Erro ao atualizar grupo' : 'Erro ao criar grupo'))
        return
      }

      setMessage(editingGroupId ? 'Grupo atualizado com sucesso' : 'Grupo criado com sucesso')
      resetGroupForm()
      loadGroups()
    } finally {
      setGroupSubmitting(false)
    }
  }

  const handleEditGroup = (group) => {
    setGroupForm({
      name: group.name ?? '',
      description: group.description ?? '',
      image_url: group.image_url ?? '',
      image_urls: Array.isArray(group.image_urls) ? group.image_urls.filter(Boolean) : [],
      is_active: group.is_active ?? true,
      product_ids: Array.isArray(group.product_ids) ? group.product_ids.filter(Boolean) : [],
    })
    setEditingGroupId(group.id)
    setGroupImageUploadError('')
    setNewGroupImageUrl('')
  }

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Remover este grupo de compras?')) return
    const { error } = await deletePurchaseGroup(groupId)
    setMessage(error ? error.message : 'Grupo removido')
    if (!error) {
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
    const payload = {
      name: form.name,
      description: form.description || null,
      price,
      weight_kg: weightKg,
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
          resetForm()
          loadProducts()
        }
      } else {
        const { error } = await createProduct(payload)
        setMessage(error ? error.message : 'Produto criado')
        if (!error) {
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
    setMessage(error ? error.message : 'Produto removido')
    if (!error) loadProducts()
  }

  const handleOrderStatus = async (orderId, status) => {
    const { error } = await updateOrderStatusAdmin(orderId, status)
    setMessage(error ? error.message : 'Status atualizado')
    if (!error) loadOrders()
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
      setShippingModal({ open: false, orderId: null, cost: '', currency: 'JPY' })
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
      closeOrderEditModal()
      loadOrders()
    }
  }

  const handleDeleteOrder = async (orderId) => {
    if (!confirm('Remover este pedido? Esta ação não pode ser desfeita.')) return
    const { error } = await deleteOrderAdmin(orderId)
    setMessage(error ? error.message : 'Pedido removido')
    if (!error) loadOrders()
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
        <h1 className="text-2xl font-bold text-earth-900">Admin</h1>
        <p className="mt-2 text-earth-600">
          Área de gestão da plataforma
        </p>
        <div className="mt-6 rounded-lg border border-earth-200 bg-earth-100 p-4">
          <h2 className="font-semibold text-earth-900">Sessão admin</h2>
          <p className="mt-1 text-sm text-earth-600">
            Logado como: {user?.email}
          </p>
          <p className="text-sm text-earth-600">
            Perfil: {profile?.name || '—'} • Role: {profile?.role}
          </p>
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
          <p className="mt-1 text-sm text-earth-600">
            Fluxo Redirecionamento: pedido (user ou admin) → aprovação → aguardando pacotes → admin registra pacotes na conta do user → user solicita envio → invoice/frete/serviços extras → pagamento → enviado + rastreio
          </p>
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
                              if (!error) loadOrders()
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
                              if (!error) loadOrders()
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
                <p className="mt-1 text-sm text-earth-600">
                  O cliente será notificado para pagar o frete.
                </p>
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
                <p className="mt-1 text-sm text-earth-600">
                  O cliente poderá pagar o orçamento na página Pedidos.
                </p>
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
                <p className="mt-1 text-sm text-earth-600">
                  Atualize status, serviço, mensagem e dados de frete.
                </p>
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
                    <p className="mt-1 text-xs text-earth-500">Fotos e/ou vídeo do produto (disponíveis quando status = Item recebido)</p>
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
                <p className="mt-1 text-sm text-earth-600">
                  O item aparecerá em &quot;Meus Produtos&quot; para o cliente solicitar envio.
                </p>
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
                <p className="mt-1 text-sm text-earth-600">
                  O pedido será criado na conta do usuário com status &quot;Aguardando aprovação&quot;.
                </p>
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
                <p className="mt-1 text-sm text-earth-600">
                  Dados do pacote: descrição, quantidade de itens e peso. O tempo de armazenamento é contado automaticamente a partir do registro.
                </p>
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
            <p className="mt-1 text-sm text-earth-600">Crie grupos exibidos na página de Grupo de Compras</p>

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
                  Selecione os produtos que estarão disponíveis para compra dentro deste grupo.
                </p>
                {products.length === 0 ? (
                  <p className="mt-2 text-sm text-earth-600">Nenhum produto cadastrado ainda.</p>
                ) : (
                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-earth-200 bg-white p-3">
                    {products.map((p) => (
                      <label key={p.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={groupForm.product_ids?.includes(p.id)}
                          onChange={(e) =>
                            setGroupForm((f) => {
                              const current = Array.isArray(f.product_ids) ? f.product_ids : []
                              return {
                                ...f,
                                product_ids: e.target.checked
                                  ? [...current, p.id]
                                  : current.filter((id) => id !== p.id),
                              }
                            })
                          }
                          className="rounded border-earth-300"
                        />
                        <span className="text-sm text-earth-700">
                          {p.name} - {formatJPY(brlToJpy(p.price))}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
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
                            Produtos vinculados: {Array.isArray(g.product_ids) ? g.product_ids.length : 0}
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

        {/* Loja - Produtos */}
        {activeTab === 'produtos' && (
        <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
          <h2 className="text-lg font-semibold text-earth-900">Loja Virtual - Produtos</h2>
          <p className="mt-1 text-sm text-earth-600">Criar e editar itens exibidos na loja</p>

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

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
import { getUsersAdmin, getUserFullAdmin, updateProfileAdmin } from '../../services/profileService'
import {
  addWalletBalanceAdmin,
  getWalletTopupRequestsAdmin,
  approveWalletTopupAdmin,
  rejectWalletTopupAdmin,
} from '../../services/walletService'
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
import { getMyAdminNotifications, markNotificationRead } from '../../services/notificationService'
import { getFraudReviewQueue, decideFraudCase } from '../../services/fraudService'
import { searchCatalogAdmin } from '../../services/catalogSearchService'
import { brlToJpy, jpyToBrl, formatJPY, formatWeight } from '../../lib/fx'
import { parseQuoteMessage, serializeQuoteProducts } from '../../lib/quoteProducts'
import QuoteProductsList from '../../components/QuoteProductsList'
import OrderAttachments from '../../components/OrderAttachments'
import { getSystemSettings, saveSystemSettingsAdmin } from '../../services/settingsService'

function formatMoney(v, currency = 'BRL') {
  return Number(v)?.toLocaleString('pt-BR', { style: 'currency', currency }) ?? '—'
}

const ADMIN_PAGE_SIZE = {
  orders: 100,
  products: 120,
  users: 100,
}
const ADMIN_TAB_ORDER_STORAGE_KEY = 'admin_tabs_order_v1'

function formatOrderModuleLabel(order) {
  if (!order) return null
  if (order.order_module === 'self_buy') return 'Redirecionamento · Padrão'
  if (order.order_module === 'assisted_buy') return 'Redirecionamento · Assistido'
  return null
}

function PaginationControls({ page, hasMore, loading, onPrev, onNext }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-white px-3 py-2 text-sm">
      <span className="text-earth-600">Página {page + 1}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={loading || page <= 0}
          className="rounded border border-earth-300 px-3 py-1.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={loading || !hasMore}
          className="rounded border border-earth-300 px-3 py-1.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
        >
          Próxima
        </button>
      </div>
    </div>
  )
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
    weight_unit: 'g',
    stock_quantity: '',
    image_url: '',
    image_urls: [],
    is_active: true,
  })
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUploadError, setImageUploadError] = useState('')
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [shippingModal, setShippingModal] = useState({ open: false, orderId: null, cost: '', currency: 'JPY' })
  const [quoteModal, setQuoteModal] = useState({
    open: false,
    orderId: null,
    orderDescription: '',
    products: [{ name: '', valor: '', quantidade: 1, descricao: '' }],
    currency: 'JPY',
  })
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
  const [groupProductImageUploading, setGroupProductImageUploading] = useState(false)
  const [groupProducts, setGroupProducts] = useState([])
  const [pendingGroupProducts, setPendingGroupProducts] = useState([])
  const [groupProductForm, setGroupProductForm] = useState({
    name: '',
    price: '',
    description: '',
    image_url: '',
    image_urls: [],
    weight_kg: '0',
    weight_unit: 'g',
    stock_quantity: '',
  })
  const [editingGroupProductId, setEditingGroupProductId] = useState(null)
  const [editingPendingProductIndex, setEditingPendingProductIndex] = useState(null)
  const [groupProductSubmitting, setGroupProductSubmitting] = useState(false)

  const TABS = [
    { id: 'pedidos', label: 'Pedidos', icon: '📦' },
    { id: 'usuarios', label: 'Usuários', icon: '👤' },
    { id: 'envios', label: 'Envios', icon: '🚚' },
    { id: 'produtos', label: 'Produtos Loja', icon: '🛒' },
    { id: 'catalogo_produtos', label: 'Lista de Produtos', icon: '📚' },
    { id: 'busca_catalogo', label: 'Busca em Catálogos', icon: '🔎' },
    { id: 'grupos', label: 'Grupo de Compras', icon: '👥' },
    { id: 'marketing', label: 'Referral', icon: '🎯' },
    { id: 'fraude', label: 'Fraude', icon: '🛡️' },
    { id: 'notificacoes', label: 'Notificações', icon: '🔔' },
    { id: 'recargas', label: 'Recargas PIX', icon: '💰' },
    { id: 'logs', label: 'Logs', icon: '📋' },
  ]

  const [usersList, setUsersList] = useState([])
  const [usersListLoading, setUsersListLoading] = useState(false)
  const [topupRequests, setTopupRequests] = useState([])
  const [topupLoading, setTopupLoading] = useState(false)
  const [marketingLoading, setMarketingLoading] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    referral_discount_value: '',
    referral_credit_value: '',
    fx_brl_per_jpy: '0.033',
  })
  const [adminNotifications, setAdminNotifications] = useState([])
  const [adminNotificationsLoading, setAdminNotificationsLoading] = useState(false)
  const [fraudQueue, setFraudQueue] = useState({ referrals: [], affiliate_orders: [], fraud_logs: [] })
  const [fraudQueueLoading, setFraudQueueLoading] = useState(false)
  const [fraudDecisionLoadingId, setFraudDecisionLoadingId] = useState('')
  const [fraudMinScore, setFraudMinScore] = useState('0')
  const [fraudStatusFilter, setFraudStatusFilter] = useState('all')
  const [fraudSearchTerm, setFraudSearchTerm] = useState('')
  const [userDetailModal, setUserDetailModal] = useState({
    open: false,
    user: null,
    profile: null,
    wallet: null,
    ordersCount: 0,
    profileForm: { name: '', email: '', cpf_cnpj: '', phone: '', role: 'user', account_code: '' },
    walletAmount: '',
    walletDesc: '',
    loading: false,
    saving: false,
    walletSaving: false,
  })

  const [userLogs, setUserLogs] = useState([])
  const [userLogsLoading, setUserLogsLoading] = useState(false)
  const [authLogs, setAuthLogs] = useState([])
  const [authLogsLoading, setAuthLogsLoading] = useState(false)

  const [shippingPanel, setShippingPanel] = useState({ shipments: [], orders: [], inventoryReady: [] })
  const [shippingPanelLoading, setShippingPanelLoading] = useState(false)
  const [shipmentFreightModal, setShipmentFreightModal] = useState({ open: false, shipmentId: null, cost: '', currency: 'JPY' })
  const [shipmentShippedModal, setShipmentShippedModal] = useState({ open: false, shipmentId: null, trackingCode: '' })
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogStatusFilter, setCatalogStatusFilter] = useState('all')
  const [catalogCreateOpen, setCatalogCreateOpen] = useState(false)
  const [productReferenceSearch, setProductReferenceSearch] = useState('')
  const [productReferenceId, setProductReferenceId] = useState('')
  const [groupProductReferenceSearch, setGroupProductReferenceSearch] = useState('')
  const [groupProductReferenceId, setGroupProductReferenceId] = useState('')
  const [externalSearchQuery, setExternalSearchQuery] = useState('')
  const [externalSearchStores, setExternalSearchStores] = useState({
    amazon: true,
    rakuma: true,
    mercari: true,
  })
  const [externalSearchResults, setExternalSearchResults] = useState([])
  const [externalSearchMeta, setExternalSearchMeta] = useState(null)
  const [externalSearchPartials, setExternalSearchPartials] = useState([])
  const [externalSearchLoading, setExternalSearchLoading] = useState(false)
  const [externalSearchPage, setExternalSearchPage] = useState(1)
  const [externalSearchError, setExternalSearchError] = useState('')
  const [ordersPage, setOrdersPage] = useState(0)
  const [ordersHasMore, setOrdersHasMore] = useState(false)
  const [productsPage, setProductsPage] = useState(0)
  const [productsHasMore, setProductsHasMore] = useState(false)
  const [usersPage, setUsersPage] = useState(0)
  const [usersHasMore, setUsersHasMore] = useState(false)
  const [draggingTabId, setDraggingTabId] = useState('')
  const [tabOrder, setTabOrder] = useState(TABS.map((tab) => tab.id))

  const normalizeTabOrder = (raw) => {
    const allowed = TABS.map((tab) => tab.id)
    const base = Array.isArray(raw) ? raw : []
    const safe = base.filter((id) => allowed.includes(id))
    for (const id of allowed) {
      if (!safe.includes(id)) safe.push(id)
    }
    return safe
  }

  const orderedTabs = normalizeTabOrder(tabOrder)

  const handleTabReorder = (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return
    setTabOrder((prev) => {
      const current = normalizeTabOrder(prev)
      const draggedIndex = current.indexOf(draggedId)
      const targetIndex = current.indexOf(targetId)
      if (draggedIndex < 0 || targetIndex < 0) return current
      current.splice(draggedIndex, 1)
      current.splice(targetIndex, 0, draggedId)
      return current
    })
  }

  const loadProducts = async (active = () => true, page = productsPage) => {
    if (active()) setLoading(true)
    try {
      const { data, error } = await getProductsAdmin(
        ADMIN_PAGE_SIZE.products,
        page * ADMIN_PAGE_SIZE.products
      )
      if (!active()) return
      const list = data ?? []
      setProducts(list)
      setProductsHasMore(list.length === ADMIN_PAGE_SIZE.products)
      if (error) setMessage(error.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar produtos')
    } finally {
      if (active()) setLoading(false)
    }
  }

  const loadOrders = async (active = () => true, page = ordersPage) => {
    if (active()) setOrdersLoading(true)
    try {
      const { data, error } = await getAllOrdersAdmin(
        ADMIN_PAGE_SIZE.orders,
        page * ADMIN_PAGE_SIZE.orders
      )
      if (!active()) return
      const list = data ?? []
      setOrders(list)
      setOrdersHasMore(list.length === ADMIN_PAGE_SIZE.orders)
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
  }, [productsPage])

  useEffect(() => {
    let isActive = true
    loadOrders(() => isActive)
    return () => {
      isActive = false
    }
  }, [ordersPage])

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
    if (!user?.id) {
      setTabOrder(TABS.map((tab) => tab.id))
      return
    }
    try {
      const raw = localStorage.getItem(ADMIN_TAB_ORDER_STORAGE_KEY)
      if (!raw) {
        setTabOrder(TABS.map((tab) => tab.id))
        return
      }
      const all = JSON.parse(raw)
      setTabOrder(normalizeTabOrder(all?.[user.id]))
    } catch {
      setTabOrder(TABS.map((tab) => tab.id))
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(ADMIN_TAB_ORDER_STORAGE_KEY)
      const all = raw ? JSON.parse(raw) : {}
      all[user.id] = normalizeTabOrder(tabOrder)
      localStorage.setItem(ADMIN_TAB_ORDER_STORAGE_KEY, JSON.stringify(all))
    } catch {
      // ignore
    }
  }, [user?.id, tabOrder])

  const loadUsersForAdmin = async (active = () => true, page = usersPage) => {
    if (active()) setUsersListLoading(true)
    try {
      const { data, error } = await getUsersAdmin(
        ADMIN_PAGE_SIZE.users,
        page * ADMIN_PAGE_SIZE.users
      )
      if (!active()) return
      const list = data ?? []
      setUsersList(list)
      setUsersHasMore(list.length === ADMIN_PAGE_SIZE.users)
      if (error) setMessage(error.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar usuários')
    } finally {
      if (active()) setUsersListLoading(false)
    }
  }

  const openUserDetail = async (u) => {
    setUserDetailModal((m) => ({ ...m, open: true, user: u, loading: true, profile: null, wallet: null, ordersCount: 0 }))
    try {
      const { data, error } = await getUserFullAdmin(u.id)
      if (error) {
        setMessage(error.message)
        return
      }
      const p = data?.profile ?? {}
      setUserDetailModal((m) => ({
        ...m,
        loading: false,
        profile: p,
        wallet: data?.wallet ?? { balance: 0, currency: 'JPY' },
        ordersCount: data?.orders_count ?? 0,
        profileForm: {
          name: p.name ?? '',
          email: p.email ?? '',
          cpf_cnpj: p.cpf_cnpj ?? '',
          phone: p.phone ?? '',
          role: p.role ?? 'user',
          account_code: p.account_code ?? '',
        },
        walletAmount: '',
        walletDesc: '',
      }))
    } catch (e) {
      setMessage(e?.message || 'Erro ao carregar usuário')
      setUserDetailModal((m) => ({ ...m, loading: false }))
    }
  }

  const closeUserDetail = () => {
    setUserDetailModal({
      open: false,
      user: null,
      profile: null,
      wallet: null,
      ordersCount: 0,
      profileForm: { name: '', email: '', cpf_cnpj: '', phone: '', role: 'user', account_code: '' },
      walletAmount: '',
      walletDesc: '',
      loading: false,
      saving: false,
      walletSaving: false,
    })
  }

  const handleSaveProfileEdit = async (e) => {
    e.preventDefault()
    const uid = userDetailModal.user?.id
    if (!uid) return
    setUserDetailModal((m) => ({ ...m, saving: true }))
    setMessage('')
    try {
      const { error } = await updateProfileAdmin(uid, {
        name: userDetailModal.profileForm.name.trim() || null,
        email: userDetailModal.profileForm.email.trim() || null,
        cpf_cnpj: userDetailModal.profileForm.cpf_cnpj.trim() || null,
        phone: userDetailModal.profileForm.phone.trim() || null,
        role: userDetailModal.profileForm.role,
        account_code: userDetailModal.profileForm.account_code.trim() || null,
      })
      if (error) {
        setMessage(error.message)
        return
      }
      logAdminAction('profile_edit', 'profile', uid, {})
      const { data } = await getUserFullAdmin(uid)
      const p = data?.profile ?? {}
      setUserDetailModal((m) => ({
        ...m,
        saving: false,
        profile: p,
        profileForm: {
          name: p.name ?? '',
          email: p.email ?? '',
          cpf_cnpj: p.cpf_cnpj ?? '',
          phone: p.phone ?? '',
          role: p.role ?? 'user',
          account_code: p.account_code ?? '',
        },
      }))
      setMessage('Perfil atualizado.')
    } catch (e) {
      setMessage(e?.message || 'Erro ao atualizar perfil')
      setUserDetailModal((m) => ({ ...m, saving: false }))
    }
  }

  const handleAddWalletBalance = async (e) => {
    e.preventDefault()
    const uid = userDetailModal.user?.id
    if (!uid) return
    const amount = parseFloat(userDetailModal.walletAmount)
    if (isNaN(amount) || amount <= 0) {
      setMessage('Informe um valor positivo.')
      return
    }
    setUserDetailModal((m) => ({ ...m, walletSaving: true }))
    setMessage('')
    try {
      const { error } = await addWalletBalanceAdmin(uid, amount, userDetailModal.walletDesc.trim() || null)
      if (error) {
        setMessage(error.message)
        setUserDetailModal((m) => ({ ...m, walletSaving: false }))
        return
      }
      logAdminAction('wallet_credit', 'profile', uid, { amount, description: userDetailModal.walletDesc })
      const { data } = await getUserFullAdmin(uid)
      setUserDetailModal((m) => ({
        ...m,
        walletSaving: false,
        wallet: data?.wallet ?? { balance: 0, currency: 'JPY' },
        walletAmount: '',
        walletDesc: '',
      }))
      setMessage('Saldo adicionado com sucesso.')
    } catch (e) {
      setMessage(e?.message || 'Erro ao adicionar saldo')
      setUserDetailModal((m) => ({ ...m, walletSaving: false }))
    }
  }

  useEffect(() => {
    if (activeTab === 'usuarios') {
      let isActive = true
      loadUsersForAdmin(() => isActive)
      return () => { isActive = false }
    }
  }, [activeTab, usersPage])

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

  const loadTopupRequests = async (active = () => true) => {
    setTopupLoading(true)
    try {
      const { data, error } = await getWalletTopupRequestsAdmin('pending')
      if (!active()) return
      setTopupRequests(data ?? [])
      if (error) setMessage(error?.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar recargas')
    } finally {
      if (active()) setTopupLoading(false)
    }
  }

  const loadMarketingData = async (active = () => true) => {
    setMarketingLoading(true)
    try {
      const settingsRes = await getSystemSettings()
      if (!active()) return
      const settings = settingsRes.data || {}
      setSettingsForm({
        referral_discount_value: String(settings?.referral_discount_value?.amount ?? ''),
        referral_credit_value: String(settings?.referral_credit_value?.amount ?? ''),
        fx_brl_per_jpy: String(settings?.fx_brl_per_jpy?.amount ?? '0.033'),
      })
      if (settingsRes.error) {
        setMessage(settingsRes.error?.message || 'Erro ao carregar referral')
      }
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar dados de referral')
    } finally {
      if (active()) setMarketingLoading(false)
    }
  }

  const loadAdminNotifications = async (active = () => true) => {
    setAdminNotificationsLoading(true)
    try {
      const { data, error } = await getMyAdminNotifications(user?.id, 120)
      if (!active()) return
      setAdminNotifications(data ?? [])
      if (error) setMessage(error?.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar notificações do admin')
    } finally {
      if (active()) setAdminNotificationsLoading(false)
    }
  }

  const loadFraudQueue = async (active = () => true) => {
    setFraudQueueLoading(true)
    try {
      const { data, error } = await getFraudReviewQueue(150)
      if (!active()) return
      if (error) {
        setMessage(error?.message || 'Erro ao carregar fila de fraude')
        return
      }
      setFraudQueue({
        referrals: Array.isArray(data?.referrals) ? data.referrals : [],
        affiliate_orders: Array.isArray(data?.affiliate_orders) ? data.affiliate_orders : [],
        fraud_logs: Array.isArray(data?.fraud_logs) ? data.fraud_logs : [],
      })
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar fila de fraude')
    } finally {
      if (active()) setFraudQueueLoading(false)
    }
  }

  const handleFraudDecision = async (entityType, id, decision) => {
    const key = `${entityType}:${id}:${decision}`
    setFraudDecisionLoadingId(key)
    try {
      const { error } = await decideFraudCase({ entityType, id, decision })
      if (error) {
        setMessage(error.message || 'Erro ao atualizar decisão antifraude')
        return
      }
      setMessage('Decisão antifraude salva.')
      loadFraudQueue()
    } finally {
      setFraudDecisionLoadingId('')
    }
  }

  useEffect(() => {
    if (activeTab === 'recargas') {
      let isActive = true
      loadTopupRequests(() => isActive)
      return () => { isActive = false }
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'notificacoes') {
      let isActive = true
      loadAdminNotifications(() => isActive)
      const interval = setInterval(() => loadAdminNotifications(() => isActive), 30000)
      return () => {
        isActive = false
        clearInterval(interval)
      }
    }
  }, [activeTab, user?.id])

  useEffect(() => {
    if (activeTab === 'marketing') {
      let isActive = true
      loadMarketingData(() => isActive)
      return () => { isActive = false }
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'fraude') {
      let isActive = true
      loadFraudQueue(() => isActive)
      return () => { isActive = false }
    }
  }, [activeTab])

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      price: '',
      weight_kg: '',
      weight_unit: 'g',
      stock_quantity: '',
      image_url: '',
      image_urls: [],
      is_active: true,
    })
    setEditingId(null)
    setImageUploadError('')
    setNewImageUrl('')
    setProductReferenceId('')
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
    setGroupProductForm({ name: '', price: '', description: '', image_url: '', image_urls: [], weight_kg: '0', weight_unit: 'g', stock_quantity: '' })
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
    setGroupProductForm({ name: '', price: '', description: '', image_url: '', image_urls: [], weight_kg: '0', weight_unit: 'g', stock_quantity: '' })
    loadGroupProducts(g.id)
  }

  const resetGroupProductForm = () => {
    setGroupProductForm({ name: '', price: '', description: '', image_url: '', image_urls: [], weight_kg: '0', weight_unit: 'g', stock_quantity: '' })
    setEditingGroupProductId(null)
    setEditingPendingProductIndex(null)
    setGroupProductReferenceId('')
  }

  const buildGroupProductPayload = () => {
    const price = parseFloat(groupProductForm.price)
    if (isNaN(price) || price < 0) return null
    const weightVal = parseFloat(groupProductForm.weight_kg) || 0
    const weightKg = groupProductForm.weight_unit === 'g' ? weightVal / 1000 : weightVal
    const stockQty = groupProductForm.stock_quantity === '' || groupProductForm.stock_quantity == null
      ? null
      : Math.max(0, parseInt(groupProductForm.stock_quantity, 10) || 0)
    const imageUrls = Array.isArray(groupProductForm.image_urls)?.length
      ? groupProductForm.image_urls.filter(Boolean)
      : groupProductForm.image_url ? [groupProductForm.image_url] : []
    return {
      name: groupProductForm.name.trim(),
      description: groupProductForm.description?.trim() || '',
      price: jpyToBrl(price),
      image_url: imageUrls[0] || groupProductForm.image_url || '',
      image_urls: imageUrls,
      weight_kg: weightKg,
      stock_quantity: stockQty,
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
    const kg = Number(p.weight_kg ?? 0)
    const useG = kg > 0 && kg < 1
    setGroupProductForm({
      name: p.name ?? '',
      price: String(Math.round(brlToJpy(Number(p.price ?? 0)))),
      description: p.description ?? '',
      image_url: p.image_url ?? '',
      image_urls: Array.isArray(p.image_urls) ? p.image_urls : (p.image_url ? [p.image_url] : []),
      weight_kg: useG ? String(Math.round(kg * 1000)) : String(kg),
      weight_unit: useG ? 'g' : 'kg',
      stock_quantity: p.stock_quantity != null ? String(p.stock_quantity) : '',
    })
    setEditingGroupProductId(p.id)
    setGroupProductReferenceId(p.id || '')
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
    const kg = Number(item.weight_kg ?? 0)
    const useG = kg > 0 && kg < 1
    setGroupProductForm({
      name: item.name ?? '',
      price: String(Math.round(brlToJpy(Number(item.price ?? 0)))),
      description: item.description ?? '',
      image_url: item.image_url ?? '',
      image_urls: Array.isArray(item.image_urls) ? item.image_urls : (item.image_url ? [item.image_url] : []),
      weight_kg: useG ? String(Math.round(kg * 1000)) : String(kg),
      weight_unit: useG ? 'g' : 'kg',
      stock_quantity: item.stock_quantity != null ? String(item.stock_quantity) : '',
    })
    setEditingPendingProductIndex(index)
    setGroupProductReferenceId(item.id || '')
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

  const applyReferenceToStoreForm = (refProduct) => {
    if (!refProduct) return
    const urls = getProductImageUrls(refProduct)
    const kg = Number(refProduct.weight_kg ?? 0)
    const useG = kg > 0 && kg < 1
    setForm((prev) => ({
      ...prev,
      name: refProduct.name ?? prev.name,
      description: refProduct.description ?? prev.description,
      price: String(Math.round(brlToJpy(Number(refProduct.price ?? 0)))),
      weight_kg: useG ? String(Math.round(kg * 1000)) : String(kg || ''),
      weight_unit: useG ? 'g' : 'kg',
      stock_quantity: refProduct.stock_quantity != null ? String(refProduct.stock_quantity) : prev.stock_quantity,
      image_url: refProduct.image_url ?? urls[0] ?? '',
      image_urls: urls,
    }))
    setProductReferenceId(refProduct.id || '')
  }

  const applyReferenceToGroupProductForm = (refProduct) => {
    if (!refProduct) return
    const urls = getProductImageUrls(refProduct)
    const kg = Number(refProduct.weight_kg ?? 0)
    const useG = kg > 0 && kg < 1
    setGroupProductForm((prev) => ({
      ...prev,
      name: refProduct.name ?? prev.name,
      description: refProduct.description ?? prev.description,
      price: String(Math.round(brlToJpy(Number(refProduct.price ?? 0)))),
      image_url: refProduct.image_url ?? urls[0] ?? '',
      image_urls: urls,
      weight_kg: useG ? String(Math.round(kg * 1000)) : String(kg || '0'),
      weight_unit: useG ? 'g' : 'kg',
    }))
    setGroupProductReferenceId(refProduct.id || '')
  }

  const handleEdit = (p) => {
    const urls = getProductImageUrls(p)
    const kg = Number(p.weight_kg ?? 0)
    const useG = kg > 0 && kg < 1
    setForm({
      name: p.name,
      description: p.description ?? '',
      // UI do admin em JPY (mantemos persistência em BRL no banco)
      price: String(Math.round(brlToJpy(Number(p.price ?? 0)))),
      weight_kg: useG ? String(Math.round(kg * 1000)) : String(kg),
      weight_unit: useG ? 'g' : 'kg',
      stock_quantity: p.stock_quantity != null ? String(p.stock_quantity) : '',
      image_url: p.image_url ?? urls[0] ?? '',
      image_urls: urls,
      is_active: p.is_active ?? true,
    })
    setEditingId(p.id)
    setProductReferenceId(p.id || '')
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
    const weightVal = parseFloat(form.weight_kg)
    if (isNaN(weightVal) || weightVal <= 0) {
      setMessage('Peso inválido (informe o peso do produto)')
      return
    }
    const weightKg = form.weight_unit === 'g' ? weightVal / 1000 : weightVal
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

  const handleDuplicate = async (p) => {
    setDuplicatingId(p.id)
    setMessage('')
    const urls = Array.isArray(p.image_urls)?.length ? p.image_urls.filter(Boolean) : (p.image_url ? [p.image_url] : [])
    const payload = {
      name: `${(p.name || '').trim()} (cópia)`,
      description: p.description ?? '',
      price: p.price,
      weight_kg: p.weight_kg ?? 0,
      stock_quantity: p.stock_quantity ?? null,
      image_url: urls[0] || p.image_url || '',
      image_urls: urls,
      is_active: p.is_active ?? true,
    }
    try {
      const { data, error } = await createProduct(payload)
      setMessage(error ? error.message : 'Produto duplicado')
      if (!error) {
        logAdminAction('product_duplicate', 'product', data?.id, { from: p.id, name: payload.name })
        loadProducts()
      }
    } finally {
      setDuplicatingId(null)
    }
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
    const products = quoteModal.products
      .map((p) => ({
        ...p,
        valor: parseFloat(p.valor) || 0,
        quantidade: Math.max(1, parseInt(p.quantidade, 10) || 1),
      }))
      .filter((p) => (p.name?.trim() || p.descricao?.trim()) && p.valor > 0)
    if (products.length === 0) {
      setMessage('Adicione ao menos um produto com nome ou descrição e valor.')
      return
    }
    const total = products.reduce((s, p) => s + p.valor * p.quantidade, 0)
    const message = serializeQuoteProducts(products, quoteModal.orderDescription)
    setSubmitting(true)
    setMessage('')
    const { error } = await setQuoteAdmin(quoteModal.orderId, total, 'JPY', message)
    setSubmitting(false)
    setMessage(error ? error.message : 'Orçamento definido. Cliente pode pagar em Pedidos.')
    if (!error) {
      logAdminAction('order_set_quote', 'order', quoteModal.orderId, { total, currency: 'JPY', productsCount: products.length })
      setQuoteModal({ open: false, orderId: null, orderDescription: '', products: [{ name: '', valor: '', quantidade: 1, descricao: '' }], currency: 'JPY' })
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

  const selectedExternalStores = Object.entries(externalSearchStores)
    .filter(([, checked]) => checked)
    .map(([storeId]) => storeId)

  const runExternalSearch = async (page = 1) => {
    const query = externalSearchQuery.trim()
    if (query.length < 2) {
      setExternalSearchError('Digite ao menos 2 caracteres para buscar.')
      return
    }
    if (selectedExternalStores.length === 0) {
      setExternalSearchError('Selecione ao menos uma loja para buscar.')
      return
    }
    setExternalSearchLoading(true)
    setExternalSearchError('')
    try {
      const { data, error } = await searchCatalogAdmin({
        query,
        stores: selectedExternalStores,
        page,
        pageSize: 12,
      })
      if (error) {
        setExternalSearchError(error.message || 'Erro ao buscar catálogos.')
        if (page === 1) {
          setExternalSearchResults([])
          setExternalSearchMeta(null)
          setExternalSearchPartials([])
        }
        return
      }
      setExternalSearchPage(page)
      setExternalSearchResults(data?.results ?? [])
      setExternalSearchMeta(data?.meta ?? null)
      setExternalSearchPartials(data?.partials ?? [])
    } catch (e) {
      setExternalSearchError(e?.message || 'Erro ao buscar catálogos.')
    } finally {
      setExternalSearchLoading(false)
    }
  }

  const handleExternalSearchSubmit = async (e) => {
    e.preventDefault()
    await runExternalSearch(1)
  }

  const toggleExternalStore = (storeId) => {
    setExternalSearchStores((prev) => ({ ...prev, [storeId]: !prev[storeId] }))
  }

  const formatExternalPrice = (price, currency = 'JPY') => {
    if (price == null || Number.isNaN(Number(price))) return 'Preço indisponível'
    return Number(price).toLocaleString('pt-BR', { style: 'currency', currency: String(currency).toUpperCase() })
  }

  const masterProductReferences = products.filter((p) => !p.purchase_group_id)
  const productReferenceTerm = productReferenceSearch.trim().toLowerCase()
  const groupProductReferenceTerm = groupProductReferenceSearch.trim().toLowerCase()

  const filteredProductReferences = masterProductReferences.filter((p) => {
    if (!productReferenceTerm) return true
    const haystack = [p.id, p.name, p.description]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ')
    return haystack.includes(productReferenceTerm)
  })

  const filteredGroupProductReferences = masterProductReferences.filter((p) => {
    if (!groupProductReferenceTerm) return true
    const haystack = [p.id, p.name, p.description]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ')
    return haystack.includes(groupProductReferenceTerm)
  })

  const catalogTerm = catalogSearch.trim().toLowerCase()
  const catalogProducts = products.filter((p) => {
    const statusOk =
      catalogStatusFilter === 'all' ||
      (catalogStatusFilter === 'active' && !!p.is_active) ||
      (catalogStatusFilter === 'inactive' && !p.is_active)
    if (!statusOk) return false
    if (!catalogTerm) return true
    const haystack = [
      p.id,
      p.name,
      p.description,
      p.purchase_group_id ? 'grupo' : 'loja',
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ')
    return haystack.includes(catalogTerm)
  })

  const fraudSearch = fraudSearchTerm.trim().toLowerCase()
  const fraudMinScoreValue = Number(fraudMinScore) || 0
  const passesFraudFilters = (row, idFields = []) => {
    const score = Number(row?.risk_score || 0)
    if (score < fraudMinScoreValue) return false
    if (fraudStatusFilter !== 'all' && String(row?.status || '') !== fraudStatusFilter) return false
    if (!fraudSearch) return true
    const haystack = [
      ...(idFields || []).map((k) => row?.[k]),
      row?.status,
      JSON.stringify(row?.flags || row?.fraud_flags || {}),
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ')
    return haystack.includes(fraudSearch)
  }

  const filteredFraudReferrals = (fraudQueue.referrals || []).filter((row) =>
    passesFraudFilters(row, ['id', 'referrer_id', 'referred_id'])
  )
  const filteredFraudAffiliateOrders = (fraudQueue.affiliate_orders || []).filter((row) =>
    passesFraudFilters(row, ['id', 'order_id', 'affiliate_id'])
  )

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
          <div className="flex gap-1 overflow-x-auto pb-1">
            {orderedTabs.map((tabId) => {
              const tab = TABS.find((entry) => entry.id === tabId)
              if (!tab) return null
              return (
              <button
                key={tab.id}
                type="button"
                draggable
                onClick={() => setActiveTab(tab.id)}
                onDragStart={(e) => {
                  setDraggingTabId(tab.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (!draggingTabId || draggingTabId === tab.id) return
                  e.preventDefault()
                }}
                onDrop={(e) => {
                  if (!draggingTabId || draggingTabId === tab.id) return
                  e.preventDefault()
                  handleTabReorder(draggingTabId, tab.id)
                }}
                onDragEnd={() => setDraggingTabId('')}
                className={`shrink-0 whitespace-nowrap flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-earth-900 bg-earth-50 text-earth-900'
                    : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
              )
            })}
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
                        <QuoteProductsList
                          message={o.message}
                          quoteCurrency={o.quote_currency || 'JPY'}
                          formatMoney={formatMoney}
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
                      {o.status === ORDER_STATUS.AWAITING_QUOTE && (
                        <button
                          type="button"
                          onClick={() => {
                          const parsed = parseQuoteMessage(o.message)
                          const orderDescription = parsed?.orderDescription ?? (parsed ? '' : (o.message?.trim() ?? ''))
                          const products = parsed?.products?.length
                            ? parsed.products.map((p) => ({
                                name: String(p.name ?? ''),
                                valor: p.valor != null ? String(p.valor) : '',
                                quantidade: p.quantidade != null ? String(p.quantidade) : '1',
                                descricao: String(p.descricao ?? ''),
                              }))
                            : [{ name: '', valor: '', quantidade: 1, descricao: '' }]
                          setQuoteModal({ open: true, orderId: o.id, orderDescription, products, currency: 'JPY' })
                        }}
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
              <PaginationControls
                page={ordersPage}
                hasMore={ordersHasMore}
                loading={ordersLoading}
                onPrev={() => setOrdersPage((p) => Math.max(0, p - 1))}
                onNext={() => setOrdersPage((p) => p + 1)}
              />
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
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-earth-900">Definir orçamento (Personal Shopping)</h3>
                <p className="mt-1 text-sm text-earth-600">Lista de produtos com nome, valor e descrição.</p>
                <p className="mt-2 text-xs text-earth-600">
                  Referência de precificação: <strong>25% sobre o valor dos produtos + ¥200 por unidade</strong> (some tudo em ienes
                  ao valor total do orçamento, além do frete quando aplicável).
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-earth-700">Descrição do pedido (aparece no topo do orçamento)</label>
                    <textarea
                      value={quoteModal.orderDescription}
                      onChange={(e) => setQuoteModal((m) => ({ ...m, orderDescription: e.target.value }))}
                      rows={2}
                      placeholder="Mensagem/pedido do cliente..."
                      className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                  </div>
                  {quoteModal.products.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-earth-200 bg-earth-50/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-earth-700">Produto {idx + 1}</span>
                        {quoteModal.products.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setQuoteModal((m) => ({
                                ...m,
                                products: m.products.filter((_, i) => i !== idx),
                              }))
                            }
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-earth-600">Nome</label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) =>
                              setQuoteModal((m) => ({
                                ...m,
                                products: m.products.map((p, i) =>
                                  i === idx ? { ...p, name: e.target.value } : p
                                ),
                              }))
                            }
                            placeholder="Ex: Camiseta básica"
                            className="mt-0.5 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-earth-600">Valor (¥)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.valor}
                            onChange={(e) =>
                              setQuoteModal((m) => ({
                                ...m,
                                products: m.products.map((p, i) =>
                                  i === idx ? { ...p, valor: e.target.value } : p
                                ),
                              }))
                            }
                            placeholder="Ex: 1500"
                            className="mt-0.5 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-earth-600">Qtd</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantidade ?? 1}
                            onChange={(e) =>
                              setQuoteModal((m) => ({
                                ...m,
                                products: m.products.map((p, i) =>
                                  i === idx ? { ...p, quantidade: e.target.value } : p
                                ),
                              }))
                            }
                            placeholder="1"
                            className="mt-0.5 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-earth-600">Descrição</label>
                          <input
                            type="text"
                            value={item.descricao}
                            onChange={(e) =>
                              setQuoteModal((m) => ({
                                ...m,
                                products: m.products.map((p, i) =>
                                  i === idx ? { ...p, descricao: e.target.value } : p
                                ),
                              }))
                            }
                            placeholder="Cor, tamanho, link..."
                            className="mt-0.5 block w-full rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setQuoteModal((m) => ({
                        ...m,
                        products: [...m.products, { name: '', valor: '', quantidade: 1, descricao: '' }],
                      }))
                    }
                    className="w-full rounded-lg border-2 border-dashed border-earth-300 py-2 text-sm font-medium text-earth-600 hover:border-earth-400 hover:bg-earth-50"
                  >
                    + Adicionar produto
                  </button>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                    <p className="text-sm font-semibold text-earth-900">
                      Total: ¥ {quoteModal.products
                        .reduce((s, p) => {
                          const valor = parseFloat(p.valor) || 0
                          const qty = Math.max(1, parseInt(p.quantidade, 10) || 1)
                          return s + valor * qty
                        }, 0)
                        .toLocaleString('pt-BR')}
                    </p>
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
                    onClick={() =>
                      setQuoteModal({
                        open: false,
                        orderId: null,
                        orderDescription: '',
                        products: [{ name: '', valor: '', quantidade: 1, descricao: '' }],
                        currency: 'JPY',
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

        {/* Usuários */}
        {activeTab === 'usuarios' && (
        <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
          <h2 className="text-lg font-semibold text-earth-900">Gestão de Usuários</h2>
          <p className="mt-1 text-sm text-earth-600">
            Visualize e edite informações dos usuários, adicione saldo na carteira e gerencie pedidos.
          </p>
          {usersListLoading && <p className="mt-4 text-sm text-earth-600">Carregando usuários...</p>}
          {!usersListLoading && usersList.length === 0 && (
            <p className="mt-4 text-sm text-earth-600">Nenhum usuário cadastrado.</p>
          )}
          {!usersListLoading && usersList.length > 0 && (
            <div className="mt-4">
              <div className="overflow-x-auto rounded-lg border border-earth-200 bg-white">
                <table className="min-w-full divide-y divide-earth-200 text-left text-sm">
                  <thead>
                    <tr className="bg-earth-50">
                      <th className="px-4 py-3 font-medium text-earth-900">Nome</th>
                      <th className="px-4 py-3 font-medium text-earth-900">Email</th>
                      <th className="px-4 py-3 font-medium text-earth-900">Código</th>
                      <th className="px-4 py-3 font-medium text-earth-900">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-earth-200">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-earth-50/50">
                        <td className="px-4 py-3 font-medium text-earth-900">{u.name || '—'}</td>
                        <td className="px-4 py-3 text-earth-700">{u.email || '—'}</td>
                        <td className="px-4 py-3 font-mono text-earth-600">{u.account_code || '—'}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openUserDetail(u)}
                            className="rounded bg-earth-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-800"
                          >
                            Ver / Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={usersPage}
                hasMore={usersHasMore}
                loading={usersListLoading}
                onPrev={() => setUsersPage((p) => Math.max(0, p - 1))}
                onNext={() => setUsersPage((p) => p + 1)}
              />
            </div>
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
                  {editingGroupId
                    ? 'Produtos do grupo seguem a mesma lógica da loja (nome, preço, peso, estoque e imagem).'
                    : 'Adicione produtos antes de criar o grupo'}
                </p>
                {editingGroupId && groupProducts.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {groupProducts.map((p) => (
                      <li key={p.id} className="flex items-center justify-between rounded-lg border border-earth-200 bg-white px-3 py-2">
                        <span className="text-sm text-earth-800">
                          {p.name} — {formatJPY(brlToJpy(p.price))}
                          {Number(p.weight_kg ?? 0) > 0 ? ` • ${formatWeight(p.weight_kg)}` : ''}
                          {` • Estoque: ${p.stock_quantity != null ? p.stock_quantity : 'ilimitado'}`}
                        </span>
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
                        <span className="text-sm text-earth-800">
                          {p.name} — {formatJPY(brlToJpy(p.price))}
                          {Number(p.weight_kg ?? 0) > 0 ? ` • ${formatWeight(p.weight_kg)}` : ''}
                          {` • Estoque: ${p.stock_quantity != null ? p.stock_quantity : 'ilimitado'}`}
                        </span>
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
                <div
                  className="mt-3 space-y-2 rounded-lg border border-earth-200 bg-earth-50 p-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      if (groupProductForm.name?.trim() && !groupProductSubmitting) {
                        handleSaveGroupProduct({ ...e, preventDefault: () => {} })
                      }
                    }
                  }}
                >
                  <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input
                      type="search"
                      value={groupProductReferenceSearch}
                      onChange={(e) => setGroupProductReferenceSearch(e.target.value)}
                      placeholder="Buscar item na Lista de Produtos..."
                      className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                    <select
                      value={groupProductReferenceId}
                      onChange={(e) => {
                        const nextId = e.target.value
                        setGroupProductReferenceId(nextId)
                        const ref = filteredGroupProductReferences.find((p) => p.id === nextId)
                        if (ref) applyReferenceToGroupProductForm(ref)
                      }}
                      className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    >
                      <option value="">Selecionar referência do catálogo</option>
                      {filteredGroupProductReferences.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({String(p.id).slice(0, 8)}…)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const ref = masterProductReferences.find((p) => p.id === groupProductReferenceId)
                        if (ref) applyReferenceToGroupProductForm(ref)
                      }}
                      disabled={!groupProductReferenceId}
                      className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                    >
                      Aplicar referência
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-earth-700">Nome:</span>
                    <input
                      type="text"
                      placeholder="Nome do produto"
                      value={groupProductForm.name}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, name: e.target.value }))}
                      className="min-w-[140px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                    <span className="text-sm font-medium text-earth-700">Preço (¥):</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={groupProductForm.price}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, price: e.target.value }))}
                      className="w-24 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                    <span className="text-sm font-medium text-earth-700">Peso:</span>
                    <input
                      type="number"
                      step={groupProductForm.weight_unit === 'g' ? '1' : '0.001'}
                      placeholder="0"
                      value={groupProductForm.weight_kg}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, weight_kg: e.target.value }))}
                      className="w-20 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                    <select
                      value={groupProductForm.weight_unit}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, weight_unit: e.target.value }))}
                      className="rounded-lg border border-earth-300 px-2 py-2 text-sm text-earth-900"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                    </select>
                    <span className="text-sm font-medium text-earth-700">Estoque:</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Ilimitado"
                      value={groupProductForm.stock_quantity}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                      className="w-28 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-earth-700">Imagem:</span>
                    <label className="cursor-pointer rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-50">
                      {groupProductImageUploading ? 'Enviando...' : 'Enviar do PC'}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={groupProductImageUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setGroupProductImageUploading(true)
                          try {
                            const { data, error } = await uploadProductImage(file)
                            if (error) setMessage(error.message || 'Falha no upload')
                            else if (data) {
                              setGroupProductForm((f) => ({
                                ...f,
                                image_urls: [...(f.image_urls || []), data],
                                image_url: f.image_url || data,
                              }))
                            }
                          } finally {
                            setGroupProductImageUploading(false)
                            e.target.value = ''
                          }
                        }}
                      />
                    </label>
                    <span className="text-sm text-earth-500">ou</span>
                    <input
                      type="url"
                      placeholder="URL da imagem"
                      value={groupProductForm.image_url}
                      onChange={(e) => setGroupProductForm((f) => ({ ...f, image_url: e.target.value }))}
                      className="min-w-[200px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleSaveGroupProduct({ ...e, preventDefault: () => {} })}
                      disabled={groupProductSubmitting || !groupProductForm.name?.trim()}
                      className="rounded-lg bg-earth-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-earth-900 disabled:opacity-60"
                    >
                      {editingGroupProductId || editingPendingProductIndex != null ? 'Salvar' : 'Adicionar'} produto
                    </button>
                    {(editingGroupProductId || editingPendingProductIndex != null) && (
                      <button type="button" onClick={resetGroupProductForm} className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100">
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
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
                          {g.description && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-earth-600">{g.description}</p>}
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

        {/* Referral */}
        {activeTab === 'marketing' && (
          <section className="mt-0 space-y-6 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-earth-900">Programa de indicação (referral)</h2>
              <button
                type="button"
                onClick={() => loadMarketingData()}
                disabled={marketingLoading}
                className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
              >
                {marketingLoading ? 'Atualizando...' : 'Atualizar'}
              </button>
            </div>

            <p className="text-sm text-earth-600">
              O desconto ({formatJPY(Math.round(brlToJpy(Number(settingsForm.referral_discount_value) || 0)))}) aplica-se no checkout do indicado
              quando ele usa o benefício. O crédito ao indicador ({formatJPY(Math.round(brlToJpy(Number(settingsForm.referral_credit_value) || 0)))}) é
              lançado quando o pedido do indicado (com referral aplicado) atinge status <strong>enviado</strong> ou{' '}
              <strong>concluído</strong>.
            </p>

            <div className="rounded-lg border border-earth-200 bg-white p-4">
              <h3 className="font-medium text-earth-900">Valores (BRL)</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-sm md:col-span-2">
                  <span className="text-earth-700">
                    Cotação BRL por 1 JPY (fx_brl_per_jpy) — usada no servidor para converter ¥200/un. do Grupo de Compras
                  </span>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={settingsForm.fx_brl_per_jpy}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, fx_brl_per_jpy: e.target.value }))}
                    className="mt-1 w-full max-w-xs rounded border border-earth-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-earth-700">Desconto para o indicado (referral_discount_value)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settingsForm.referral_discount_value}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, referral_discount_value: e.target.value }))}
                    className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-earth-700">Crédito ao indicador (referral_credit_value)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settingsForm.referral_credit_value}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, referral_credit_value: e.target.value }))}
                    className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
                  />
                </label>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={async () => {
                    const payload = {
                      referral_discount_value: { amount: Number(settingsForm.referral_discount_value) || 0 },
                      referral_credit_value: { amount: Number(settingsForm.referral_credit_value) || 0 },
                      fx_brl_per_jpy: {
                        amount: Math.max(0.0001, Number(settingsForm.fx_brl_per_jpy) || 0.033),
                      },
                    }
                    const { error } = await saveSystemSettingsAdmin(payload)
                    if (error) setMessage(error.message || 'Erro ao salvar configurações')
                    else {
                      setMessage('Configurações de referral salvas.')
                      loadMarketingData()
                    }
                  }}
                  className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800"
                >
                  Salvar
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Fila antifraude */}
        {activeTab === 'fraude' && (
          <section className="mt-0 space-y-6 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-earth-900">Revisão antifraude</h2>
                <p className="mt-1 text-sm text-earth-600">
                  Casos de referral e affiliate com risco elevado para decisão manual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadFraudQueue()}
                disabled={fraudQueueLoading}
                className="rounded-lg border border-earth-300 px-3 py-1.5 text-sm font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-70"
              >
                {fraudQueueLoading ? 'Atualizando...' : 'Atualizar'}
              </button>
            </div>

            {fraudQueueLoading && <p className="text-sm text-earth-600">Carregando fila de fraude...</p>}

            {!fraudQueueLoading && (
              <>
                <div className="rounded-lg border border-earth-200 bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="text-sm">
                      <span className="text-earth-700">Score mínimo</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={fraudMinScore}
                        onChange={(e) => setFraudMinScore(e.target.value)}
                        className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-earth-700">Status</span>
                      <select
                        value={fraudStatusFilter}
                        onChange={(e) => setFraudStatusFilter(e.target.value)}
                        className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
                      >
                        <option value="all">Todos</option>
                        <option value="pending">Pending</option>
                        <option value="flagged">Flagged</option>
                        <option value="rejected">Rejected</option>
                        <option value="approved">Approved</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="text-earth-700">Busca (ID / flags)</span>
                      <input
                        type="search"
                        value={fraudSearchTerm}
                        onChange={(e) => setFraudSearchTerm(e.target.value)}
                        placeholder="pedido, referral, user..."
                        className="mt-1 w-full rounded border border-earth-300 px-3 py-2"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-lg border border-earth-200 bg-white p-4">
                  <h3 className="font-medium text-earth-900">Referrals em revisão</h3>
                  <p className="mt-1 text-xs text-earth-500">
                    Exibindo {filteredFraudReferrals.length} de {(fraudQueue.referrals || []).length}
                  </p>
                  {filteredFraudReferrals.length === 0 ? (
                    <p className="mt-2 text-sm text-earth-600">Nenhum referral pendente.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {filteredFraudReferrals.map((row) => (
                        <li key={row.id} className="rounded border border-earth-200 bg-earth-50 p-3">
                          <p className="text-sm font-medium text-earth-900">
                            Referral {String(row.id).slice(0, 8)}… • score {Number(row.risk_score || 0).toFixed(1)}
                          </p>
                          <p className="mt-1 text-xs text-earth-600">
                            {row.status} • referrer {String(row.referrer_id || '').slice(0, 8)}… • referred {String(row.referred_id || '').slice(0, 8)}…
                          </p>
                          <p className="mt-1 break-all text-xs text-earth-500">
                            flags: {JSON.stringify(row.fraud_flags || {})}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[
                              ['approve', 'Aprovar'],
                              ['reject', 'Rejeitar'],
                              ['flag', 'Flag'],
                              ['pending', 'Pendente'],
                            ].map(([decision, label]) => {
                              const key = `referral:${row.id}:${decision}`
                              return (
                                <button
                                  key={decision}
                                  type="button"
                                  onClick={() => handleFraudDecision('referral', row.id, decision)}
                                  disabled={fraudDecisionLoadingId === key}
                                  className="rounded border border-earth-300 bg-white px-2.5 py-1 text-xs font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-earth-200 bg-white p-4">
                  <h3 className="font-medium text-earth-900">Affiliate orders em revisão</h3>
                  <p className="mt-1 text-xs text-earth-500">
                    Exibindo {filteredFraudAffiliateOrders.length} de {(fraudQueue.affiliate_orders || []).length}
                  </p>
                  {filteredFraudAffiliateOrders.length === 0 ? (
                    <p className="mt-2 text-sm text-earth-600">Nenhum affiliate order pendente.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {filteredFraudAffiliateOrders.map((row) => (
                        <li key={row.id} className="rounded border border-earth-200 bg-earth-50 p-3">
                          <p className="text-sm font-medium text-earth-900">
                            Affiliate order {String(row.id).slice(0, 8)}… • score {Number(row.risk_score || 0).toFixed(1)}
                          </p>
                          <p className="mt-1 text-xs text-earth-600">
                            {row.status} • order {String(row.order_id || '').slice(0, 8)}… • comissão {formatMoney(Number(row.commission_amount || 0), 'BRL')}
                          </p>
                          <p className="mt-1 break-all text-xs text-earth-500">
                            flags: {JSON.stringify(row.flags || {})}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[
                              ['approve', 'Aprovar'],
                              ['reject', 'Rejeitar'],
                              ['flag', 'Flag'],
                              ['pending', 'Pendente'],
                            ].map(([decision, label]) => {
                              const key = `affiliate_order:${row.id}:${decision}`
                              return (
                                <button
                                  key={decision}
                                  type="button"
                                  onClick={() => handleFraudDecision('affiliate_order', row.id, decision)}
                                  disabled={fraudDecisionLoadingId === key}
                                  className="rounded border border-earth-300 bg-white px-2.5 py-1 text-xs font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-60"
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {/* Notificações (ações para admin) */}
        {activeTab === 'notificacoes' && (
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
                              setActiveTab(targetTab)
                            }}
                            className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800"
                          >
                            Abrir área
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
        )}

        {/* Recargas PIX */}
        {activeTab === 'recargas' && (
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
                        {formatJPY(r.amount_jpy)} — {r.user_name || r.user_email || r.user_id?.slice(0, 8) || '—'}
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
          <div className="mt-4 rounded-lg border border-earth-200 bg-white p-4 text-sm text-earth-700">
            O cadastro/edição de itens agora acontece na aba <strong>Lista de Produtos</strong>, para manter um catálogo único.
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setCatalogCreateOpen(true)
                  setActiveTab('catalogo_produtos')
                }}
                className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800"
              >
                Ir para Lista de Produtos
              </button>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-medium text-earth-900">Produtos cadastrados</h3>
            {loading && <p className="mt-2 text-sm text-earth-600">Carregando...</p>}
            {!loading && products.length === 0 && (
              <p className="mt-2 text-sm text-earth-600">Nenhum produto ainda.</p>
            )}
            {!loading && products.length > 0 && (
              <div className="mt-4 space-y-2">
                <ul className="space-y-2">
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
                            {Number(p.weight_kg ?? 0) > 0 ? `• ${formatWeight(p.weight_kg)}` : '• peso não definido'}
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
                          onClick={() => {
                            handleEdit(p)
                            setCatalogCreateOpen(true)
                            setActiveTab('catalogo_produtos')
                          }}
                          className="text-sm font-medium text-earth-600 hover:text-earth-900"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(p)}
                          disabled={duplicatingId === p.id}
                          className="text-sm font-medium text-earth-600 hover:text-earth-900 disabled:opacity-50"
                        >
                          {duplicatingId === p.id ? 'Duplicando...' : 'Duplicar'}
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
                <PaginationControls
                  page={productsPage}
                  hasMore={productsHasMore}
                  loading={loading}
                  onPrev={() => setProductsPage((p) => Math.max(0, p - 1))}
                  onNext={() => setProductsPage((p) => p + 1)}
                />
              </div>
            )}
          </div>
        </section>
        )}

        {/* Busca unificada em catálogos externos (MVP admin) */}
        {activeTab === 'busca_catalogo' && (
        <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-earth-900">Busca em catálogos externos</h2>
              <p className="mt-1 text-sm text-earth-600">
                Piloto no Admin para consultar Amazon, Rakuma e Mercari em um catálogo único.
              </p>
            </div>
            <div className="text-xs text-earth-500">
              Versão de teste: somente painel admin
            </div>
          </div>

          <form onSubmit={handleExternalSearchSubmit} className="mt-4 rounded-lg border border-earth-200 bg-white p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="search"
                  value={externalSearchQuery}
                  onChange={(e) => setExternalSearchQuery(e.target.value)}
                  placeholder="Ex.: Pokemon card Pikachu, Nendoroid, Nintendo Switch..."
                  className="min-w-[240px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
                />
                <button
                  type="submit"
                  disabled={externalSearchLoading}
                  className="rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-white hover:bg-earth-900 disabled:opacity-60"
                >
                  {externalSearchLoading ? 'Buscando...' : 'Buscar'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-earth-700">Lojas:</span>
                {[
                  { id: 'amazon', label: 'Amazon JP' },
                  { id: 'rakuma', label: 'Rakuma' },
                  { id: 'mercari', label: 'Mercari' },
                ].map((store) => (
                  <label key={store.id} className="inline-flex items-center gap-2 rounded border border-earth-200 px-2.5 py-1.5">
                    <input
                      type="checkbox"
                      checked={!!externalSearchStores[store.id]}
                      onChange={() => toggleExternalStore(store.id)}
                    />
                    <span className="text-earth-700">{store.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </form>

          {externalSearchError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {externalSearchError}
            </div>
          )}

          {!externalSearchLoading && externalSearchMeta && (
            <div className="mt-3 text-xs text-earth-600">
              {externalSearchMeta.totalEstimated ?? 0} resultados estimados • página {externalSearchMeta.page ?? externalSearchPage} • {externalSearchMeta.tookMs ?? 0}ms
            </div>
          )}

          {externalSearchPartials?.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Algumas lojas falharam nesta tentativa:{' '}
              {externalSearchPartials.map((p) => `${p.storeId} (${p.reason})`).join(' | ')}
            </div>
          )}

          {!externalSearchLoading && externalSearchResults.length === 0 && externalSearchMeta && (
            <p className="mt-4 text-sm text-earth-600">Nenhum resultado encontrado com os filtros atuais.</p>
          )}

          {externalSearchLoading && (
            <p className="mt-4 text-sm text-earth-600">Consultando lojas externas...</p>
          )}

          {!externalSearchLoading && externalSearchResults.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {externalSearchResults.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-lg border border-earth-200 bg-white shadow-sm">
                  <div className="h-44 bg-earth-100">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-earth-500">Sem imagem</div>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 text-sm font-medium text-earth-900">{item.title}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="rounded bg-earth-100 px-2 py-1 text-earth-700">{item.storeName}</span>
                      <span className="font-medium text-earth-800">
                        {formatExternalPrice(item.price, item.currency)}
                      </span>
                    </div>
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-xs font-medium text-earth-700 underline hover:text-earth-900"
                    >
                      Abrir produto
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!externalSearchLoading && externalSearchMeta && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-white px-3 py-2 text-sm">
              <span className="text-earth-600">Página {externalSearchPage}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => runExternalSearch(Math.max(1, externalSearchPage - 1))}
                  disabled={externalSearchLoading || externalSearchPage <= 1}
                  className="rounded border border-earth-300 px-3 py-1.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => runExternalSearch(externalSearchPage + 1)}
                  disabled={externalSearchLoading || !externalSearchMeta?.hasMore}
                  className="rounded border border-earth-300 px-3 py-1.5 font-medium text-earth-700 hover:bg-earth-100 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </section>
        )}

        {/* Catálogo mestre de produtos */}
        {activeTab === 'catalogo_produtos' && (
        <section className="mt-0 rounded-b-xl border border-t-0 border-earth-200 bg-earth-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-earth-900">Lista de Produtos (catálogo único)</h2>
              <p className="mt-1 text-sm text-earth-600">
                Base central de produtos usada em loja, grupos de compra, pedidos e invoices.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setCatalogCreateOpen(true)
                }}
                className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-white hover:bg-earth-800"
              >
                Adicionar produto na lista
              </button>
              <button
                type="button"
                onClick={() => loadProducts()}
                className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
              >
                Atualizar lista
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Buscar por nome, id, descricao..."
              className="min-w-[220px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
            />
            <select
              value={catalogStatusFilter}
              onChange={(e) => setCatalogStatusFilter(e.target.value)}
              className="rounded-lg border border-earth-300 px-3 py-2 text-sm text-earth-900"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>

          {catalogCreateOpen && (
            <form
              onSubmit={handleSave}
              className="mt-4 space-y-3 rounded-lg border border-earth-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-earth-700">Nome *</span>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="min-w-[180px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
                <span className="text-sm font-medium text-earth-700">Preço (¥) *</span>
                <input
                  required
                  type="number"
                  step="1"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-28 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
                <span className="text-sm font-medium text-earth-700">Peso *</span>
                <input
                  required
                  type="number"
                  step={form.weight_unit === 'g' ? '1' : '0.001'}
                  min="0"
                  value={form.weight_kg}
                  onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                  className="w-24 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
                <select
                  value={form.weight_unit}
                  onChange={(e) => setForm((f) => ({ ...f, weight_unit: e.target.value }))}
                  className="rounded-lg border border-earth-300 px-2 py-2 text-earth-900"
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-earth-700">Estoque</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                  placeholder="Ilimitado"
                  className="w-28 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
                <span className="text-sm font-medium text-earth-700">Imagem (URL)</span>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://..."
                  className="min-w-[220px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
              </div>

              <div className="flex flex-wrap items-start gap-2">
                <span className="pt-2 text-sm font-medium text-earth-700">Descrição</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="min-w-[240px] flex-1 rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="catalog_is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-earth-300"
                />
                <label htmlFor="catalog_is_active" className="text-sm font-medium text-earth-700">
                  Ativo (visível na loja)
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-white hover:bg-earth-800 disabled:opacity-60"
                >
                  {submitting ? 'Salvando...' : (editingId ? 'Atualizar produto' : 'Criar produto')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setCatalogCreateOpen(false)
                  }}
                  className="rounded-lg border border-earth-300 px-4 py-2 text-sm font-medium text-earth-700 hover:bg-earth-100"
                >
                  Fechar
                </button>
              </div>
            </form>
          )}

          <div className="mt-3 text-xs text-earth-600">
            Exibindo {catalogProducts.length} de {products.length} produtos.
          </div>

          {loading && <p className="mt-4 text-sm text-earth-600">Carregando catálogo...</p>}
          {!loading && catalogProducts.length === 0 && (
            <p className="mt-4 text-sm text-earth-600">Nenhum produto encontrado com os filtros atuais.</p>
          )}

          {!loading && catalogProducts.length > 0 && (
            <div className="mt-4">
              <div className="overflow-x-auto rounded-lg border border-earth-200 bg-white">
                <table className="min-w-full divide-y divide-earth-200 text-sm">
                  <thead className="bg-earth-100 text-left text-earth-700">
                    <tr>
                      <th className="px-3 py-2 font-medium">Produto</th>
                      <th className="px-3 py-2 font-medium">Origem</th>
                      <th className="px-3 py-2 font-medium">Preco</th>
                      <th className="px-3 py-2 font-medium">Estoque</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-earth-100">
                    {catalogProducts.map((p) => (
                      <tr key={p.id} className="align-top">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-10 rounded bg-earth-200" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-earth-900">{p.name || 'Sem nome'}</p>
                              {p.description && (
                                <p className="line-clamp-2 text-xs text-earth-600">{p.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-earth-700">
                          {p.purchase_group_id ? 'Grupo de compras' : 'Loja virtual'}
                        </td>
                        <td className="px-3 py-2 text-earth-700">
                          {formatJPY(brlToJpy(p.price))}
                        </td>
                        <td className="px-3 py-2 text-earth-700">
                          {p.stock_quantity != null ? p.stock_quantity : 'Ilimitado'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {p.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-earth-500">{p.id}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="text-sm font-medium text-red-600 hover:text-red-800"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={productsPage}
                hasMore={productsHasMore}
                loading={loading}
                onPrev={() => setProductsPage((p) => Math.max(0, p - 1))}
                onNext={() => setProductsPage((p) => p + 1)}
              />
            </div>
          )}
        </section>
        )}

        {/* Modal: detalhes e edição do usuário */}
        {userDetailModal.open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={closeUserDetail}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-earth-200 bg-white px-6 py-4">
                <h3 className="text-lg font-semibold text-earth-900">
                  {userDetailModal.loading ? 'Carregando...' : (userDetailModal.profile?.name || userDetailModal.user?.email || 'Usuário')}
                </h3>
                <button
                  type="button"
                  onClick={closeUserDetail}
                  className="rounded p-1 text-earth-500 hover:bg-earth-100 hover:text-earth-900"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
              <div className="p-6 space-y-6">
                {userDetailModal.loading && (
                  <p className="text-sm text-earth-600">Carregando dados...</p>
                )}
                {!userDetailModal.loading && userDetailModal.profile && (
                  <>
                    {/* Perfil */}
                    <div>
                      <h4 className="font-medium text-earth-900 mb-3">Perfil</h4>
                      <form onSubmit={handleSaveProfileEdit} className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-earth-700">Nome</label>
                            <input
                              type="text"
                              value={userDetailModal.profileForm.name}
                              onChange={(e) =>
                                setUserDetailModal((m) => ({
                                  ...m,
                                  profileForm: { ...m.profileForm, name: e.target.value },
                                }))
                              }
                              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-earth-700">Email</label>
                            <input
                              type="email"
                              value={userDetailModal.profileForm.email}
                              onChange={(e) =>
                                setUserDetailModal((m) => ({
                                  ...m,
                                  profileForm: { ...m.profileForm, email: e.target.value },
                                }))
                              }
                              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-earth-700">CPF/CNPJ</label>
                            <input
                              type="text"
                              value={userDetailModal.profileForm.cpf_cnpj}
                              onChange={(e) =>
                                setUserDetailModal((m) => ({
                                  ...m,
                                  profileForm: { ...m.profileForm, cpf_cnpj: e.target.value },
                                }))
                              }
                              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-earth-700">Telefone</label>
                            <input
                              type="text"
                              value={userDetailModal.profileForm.phone}
                              onChange={(e) =>
                                setUserDetailModal((m) => ({
                                  ...m,
                                  profileForm: { ...m.profileForm, phone: e.target.value },
                                }))
                              }
                              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-earth-700">Código da conta</label>
                            <input
                              type="text"
                              value={userDetailModal.profileForm.account_code}
                              onChange={(e) =>
                                setUserDetailModal((m) => ({
                                  ...m,
                                  profileForm: { ...m.profileForm, account_code: e.target.value },
                                }))
                              }
                              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-earth-700">Função</label>
                            <select
                              value={userDetailModal.profileForm.role}
                              onChange={(e) =>
                                setUserDetailModal((m) => ({
                                  ...m,
                                  profileForm: { ...m.profileForm, role: e.target.value },
                                }))
                              }
                              className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                            >
                              <option value="user">Usuário</option>
                              <option value="admin">Administrador</option>
                            </select>
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={userDetailModal.saving}
                          className="rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-white hover:bg-earth-900 disabled:opacity-60"
                        >
                          {userDetailModal.saving ? 'Salvando...' : 'Salvar alterações'}
                        </button>
                      </form>
                    </div>

                    {/* Carteira */}
                    <div>
                      <h4 className="font-medium text-earth-900 mb-3">Carteira</h4>
                      <p className="text-sm text-earth-600 mb-2">
                        Saldo atual: {formatMoney(userDetailModal.wallet?.balance ?? 0, userDetailModal.wallet?.currency || 'JPY')}
                      </p>
                      <form onSubmit={handleAddWalletBalance} className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="block text-sm font-medium text-earth-700">Valor a adicionar (¥)</label>
                          <input
                            type="number"
                            step="1"
                            min="0.01"
                            value={userDetailModal.walletAmount}
                            onChange={(e) =>
                              setUserDetailModal((m) => ({ ...m, walletAmount: e.target.value }))
                            }
                            placeholder="Ex: 1000"
                            className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                          />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-sm font-medium text-earth-700">Descrição (opcional)</label>
                          <input
                            type="text"
                            value={userDetailModal.walletDesc}
                            onChange={(e) =>
                              setUserDetailModal((m) => ({ ...m, walletDesc: e.target.value }))
                            }
                            placeholder="Ex: Ajuste de saldo"
                            className="mt-1 block w-full rounded-lg border border-earth-300 px-3 py-2 text-earth-900"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={userDetailModal.walletSaving}
                          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                        >
                          {userDetailModal.walletSaving ? 'Adicionando...' : 'Adicionar saldo'}
                        </button>
                      </form>
                    </div>

                    {/* Pedidos do usuário */}
                    <div>
                      <h4 className="font-medium text-earth-900 mb-3">Pedidos ({userDetailModal.ordersCount})</h4>
                      {userDetailModal.ordersCount === 0 ? (
                        <p className="text-sm text-earth-600">Nenhum pedido.</p>
                      ) : (
                        <p className="text-sm text-earth-600 mb-2">
                          Vá para a aba Pedidos para editar os pedidos deste usuário.
                        </p>
                      )}
                      {orders.filter((o) => o.user_id === userDetailModal.user?.id).slice(0, 5).map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-lg border border-earth-200 bg-earth-50 px-4 py-2 mb-2"
                        >
                          <div>
                            <span className="font-medium text-earth-900">Pedido {o.id?.slice(0, 8)}…</span>
                            <span className="ml-2 rounded bg-earth-200 px-2 py-0.5 text-xs text-earth-700">
                              {ORDER_STATUS_LABELS[o.status] ?? o.status}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              openOrderEditModal(o)
                              closeUserDetail()
                              setActiveTab('pedidos')
                            }}
                            className="rounded border border-earth-300 px-2 py-1 text-sm font-medium text-earth-700 hover:bg-earth-100"
                          >
                            Editar
                          </button>
                        </div>
                      ))}
                      {userDetailModal.ordersCount > 5 && (
                        <p className="text-xs text-earth-500 mt-2">
                          Mostrando 5 de {userDetailModal.ordersCount}. Veja todos na aba Pedidos.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

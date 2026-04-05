/**
 * Admin - Painel de administraÃ§Ã£o da plataforma.
 * Inclui gestÃ£o de produtos e pedidos.
 */
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import {
  getProductsAdmin,
  getStoreProductsAdmin,
  addProductToStoreAdmin,
  removeProductFromStoreAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
} from '../../../services/productService'
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
} from '../../../services/orderService'
import {
  addInventoryFromOrderAdmin,
  registerPackageAdmin,
  getShippingPanelAdmin,
  setShipmentFreightAdmin,
  setShipmentShippedAdmin,
  setShipmentCompletedAdmin,
  setShipmentPaidAdmin,
} from '../../../services/inventoryService'
import { getUsersAdmin, getUserFullAdmin, updateProfileAdmin } from '../../../services/profileService'
import {
  addWalletBalanceAdmin,
  removeWalletBalanceAdmin,
  getWalletTopupRequestsAdmin,
  approveWalletTopupAdmin,
  rejectWalletTopupAdmin,
} from '../../../services/walletService'
import {
  createPurchaseGroup,
  getPurchaseGroupsAdmin,
  updatePurchaseGroup,
  deletePurchaseGroup,
  createPurchaseGroupProduct,
  updatePurchaseGroupProduct,
  deletePurchaseGroupProduct,
} from '../../../services/groupService'
import { getPurchaseGroupProducts } from '../../../services/productService'
import { getUserLogs, getAuthLogs, logAdminAction } from '../../../services/logService'
import { getMyAdminNotifications, markNotificationRead } from '../../../services/notificationService'
import { getFraudReviewQueue, decideFraudCase } from '../../../services/fraudService'
import { searchCatalogAdmin } from '../../../services/catalogSearchService'
import { brlToJpy, formatJPY, formatWeight } from '../../../lib/fx'
import { parseQuoteMessage, serializeQuoteProducts } from '../../../lib/quoteProducts'
import QuoteProductsList from '../../../components/QuoteProductsList'
import OrderAttachments from '../../../components/OrderAttachments'
import { getSystemSettings, saveSystemSettingsAdmin } from '../../../services/settingsService'
import { getPaymentsApiBase } from '../../../services/paymentService'
import { PRODUCT_CONDITION_OPTIONS, getProductConditionMeta, normalizeProductCondition } from '../../../lib/productCondition'
import AdminTabsNav from './AdminTabsNav'
import { ADMIN_TABS, adminTabPathFromId, normalizeAdminTabId } from './adminTabs'
import { AdminContextProvider } from './AdminContext'
import MarketingSection from './sections/MarketingSection'
import FraudeSection from './sections/FraudeSection'
import NotificacoesSection from './sections/NotificacoesSection'
import RecargasSection from './sections/RecargasSection'
import LogsSection from './sections/LogsSection'
import EnviosSection from './sections/EnviosSection'
import ProdutosSection from './sections/ProdutosSection'
import BuscaCatalogoSection from './sections/BuscaCatalogoSection'
import UsuariosSection from './sections/UsuariosSection'
import GruposSection from './sections/GruposSection'
import CatalogoProdutosSection from './sections/CatalogoProdutosSection'
import PedidosSection from './sections/PedidosSection'

function formatMoney(v, currency = 'BRL') {
  return Number(v)?.toLocaleString('pt-BR', { style: 'currency', currency }) ?? 'â€”'
}

const ADMIN_PAGE_SIZE = {
  orders: 100,
  products: 120,
  users: 100,
}
const ADMIN_TAB_ORDER_STORAGE_KEY = 'admin_tabs_order_v1'

function formatOrderModuleLabel(order) {
  if (!order) return null
  if (order.order_module === 'self_buy') return 'Redirecionamento Â· PadrÃ£o'
  if (order.order_module === 'assisted_buy') return 'Redirecionamento Â· Assistido'
  return null
}

function getProductBasePriceJpy(product) {
  const jpy = Number(product?.price_jpy ?? product?.price)
  return Number.isFinite(jpy) && jpy > 0 ? jpy : 0
}

function PaginationControls({ page, hasMore, loading, onPrev, onNext }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-earth-200 bg-white px-3 py-2 text-sm">
      <span className="text-earth-600">PÃ¡gina {page + 1}</span>
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
          PrÃ³xima
        </button>
      </div>
    </div>
  )
}

export default function Admin({ routeTabId = 'pedidos' }) {
  const { user, profile, session } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [storeProducts, setStoreProducts] = useState([])
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
    item_condition: 'new',
    image_url: '',
    image_urls: [],
    is_active: true,
  })
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUploadError, setImageUploadError] = useState('')
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [shippingModal, setShippingModal] = useState({
    open: false,
    orderId: null,
    cost: '',
    currency: 'JPY',
    redirectFeePerItem: '',
    shippingBufferPercent: '',
    orderSnapshot: null,
  })
  const [quoteModal, setQuoteModal] = useState({
    open: false,
    orderId: null,
    orderDescription: '',
    products: [{ name: '', valor: '', quantidade: 1, descricao: '' }],
    currency: 'JPY',
    orderModule: 'personal_shopping',
  })
  const [orderEditModal, setOrderEditModal] = useState({
    open: false,
    orderId: null,
    order_module: null,
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
    products: [{ name: '', quantity: '', price: '' }],
    order_id: '',
    weight_kg: '',
    photo_url: '',
    video_url: '',
  })
  const [activeTab, setActiveTabState] = useState(() => normalizeAdminTabId(routeTabId))

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

  const TABS = ADMIN_TABS

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
    walletSavingAction: null,
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
  const [orderStatusFilter, setOrderStatusFilter] = useState([])
  const [orderStatusCounts, setOrderStatusCounts] = useState({})
  const [ordersTotalCount, setOrdersTotalCount] = useState(0)
  const [productsPage, setProductsPage] = useState(0)
  const [productsHasMore, setProductsHasMore] = useState(false)
  const [storeProductsPage, setStoreProductsPage] = useState(0)
  const [storeProductsHasMore, setStoreProductsHasMore] = useState(false)
  const [storeProductSearch, setStoreProductSearch] = useState('')
  const [storeLinkSubmittingId, setStoreLinkSubmittingId] = useState('')
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

  const setActiveTab = (nextTabId) => {
    const safeId = normalizeAdminTabId(nextTabId)
    setActiveTabState(safeId)
    const nextPath = `/app/admin/${adminTabPathFromId(safeId)}`
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      navigate(nextPath)
    }
  }

  useEffect(() => {
    const safeId = normalizeAdminTabId(routeTabId)
    setActiveTabState((prev) => (prev === safeId ? prev : safeId))
  }, [routeTabId])

  // Persist order status filter
  useEffect(() => {
    if (!user?.id) return
    try {
      const saved = localStorage.getItem(`admin_order_status_filter_v1_${user.id}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setOrderStatusFilter(parsed)
      }
    } catch (e) {
      console.warn('Failed to load order status filter', e)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    try {
      localStorage.setItem(`admin_order_status_filter_v1_${user.id}`, JSON.stringify(orderStatusFilter))
    } catch (e) {
      console.warn('Failed to save order status filter', e)
    }
  }, [orderStatusFilter, user?.id])

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

  const loadStoreProducts = async (active = () => true, page = storeProductsPage) => {
    if (active()) setLoading(true)
    try {
      const { data, error } = await getStoreProductsAdmin(
        ADMIN_PAGE_SIZE.products,
        page * ADMIN_PAGE_SIZE.products
      )
      if (!active()) return
      const list = data ?? []
      setStoreProducts(list)
      setStoreProductsHasMore(list.length === ADMIN_PAGE_SIZE.products)
      if (error) setMessage(error.message)
    } catch (e) {
      if (active()) setMessage(e?.message || 'Erro ao carregar produtos da loja')
    } finally {
      if (active()) setLoading(false)
    }
  }

  const loadOrders = async (active = () => true, page = ordersPage) => {
    if (active()) setOrdersLoading(true)
    try {
      const { data, error } = await getAllOrdersAdmin(
        ADMIN_PAGE_SIZE.orders,
        page * ADMIN_PAGE_SIZE.orders,
        orderStatusFilter.length > 0 ? orderStatusFilter : null
      )
      if (!active()) return
      const list = data ?? []
      setOrders(list)
      setOrdersHasMore(list.length === ADMIN_PAGE_SIZE.orders)
      if (error) setMessage(error.message)
      // Contagem global por status (independente do filtro atual) para exibir nos chips.
      const { data: allOrders, error: allOrdersError } = await getAllOrdersAdmin(5000, 0, null)
      if (active() && !allOrdersError) {
        const counts = {}
        for (const o of allOrders ?? []) {
          const st = String(o?.status || '')
          if (!st) continue
          counts[st] = (counts[st] || 0) + 1
        }
        setOrderStatusCounts(counts)
        setOrdersTotalCount((allOrders ?? []).length)
      }
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
      if (active()) setMessage(e?.message || 'Erro ao carregar serviÃ§os')
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
    loadStoreProducts(() => isActive)
    return () => {
      isActive = false
    }
  }, [storeProductsPage])

  useEffect(() => {
    let isActive = true
    loadOrders(() => isActive)
    return () => {
      isActive = false
    }
  }, [ordersPage, orderStatusFilter])

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
      if (active()) setMessage(e?.message || 'Erro ao carregar usuÃ¡rios')
    } finally {
      if (active()) setUsersListLoading(false)
    }
  }

  const openUserDetail = async (u) => {
    setUserDetailModal((m) => ({
      ...m,
      open: true,
      user: u,
      loading: true,
      profile: null,
      wallet: null,
      ordersCount: 0,
      walletSaving: false,
      walletSavingAction: null,
    }))
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
        walletSaving: false,
        walletSavingAction: null,
      }))
    } catch (e) {
      setMessage(e?.message || 'Erro ao carregar usuÃ¡rio')
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
      walletSavingAction: null,
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

  const handleAdjustWalletBalance = async (mode = 'credit', e = null) => {
    e?.preventDefault?.()
    const uid = userDetailModal.user?.id
    if (!uid) return
    const amount = parseFloat(userDetailModal.walletAmount)
    if (isNaN(amount) || amount <= 0) {
      setMessage('Informe um valor positivo.')
      return
    }
    setUserDetailModal((m) => ({ ...m, walletSaving: true, walletSavingAction: mode }))
    setMessage('')
    try {
      const isDebit = mode === 'debit'
      const currentBalance = Number(userDetailModal.wallet?.balance) || 0
      if (isDebit && amount > currentBalance) {
        setMessage('Saldo insuficiente para remoÃ§Ã£o.')
        setUserDetailModal((m) => ({ ...m, walletSaving: false, walletSavingAction: null }))
        return
      }

      const action = isDebit ? removeWalletBalanceAdmin : addWalletBalanceAdmin
      const { error } = await action(uid, amount, userDetailModal.walletDesc.trim() || null)
      if (error) {
        setMessage(error.message)
        setUserDetailModal((m) => ({ ...m, walletSaving: false, walletSavingAction: null }))
        return
      }
      logAdminAction(isDebit ? 'wallet_debit' : 'wallet_credit', 'profile', uid, {
        amount,
        description: userDetailModal.walletDesc,
      })
      const { data } = await getUserFullAdmin(uid)
      setUserDetailModal((m) => ({
        ...m,
        walletSaving: false,
        walletSavingAction: null,
        wallet: data?.wallet ?? { balance: 0, currency: 'JPY' },
        walletAmount: '',
        walletDesc: '',
      }))
      setMessage(isDebit ? 'Saldo removido com sucesso.' : 'Saldo adicionado com sucesso.')
    } catch (e) {
      setMessage(e?.message || (mode === 'debit' ? 'Erro ao remover saldo' : 'Erro ao adicionar saldo'))
      setUserDetailModal((m) => ({ ...m, walletSaving: false, walletSavingAction: null }))
    }
  }

  const handleAddWalletBalance = async (e) => {
    await handleAdjustWalletBalance('credit', e)
  }

  const handleRemoveWalletBalance = async () => {
    await handleAdjustWalletBalance('debit')
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
      if (active()) setMessage(e?.message || 'Erro ao carregar notificaÃ§Ãµes do admin')
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
        setMessage(error.message || 'Erro ao atualizar decisÃ£o antifraude')
        return
      }
      setMessage('DecisÃ£o antifraude salva.')
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
      item_condition: 'new',
      image_url: '',
      image_urls: [],
      is_active: true,
    })
    setEditingId(null)
    setImageUploadError('')
    setNewImageUrl('')
    setProductReferenceId('')
  }

  const normalizeProductImageList = (list) => (Array.isArray(list) ? list.filter(Boolean) : [])

  const setProductImages = (nextOrUpdater) => {
    setForm((f) => {
      const current = normalizeProductImageList(f.image_urls)
      const nextRaw = typeof nextOrUpdater === 'function' ? nextOrUpdater(current) : nextOrUpdater
      const next = normalizeProductImageList(nextRaw)
      return {
        ...f,
        image_urls: next,
        image_url: next[0] || '',
      }
    })
  }

  const addProductImage = (url) => {
    const safeUrl = String(url || '').trim()
    if (!safeUrl) return
    setProductImages((prev) => [...prev, safeUrl])
  }

  const removeProductImageAt = (index) => {
    setProductImages((prev) => prev.filter((_, i) => i !== index))
  }

  const moveProductImage = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return
    setProductImages((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) return prev
      const list = [...prev]
      const [moved] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, moved)
      return list
    })
  }

  const setProductCover = (index) => {
    moveProductImage(index, 0)
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
      // Persistimos preÃ§o base em JPY no catÃ¡logo.
      price,
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
      setMessage('PreÃ§o invÃ¡lido')
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
      price: String(Math.round(getProductBasePriceJpy(p))),
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
      price: String(Math.round(getProductBasePriceJpy(item))),
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
      if (active()) setMessage(e?.message || 'Erro ao carregar logs de autenticaÃ§Ã£o')
    } finally {
      if (active()) setAuthLogsLoading(false)
    }
  }

  const handleSaveGroup = async (e) => {
    e.preventDefault()
    setMessage('')

    const name = groupForm.name?.trim()
    if (!name) {
      setMessage('Nome do grupo Ã© obrigatÃ³rio')
      return
    }

    const imageUrls = Array.isArray(groupForm.image_urls) ? groupForm.image_urls.filter(Boolean) : []
    if (!imageUrls.length) {
      setMessage('Fotos do grupo sÃ£o obrigatÃ³rias')
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
      price: String(Math.round(getProductBasePriceJpy(refProduct))),
      weight_kg: useG ? String(Math.round(kg * 1000)) : String(kg || ''),
      weight_unit: useG ? 'g' : 'kg',
      stock_quantity: refProduct.stock_quantity != null ? String(refProduct.stock_quantity) : prev.stock_quantity,
      item_condition: normalizeProductCondition(refProduct.item_condition ?? prev.item_condition),
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
      price: String(Math.round(getProductBasePriceJpy(refProduct))),
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
      price: String(Math.round(getProductBasePriceJpy(p))),
      weight_kg: useG ? String(Math.round(kg * 1000)) : String(kg),
      weight_unit: useG ? 'g' : 'kg',
      stock_quantity: p.stock_quantity != null ? String(p.stock_quantity) : '',
      item_condition: normalizeProductCondition(p.item_condition),
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
      setMessage('PreÃ§o invÃ¡lido')
      return
    }
    const weightVal = parseFloat(form.weight_kg)
    if (isNaN(weightVal) || weightVal <= 0) {
      setMessage('Peso invÃ¡lido (informe o peso do produto)')
      return
    }
    const weightKg = form.weight_unit === 'g' ? weightVal / 1000 : weightVal
    // Persistimos preÃ§o base em JPY no catÃ¡logo.
    const price = priceJpy
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
      item_condition: normalizeProductCondition(form.item_condition),
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
    // Log nÃ£o deve interferir no UX de remoÃ§Ã£o.
    logAdminAction('product_delete', 'product', id).catch(() => {})
  }

  const handlePublishToStore = async (productId) => {
    if (!productId) return
    setStoreLinkSubmittingId(productId)
    const { error } = await addProductToStoreAdmin(productId)
    setStoreLinkSubmittingId('')
    if (error) {
      setMessage(error.message || 'Erro ao publicar produto na loja')
      return
    }
    setMessage('Produto publicado na loja virtual')
    loadStoreProducts()
  }

  const handleUnpublishFromStore = async (productId) => {
    if (!productId || !confirm('Remover este item da Loja Virtual?')) return
    setStoreLinkSubmittingId(productId)
    const { error } = await removeProductFromStoreAdmin(productId)
    setStoreLinkSubmittingId('')
    if (error) {
      setMessage(error.message || 'Erro ao remover produto da loja')
      return
    }
    setMessage('Produto removido da loja virtual')
    loadStoreProducts()
  }

  const handleDuplicate = async (p) => {
    setDuplicatingId(p.id)
    setMessage('')
    const urls = Array.isArray(p.image_urls)?.length ? p.image_urls.filter(Boolean) : (p.image_url ? [p.image_url] : [])
    const payload = {
      name: `${(p.name || '').trim()} (cÃ³pia)`,
      description: p.description ?? '',
      price: p.price,
      weight_kg: p.weight_kg ?? 0,
      stock_quantity: p.stock_quantity ?? null,
      item_condition: normalizeProductCondition(p.item_condition),
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
      if (status === 'paid' && session?.access_token) {
        const base = getPaymentsApiBase()
        void fetch(`${base}/invoices/ensure`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderId }),
        }).catch(() => null)
      }
    }
  }

  const openShippingModal = (order) => {
    const savedBreakdown =
      order?.shipping_quote_breakdown && typeof order.shipping_quote_breakdown === 'object'
        ? order.shipping_quote_breakdown
        : null
    const parsed = parseQuoteMessage(order?.message || '')
    const parsedProducts = Array.isArray(parsed?.products) ? parsed.products : []
    const itemsCount = parsedProducts.reduce((acc, item) => {
      const qty = Math.max(1, parseInt(item?.quantidade, 10) || 1)
      return acc + qty
    }, 0)
    setShippingModal({
      open: true,
      orderId: order.id,
      cost: order.shipping_cost ? String(order.shipping_cost) : '',
      currency: order.shipping_currency || 'JPY',
      redirectFeePerItem:
        savedBreakdown?.redirect_fee_per_item != null
          ? String(savedBreakdown.redirect_fee_per_item)
          : '',
      shippingBufferPercent:
        savedBreakdown?.shipping_buffer_percent != null
          ? String(savedBreakdown.shipping_buffer_percent)
          : '',
      orderSnapshot: {
        id: order.id,
        user_name: order.user_name,
        user_email: order.user_email,
        user_id: order.user_id,
        service_name: order.service_name,
        order_source: order.order_source,
        order_module: order.order_module,
        message: order.message || '',
        attachment_urls: Array.isArray(order.attachment_urls) ? order.attachment_urls : [],
        parsedProducts,
        itemsCount,
      },
    })
  }

  const handleSetShipping = async (e) => {
    e.preventDefault()
    const baseShipping = parseFloat(shippingModal.cost)
    if (isNaN(baseShipping) || baseShipping < 0) {
      setMessage('Valor do frete invÃ¡lido')
      return
    }
    const perItemFee = Math.max(0, parseFloat(shippingModal.redirectFeePerItem || '0') || 0)
    const bufferPercent = Math.max(0, parseFloat(shippingModal.shippingBufferPercent || '0') || 0)
    const itemCount = Math.max(0, Number(shippingModal.orderSnapshot?.itemsCount) || 0)
    const redirectFeeTotal = perItemFee * itemCount
    const bufferAmount = baseShipping * (bufferPercent / 100)
    const cost = baseShipping + redirectFeeTotal + bufferAmount
    const breakdown = {
      base_shipping: baseShipping,
      redirect_fee_per_item: perItemFee,
      redirect_fee_total: redirectFeeTotal,
      items_count: itemCount,
      shipping_buffer_percent: bufferPercent,
      shipping_buffer_amount: bufferAmount,
      final_total: cost,
      currency: shippingModal.currency || 'JPY',
      // audit context (optional, useful to understand how total was composed)
      order_module: shippingModal.orderSnapshot?.order_module || null,
    }
    const { error } = await setShippingAndAwaitPaymentAdmin(
      shippingModal.orderId,
      cost,
      shippingModal.currency,
      breakdown
    )
    setMessage(error ? error.message : 'Frete definido. Aguardando pagamento do cliente.')
    if (!error) {
      logAdminAction('order_set_shipping', 'order', shippingModal.orderId, {
        cost,
        currency: shippingModal.currency,
        base_shipping: baseShipping,
        redirect_fee_per_item: perItemFee,
        redirect_fee_total: redirectFeeTotal,
        items_count: itemCount,
        shipping_buffer_percent: bufferPercent,
        shipping_buffer_amount: bufferAmount,
        breakdown,
      })
      setShippingModal({
        open: false,
        orderId: null,
        cost: '',
        currency: 'JPY',
        redirectFeePerItem: '',
        shippingBufferPercent: '',
        orderSnapshot: null,
      })
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
      setMessage('Valor do frete invÃ¡lido')
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
      setMessage('Adicione ao menos um produto com nome ou descriÃ§Ã£o e valor.')
      return
    }
    const total = products.reduce((s, p) => s + p.valor * p.quantidade, 0)
    const message = serializeQuoteProducts(products, quoteModal.orderDescription)
    setSubmitting(true)
    setMessage('')
    const { error } = await setQuoteAdmin(quoteModal.orderId, total, 'JPY', message)
    setSubmitting(false)
    setMessage(error ? error.message : 'OrÃ§amento definido. Cliente pode pagar em Pedidos.')
    if (!error) {
      logAdminAction('order_set_quote', 'order', quoteModal.orderId, { total, currency: 'JPY', productsCount: products.length })
      setQuoteModal({ 
        open: false, 
        orderId: null, 
        orderDescription: '', 
        products: [{ name: '', valor: '', quantidade: 1, descricao: '' }], 
        currency: 'JPY',
        orderModule: 'personal_shopping'
      })
      loadOrders()
    }
  }

  const openQuoteModalFromOrder = (order) => {
    const parsed = parseQuoteMessage(order?.message)
    const orderDescription = parsed?.orderDescription ?? (parsed ? '' : (order?.message?.trim() ?? ''))
    const products = parsed?.products?.length
      ? parsed.products.map((p) => ({
        name: String(p.name ?? ''),
        valor: p.valor != null ? String(p.valor) : '',
        quantidade: p.quantidade != null ? String(p.quantidade) : '1',
        descricao: String(p.descricao ?? ''),
      }))
      : [{ name: '', valor: '', quantidade: 1, descricao: '' }]

    setQuoteModal({
      open: true,
      orderId: order?.id ?? null,
      orderDescription,
      products,
      currency: 'JPY',
      orderModule: order?.order_module || 'personal_shopping',
    })
  }

  const openOrderEditModal = (order) => {
    setOrderEditModal({
      open: true,
      orderId: order.id,
      order_module: order.order_module ?? null,
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
      order_module: null,
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
      setMessage('Valor do frete invÃ¡lido')
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
    if (!confirm('Remover este pedido? Esta aÃ§Ã£o nÃ£o pode ser desfeita.')) return
    const { error } = await deleteOrderAdmin(orderId)
    setMessage(error ? error.message : 'Pedido removido')
    if (!error) {
      logAdminAction('order_delete', 'order', orderId)
      loadOrders()
    }
  }

  const openOrderFromAdminNotification = async (orderId) => {
    if (!orderId) return false
    const localOrder = (orders || []).find((o) => o.id === orderId)
    if (localOrder) {
      openOrderEditModal(localOrder)
      return true
    }
    try {
      const { data, error } = await getAllOrdersAdmin(5000, 0, null)
      if (error) {
        setMessage(error.message || 'Erro ao localizar pedido da notificaÃ§Ã£o')
        return false
      }
      const target = (data || []).find((o) => o.id === orderId)
      if (!target) {
        setMessage('Pedido da notificaÃ§Ã£o nÃ£o foi encontrado.')
        return false
      }
      openOrderEditModal(target)
      return true
    } catch (e) {
      setMessage(e?.message || 'Erro ao abrir pedido da notificaÃ§Ã£o')
      return false
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
      setMessage(error ? error.message : 'Item adicionado ao inventÃ¡rio do usuÃ¡rio.')
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
      setMessage('Selecione o usuÃ¡rio.')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const { error } = await createOrderForUserAdmin(uid, {
        service_id: createOrderModal.service_id || null,
        message: createOrderModal.message?.trim() || null,
      })
      setMessage(error ? error.message : 'Pedido criado na conta do usuÃ¡rio.')
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
      setMessage('Selecione o usuÃ¡rio.')
      return
    }

    const validProducts = registerPackageModal.products.filter(p => p.name?.trim())
    if (validProducts.length === 0) {
      setMessage('Adicione pelo menos um produto.')
      return
    }

    setSubmitting(true)
    setMessage('')
    try {
      const { error } = await registerPackageAdmin(uid, {
        products: validProducts.map(p => ({
          name: p.name.trim(),
          quantity: parseInt(p.quantity) || 1,
          price: parseFloat(p.price) || 0,
        })),
        order_id: registerPackageModal.order_id?.trim() || null,
        weight_kg: registerPackageModal.weight_kg ? parseFloat(registerPackageModal.weight_kg) : null,
        photo_url: registerPackageModal.photo_url?.trim() || null,
        video_url: registerPackageModal.video_url?.trim() || null,
      })
      setMessage(error ? error.message : 'Pacote registrado na conta do usuÃ¡rio.')
      if (!error) {
        logAdminAction('package_register', null, null, { 
          user_id: registerPackageModal.user_id,
          products_count: validProducts.length 
        })
        setRegisterPackageModal({ 
          open: false, 
          user_id: '', 
          products: [{ name: '', quantity: '', price: '' }],
          order_id: '',
          weight_kg: '',
          photo_url: '',
          video_url: '',
        })
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
        setExternalSearchError(error.message || 'Erro ao buscar catÃ¡logos.')
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
      setExternalSearchError(e?.message || 'Erro ao buscar catÃ¡logos.')
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
    if (price == null || Number.isNaN(Number(price))) return 'PreÃ§o indisponÃ­vel'
    return Number(price).toLocaleString('pt-BR', { style: 'currency', currency: String(currency).toUpperCase() })
  }

  const masterProductReferences = products.filter((p) => !p.purchase_group_id)
  const storePublishCandidates = masterProductReferences.filter((p) => !p.store_linked)
  const productReferenceTerm = productReferenceSearch.trim().toLowerCase()
  const groupProductReferenceTerm = groupProductReferenceSearch.trim().toLowerCase()
  const storeProductTerm = storeProductSearch.trim().toLowerCase()

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

  const filteredStorePublishCandidates = storePublishCandidates.filter((p) => {
    if (!storeProductTerm) return true
    const haystack = [p.id, p.name, p.description]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ')
    return haystack.includes(storeProductTerm)
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
  const adminContextValue = {
    activeTab,
    setActiveTab,
    ORDER_STATUS,
    ORDER_STATUS_LABELS,
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
    openQuoteModalFromOrder,
    openInventoryModal,
    handleDeleteOrder,
    ordersPage,
    ordersHasMore,
    setOrdersPage,
    shippingModal,
    setShippingModal,
    handleSetShipping,
    shipmentFreightModal,
    setShipmentFreightModal,
    handleSetShipmentFreight,
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
    submitting,
    loadShippingPanel,
    shippingPanelLoading,
    shippingPanel,
    loadOrders,
    openShippingModal,
    handleOrderStatus,
    openOrderEditModal,
    openShipmentFreightModal,
    handleSetShipmentPaid,
    openShipmentShippedModal,
    handleSetShipmentCompleted,
    PaginationControls,
    getProductBasePriceJpy,
    getProductConditionMeta,
    formatJPY,
    formatWeight,
    resetForm,
    setCatalogCreateOpen,
    storeProductSearch,
    setStoreProductSearch,
    filteredStorePublishCandidates,
    handlePublishToStore,
    storeLinkSubmittingId,
    loading,
    storeProducts,
    handleUnpublishFromStore,
    storeProductsPage,
    storeProductsHasMore,
    setStoreProductsPage,
    handleExternalSearchSubmit,
    externalSearchQuery,
    setExternalSearchQuery,
    externalSearchLoading,
    externalSearchStores,
    toggleExternalStore,
    externalSearchError,
    externalSearchMeta,
    externalSearchPage,
    externalSearchPartials,
    externalSearchResults,
    formatExternalPrice,
    runExternalSearch,
    usersListLoading,
    usersList,
    openUserDetail,
    usersPage,
    usersHasMore,
    setUsersPage,
    handleSaveGroup,
    groupForm,
    setGroupForm,
    editingGroupId,
    groupProducts,
    handleEditGroupProduct,
    handleDeleteGroupProduct,
    pendingGroupProducts,
    handleEditPendingGroupProduct,
    handleRemovePendingGroupProduct,
    groupProductForm,
    groupProductSubmitting,
    handleSaveGroupProduct,
    groupProductReferenceSearch,
    setGroupProductReferenceSearch,
    groupProductReferenceId,
    setGroupProductReferenceId,
    filteredGroupProductReferences,
    applyReferenceToGroupProductForm,
    masterProductReferences,
    groupProductImageUploading,
    setGroupProductImageUploading,
    setGroupProductForm,
    editingGroupProductId,
    editingPendingProductIndex,
    resetGroupProductForm,
    groupImageUploading,
    setGroupImageUploading,
    groupImageUploadError,
    setGroupImageUploadError,
    newGroupImageUrl,
    setNewGroupImageUrl,
    groupSubmitting,
    resetGroupForm,
    groupsLoading,
    purchaseGroups,
    handleEditGroup,
    handleDeleteGroup,
    loadProducts,
    catalogSearch,
    setCatalogSearch,
    catalogStatusFilter,
    setCatalogStatusFilter,
    catalogCreateOpen,
    handleSave,
    form,
    setForm,
    imageUploading,
    setImageUploadError,
    setImageUploading,
    addProductImage,
    newImageUrl,
    setNewImageUrl,
    imageUploadError,
    moveProductImage,
    setProductCover,
    removeProductImageAt,
    editingId,
    catalogProducts,
    products,
    handleEdit,
    handleDuplicate,
    duplicatingId,
    handleDelete,
    productsPage,
    productsHasMore,
    setProductsPage,
    marketingLoading,
    loadMarketingData,
    settingsForm,
    setSettingsForm,
    setMessage,
    topupLoading,
    topupRequests,
    formatMoney,
    loadTopupRequests,
    loadAdminNotifications,
    adminNotificationsLoading,
    adminNotifications,
    setAdminNotifications,
    openOrderFromAdminNotification,
    loadFraudQueue,
    fraudQueueLoading,
    fraudMinScore,
    setFraudMinScore,
    fraudStatusFilter,
    setFraudStatusFilter,
    fraudSearchTerm,
    setFraudSearchTerm,
    filteredFraudReferrals,
    filteredFraudAffiliateOrders,
    fraudQueue,
    handleFraudDecision,
    fraudDecisionLoadingId,
    loadUserLogs,
    userLogsLoading,
    userLogs,
    loadAuthLogs,
    authLogsLoading,
    authLogs,
  }

  return (
    <>
      <Helmet>
        <title>Admin | Plataforma</title>
      </Helmet>
      <AdminContextProvider value={adminContextValue}>
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

        {/* NavegaÃ§Ã£o por abas */}
        <AdminTabsNav
          orderedTabs={orderedTabs}
          activeTab={activeTab}
          draggingTabId={draggingTabId}
          setDraggingTabId={setDraggingTabId}
          onTabChange={setActiveTab}
          onTabReorder={handleTabReorder}
        />

        {/* Pedidos - Fluxo Redirecionamento */}
        <PedidosSection />

        {/* Usuários */}
        <UsuariosSection />

        {/* Grupo de Compras */}
        <GruposSection />

        {/* Referral */}
        <MarketingSection />

        {/* Fila antifraude */}
        <FraudeSection />

        {/* Notificações (ações para admin) */}
        <NotificacoesSection />

        {/* Recargas PIX */}
        <RecargasSection />

        {/* Logs */}
        <LogsSection />

        {/* Painel de Envios */}
        <EnviosSection />

        {/* Loja - Produtos */}
        <ProdutosSection />

        {/* Busca unificada em catálogos externos (MVP admin) */}
        <BuscaCatalogoSection />

        {/* Catálogo mestre de produtos */}
        <CatalogoProdutosSection />

        {/* Modal: detalhes e ediÃ§Ã£o do usuÃ¡rio */}
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
                  {userDetailModal.loading ? 'Carregando...' : (userDetailModal.profile?.name || userDetailModal.user?.email || 'UsuÃ¡rio')}
                </h3>
                <button
                  type="button"
                  onClick={closeUserDetail}
                  className="rounded p-1 text-earth-500 hover:bg-earth-100 hover:text-earth-900"
                  aria-label="Fechar"
                >
                  Ã—
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
                            <label className="block text-sm font-medium text-earth-700">CÃ³digo da conta</label>
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
                            <label className="block text-sm font-medium text-earth-700">FunÃ§Ã£o</label>
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
                              <option value="user">UsuÃ¡rio</option>
                              <option value="admin">Administrador</option>
                            </select>
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={userDetailModal.saving}
                          className="rounded-lg bg-earth-800 px-4 py-2 text-sm font-medium text-white hover:bg-earth-900 disabled:opacity-60"
                        >
                          {userDetailModal.saving ? 'Salvando...' : 'Salvar alteraÃ§Ãµes'}
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
                          <label className="block text-sm font-medium text-earth-700">Valor (Â¥)</label>
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
                          <label className="block text-sm font-medium text-earth-700">DescriÃ§Ã£o (opcional)</label>
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
                          {userDetailModal.walletSaving && userDetailModal.walletSavingAction === 'credit'
                            ? 'Adicionando...'
                            : 'Adicionar saldo'}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveWalletBalance}
                          disabled={userDetailModal.walletSaving}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {userDetailModal.walletSaving && userDetailModal.walletSavingAction === 'debit'
                            ? 'Removendo...'
                            : 'Remover saldo'}
                        </button>
                      </form>
                    </div>

                    {/* Pedidos do usuÃ¡rio */}
                    <div>
                      <h4 className="font-medium text-earth-900 mb-3">Pedidos ({userDetailModal.ordersCount})</h4>
                      {userDetailModal.ordersCount === 0 ? (
                        <p className="text-sm text-earth-600">Nenhum pedido.</p>
                      ) : (
                        <p className="text-sm text-earth-600 mb-2">
                          VÃ¡ para a aba Pedidos para editar os pedidos deste usuÃ¡rio.
                        </p>
                      )}
                      {orders.filter((o) => o.user_id === userDetailModal.user?.id).slice(0, 5).map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-lg border border-earth-200 bg-earth-50 px-4 py-2 mb-2"
                        >
                          <div>
                            <span className="font-medium text-earth-900">Pedido {o.id?.slice(0, 8)}â€¦</span>
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
      </AdminContextProvider>
    </>
  )
}



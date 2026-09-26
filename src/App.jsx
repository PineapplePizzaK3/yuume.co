import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import WhatsAppFloating from './components/WhatsAppFloating'
import CookieConsentBanner from './components/CookieConsentBanner'
import { LocaleSync } from './components/LocaleSync'
import { recordAffiliateClick } from './services/affiliateService'
import { LOCALE_EN, LOCALE_PT_BR, localizedPath } from './lib/localeRoutes'
import { CART_TOAST_EVENT } from './lib/cartToast'
import { ServicesApp } from './apps/services/ServicesApp'
import { OpeningsApp } from './apps/openings/OpeningsApp'
import { isOpeningsPath } from './apps/openings/pathRules'

const Home = lazy(() => import('./pages/Home'))
const CollectorHome = lazy(() => import('./pages/collector/CollectorHome'))
const RipsPage = lazy(() => import('./pages/collector/RipsPage'))
const RipDetailPage = lazy(() => import('./pages/collector/RipDetailPage'))
const LivesPage = lazy(() => import('./pages/collector/LivesPage'))
const LivePage = lazy(() => import('./pages/collector/LivePage'))
const CollectionPage = lazy(() => import('./pages/collector/CollectionPage'))
const MyRipRecordPage = lazy(() => import('./pages/collector/MyRipRecordPage'))
const CardAssetPage = lazy(() => import('./pages/collector/CardAssetPage'))
const CatalogItemPage = lazy(() => import('./pages/collector/CatalogItemPage'))
const ExplorePage = lazy(() => import('./pages/collector/ExplorePage'))
const SetPage = lazy(() => import('./pages/collector/SetPage'))
const JapanSearchPage = lazy(() => import('./pages/collector/JapanSearchPage'))
const Contact = lazy(() => import('./pages/Contact'))
const OndeComprar = lazy(() => import('./pages/OndeComprar'))
const CatalogSearchPublic = lazy(() => import('./pages/CatalogSearchPublic'))
const EphemeralProductDetail = lazy(() => import('./pages/EphemeralProductDetail'))
const EphemeralProductOpen = lazy(() => import('./pages/EphemeralProductOpen'))
const LiveRipsPage = lazy(() => import('./pages/live-rips/LiveRipsPage'))
const LiveRipDetailPage = lazy(() => import('./pages/live-rips/LiveRipDetailPage'))
const MyRipPage = lazy(() => import('./pages/live-rips/MyRipPage'))
const LiveRipBroadcastPage = lazy(() => import('./pages/live-rips/LiveRipBroadcastPage'))
const LiveRipOverlayPage = lazy(() => import('./pages/live-rips/LiveRipOverlayPage'))
const LiveRipsLayout = lazy(() => import('./layouts/LiveRipsLayout'))
const ItensProibidos = lazy(() => import('./pages/como-funciona/ItensProibidos'))
const TaxasAlfandegarias = lazy(() => import('./pages/como-funciona/TaxasAlfandegarias'))
const ServicosEPrecosLayout = lazy(() => import('./pages/servicos-e-precos/ServicosEPrecosLayout'))
const Servicos = lazy(() => import('./pages/servicos-e-precos/Servicos'))
const FretesEPrazos = lazy(() => import('./pages/servicos-e-precos/FretesEPrazos'))
const Simulador = lazy(() => import('./pages/servicos-e-precos/Simulador'))
const FaqLayout = lazy(() => import('./pages/faq/FaqLayout'))
const Faq = lazy(() => import('./pages/Faq'))
const LegalLayout = lazy(() => import('./layouts/LegalLayout'))
const CommercialDisclosure = lazy(() => import('./pages/legal/CommercialDisclosure'))
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'))
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
const PlatformLayout = lazy(() => import('./layouts/PlatformLayout').then((m) => ({ default: m.PlatformLayout })))
const Login = lazy(() => import('./pages/platform/Login'))
const Register = lazy(() => import('./pages/platform/Register'))
const CompleteSocialProfile = lazy(() => import('./pages/platform/CompleteSocialProfile'))
const ForgotPassword = lazy(() => import('./pages/platform/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/platform/ResetPassword'))
const Dashboard = lazy(() => import('./pages/platform/Dashboard'))
const Profile = lazy(() => import('./pages/platform/Profile'))
const Conta = lazy(() => import('./pages/platform/Conta'))
const Loja = lazy(() => import('./pages/platform/Loja'))
const GrupoDeCompraPagina = lazy(() => import('./pages/platform/GrupoDeCompraPagina'))
const Services = lazy(() => import('./pages/platform/Services'))
const Cart = lazy(() => import('./pages/platform/Cart'))
const AdminLayout = lazy(() => import('./pages/platform/admin/AdminLayout'))
const AdminPedidosTab = lazy(() => import('./pages/platform/admin/tabs/PedidosTab'))
const AdminOrcamentosTab = lazy(() => import('./pages/platform/admin/tabs/OrcamentosTab'))
const AdminUsuariosTab = lazy(() => import('./pages/platform/admin/tabs/UsuariosTab'))
const AdminEnviosTab = lazy(() => import('./pages/platform/admin/tabs/EnviosTab'))
const AdminProdutosUsuariosTab = lazy(() => import('./pages/platform/admin/tabs/ProdutosUsuariosTab'))
const AdminAberturasTab = lazy(() => import('./pages/platform/admin/tabs/AberturasTab'))
const AdminProdutosTab = lazy(() => import('./pages/platform/admin/tabs/ProdutosTab'))
const AdminCatalogoProdutosTab = lazy(() => import('./pages/platform/admin/tabs/CatalogoProdutosTab'))
const AdminGruposTab = lazy(() => import('./pages/platform/admin/tabs/GruposTab'))
const AdminCalculadoraBrasilTab = lazy(() => import('./pages/platform/admin/tabs/CalculadoraBrasilTab'))
const AdminLotesTab = lazy(() => import('./pages/platform/admin/tabs/LotesTab'))
const AdminMarketingTab = lazy(() => import('./pages/platform/admin/tabs/MarketingTab'))
const AdminEmailsTab = lazy(() => import('./pages/platform/admin/tabs/EmailsTab'))
const AdminFraudeTab = lazy(() => import('./pages/platform/admin/tabs/FraudeTab'))
const AdminNotificacoesTab = lazy(() => import('./pages/platform/admin/tabs/NotificacoesTab'))
const AdminRecargasTab = lazy(() => import('./pages/platform/admin/tabs/RecargasTab'))
const AdminInvoicesTab = lazy(() => import('./pages/platform/admin/tabs/InvoicesAdminTab'))
const AdminControleFinanceiroTab = lazy(() => import('./pages/platform/admin/tabs/ControleFinanceiroTab'))
const AdminLogsTab = lazy(() => import('./pages/platform/admin/tabs/LogsTab'))
const AdminMarketSourcesTab = lazy(() => import('./pages/platform/admin/tabs/MarketSourcesTab'))
const AdminCatalogSetsTab = lazy(() => import('./pages/platform/admin/tabs/CatalogSetsTab'))
const Lounge = lazy(() => import('./pages/platform/Lounge'))
const Invoices = lazy(() => import('./pages/platform/Invoices'))
const InvoiceDetail = lazy(() => import('./pages/platform/InvoiceDetail'))
const Affiliate = lazy(() => import('./pages/platform/Affiliate'))
const StoreProductDetail = lazy(() => import('./pages/platform/StoreProductDetail'))

const p = (key, q = '') => localizedPath(key, LOCALE_PT_BR, q)
const e = (key, q = '') => localizedPath(key, LOCALE_EN, q)

function SuspenseLoading() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-earth-600">
      {t('loading')}
    </div>
  )
}

function App() {
  const location = useLocation()
  const toastTimerRef = useRef(null)
  const toastFadeTimerRef = useRef(null)
  const [cartToast, setCartToast] = useState({ visible: false, message: '' })
  const isOpeningsDomain = isOpeningsPath(location.pathname)

  useEffect(() => {
    const onCartToast = (event) => {
      const message = String(event?.detail?.message || '').trim()
      if (!message) return
      const durationMs = Number(event?.detail?.durationMs) || 2800
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (toastFadeTimerRef.current) clearTimeout(toastFadeTimerRef.current)
      setCartToast({ visible: true, message })
      toastTimerRef.current = setTimeout(() => {
        setCartToast((prev) => ({ ...prev, visible: false }))
        toastFadeTimerRef.current = setTimeout(() => {
          setCartToast({ visible: false, message: '' })
        }, 140)
      }, durationMs)
    }

    window.addEventListener(CART_TOAST_EVENT, onCartToast)
    return () => {
      window.removeEventListener(CART_TOAST_EVENT, onCartToast)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (toastFadeTimerRef.current) clearTimeout(toastFadeTimerRef.current)
    }
  }, [])

  const routeComponents = {
    Home,
    CollectorHome,
    RipsPage,
    RipDetailPage,
    LivesPage,
    LivePage,
    CollectionPage,
    MyRipRecordPage,
    CardAssetPage,
    CatalogItemPage,
    ExplorePage,
    SetPage,
    JapanSearchPage,
    Contact,
    OndeComprar,
    CatalogSearchPublic,
    EphemeralProductDetail,
    EphemeralProductOpen,
    LiveRipsPage,
    LiveRipDetailPage,
    MyRipPage,
    LiveRipBroadcastPage,
    LiveRipOverlayPage,
    LiveRipsLayout,
    ItensProibidos,
    TaxasAlfandegarias,
    ServicosEPrecosLayout,
    Servicos,
    FretesEPrazos,
    Simulador,
    FaqLayout,
    Faq,
    LegalLayout,
    CommercialDisclosure,
    PrivacyPolicy,
    TermsOfService,
    ProtectedRoute,
    AdminRoute,
    PlatformLayout,
    Login,
    Register,
    CompleteSocialProfile,
    ForgotPassword,
    ResetPassword,
    Dashboard,
    Profile,
    Conta,
    Loja,
    GrupoDeCompraPagina,
    Services,
    Cart,
    AdminLayout,
    AdminPedidosTab,
    AdminOrcamentosTab,
    AdminUsuariosTab,
    AdminEnviosTab,
    AdminProdutosUsuariosTab,
    AdminAberturasTab,
    AdminProdutosTab,
    AdminCatalogoProdutosTab,
    AdminGruposTab,
    AdminCalculadoraBrasilTab,
    AdminLotesTab,
    AdminMarketingTab,
    AdminEmailsTab,
    AdminFraudeTab,
    AdminNotificacoesTab,
    AdminRecargasTab,
    AdminInvoicesTab,
    AdminControleFinanceiroTab,
    AdminLogsTab,
    AdminMarketSourcesTab,
    AdminCatalogSetsTab,
    Lounge,
    Invoices,
    InvoiceDetail,
    Affiliate,
    StoreProductDetail,
  }

  useEffect(() => {
    const url = new URL(window.location.href)
    const affiliateCode = (url.searchParams.get('ref') || '').trim().toLowerCase()
    if (affiliateCode) {
      localStorage.setItem('affiliate_code', affiliateCode)
      const utm = {}
      for (const [k, v] of url.searchParams.entries()) {
        if (k.startsWith('utm_') && v) utm[k] = v
      }
      const sessionKey = localStorage.getItem('affiliate_session_key') || crypto.randomUUID()
      localStorage.setItem('affiliate_session_key', sessionKey)
      void recordAffiliateClick({
        code: affiliateCode,
        sessionKey,
        source: document.referrer || 'direct',
        utm,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      })
    }
  }, [])

  useEffect(() => {
    const body = document.body
    const originalOverflow = body.style.overflow
    const originalPaddingRight = body.style.paddingRight

    const hasOpenModal = () =>
      !!document.querySelector('[role="dialog"][aria-modal="true"]')

    const syncBodyScrollLock = () => {
      if (hasOpenModal()) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
        body.style.overflow = 'hidden'
        body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : ''
      } else {
        body.style.overflow = originalOverflow
        body.style.paddingRight = originalPaddingRight
      }
    }

    const observer = new MutationObserver(syncBodyScrollLock)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal', 'role'],
    })

    syncBodyScrollLock()

    return () => {
      observer.disconnect()
      body.style.overflow = originalOverflow
      body.style.paddingRight = originalPaddingRight
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <LocaleSync />
      <Suspense fallback={<SuspenseLoading />}>
        {isOpeningsDomain ? (
          <OpeningsApp components={routeComponents} />
        ) : (
          <ServicesApp components={routeComponents} p={p} e={e} />
        )}
      </Suspense>
      <CookieConsentBanner />
      <WhatsAppFloating />
      {cartToast.message ? (
        <div className="pointer-events-none fixed inset-0 z-[12000] flex items-center justify-center p-4">
          <p
            className={`rounded-xl bg-earth-900/95 px-5 py-3 text-sm font-medium text-white shadow-lg transition-opacity duration-100 sm:text-base ${
              cartToast.visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {cartToast.message}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default App

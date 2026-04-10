import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import WhatsAppFloating from './components/WhatsAppFloating'
import CookieConsentBanner from './components/CookieConsentBanner'
import { LocaleSync } from './components/LocaleSync'
import { recordAffiliateClick } from './services/affiliateService'
import { LOCALE_EN, LOCALE_PT_BR, localizedPath } from './lib/localeRoutes'

const Home = lazy(() => import('./pages/Home'))
const Contact = lazy(() => import('./pages/Contact'))
const OndeComprar = lazy(() => import('./pages/OndeComprar'))
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
const Services = lazy(() => import('./pages/platform/Services'))
const ComprasProgramadas = lazy(() => import('./pages/platform/ComprasProgramadas'))
const Cart = lazy(() => import('./pages/platform/Cart'))
const AdminLayout = lazy(() => import('./pages/platform/admin/AdminLayout'))
const AdminPedidosTab = lazy(() => import('./pages/platform/admin/tabs/PedidosTab'))
const AdminUsuariosTab = lazy(() => import('./pages/platform/admin/tabs/UsuariosTab'))
const AdminEnviosTab = lazy(() => import('./pages/platform/admin/tabs/EnviosTab'))
const AdminProdutosTab = lazy(() => import('./pages/platform/admin/tabs/ProdutosTab'))
const AdminCatalogoProdutosTab = lazy(() => import('./pages/platform/admin/tabs/CatalogoProdutosTab'))
const AdminBuscaCatalogoTab = lazy(() => import('./pages/platform/admin/tabs/BuscaCatalogoTab'))
const AdminGruposTab = lazy(() => import('./pages/platform/admin/tabs/GruposTab'))
const AdminMarketingTab = lazy(() => import('./pages/platform/admin/tabs/MarketingTab'))
const AdminFraudeTab = lazy(() => import('./pages/platform/admin/tabs/FraudeTab'))
const AdminNotificacoesTab = lazy(() => import('./pages/platform/admin/tabs/NotificacoesTab'))
const AdminRecargasTab = lazy(() => import('./pages/platform/admin/tabs/RecargasTab'))
const AdminInvoicesTab = lazy(() => import('./pages/platform/admin/tabs/InvoicesAdminTab'))
const AdminLogsTab = lazy(() => import('./pages/platform/admin/tabs/LogsTab'))
const Lounge = lazy(() => import('./pages/platform/Lounge'))
const Invoices = lazy(() => import('./pages/platform/Invoices'))
const InvoiceDetail = lazy(() => import('./pages/platform/InvoiceDetail'))
const Affiliate = lazy(() => import('./pages/platform/Affiliate'))

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
  useEffect(() => {
    const url = new URL(window.location.href)
    const referralCode = (url.searchParams.get('invite') || url.searchParams.get('referral') || '').trim().toUpperCase()
    if (referralCode) {
      localStorage.setItem('referral_signup_code', referralCode)
    }

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
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<SuspenseLoading />}>
          <Routes>
            {/* pt-BR */}
            <Route path="/" element={<Home />} />
            <Route path="/como-funciona" element={<Navigate to={p('servicosPrecos')} replace />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/loja" element={<Navigate to={p('lojaPublicVitrine')} replace />} />
            <Route path="/loja/vitrine" element={<Loja />} />
            <Route path="/loja/compras-programadas" element={<Navigate to={p('lojaPublicProgramadasOnline')} replace />} />
            <Route path="/loja/compras-programadas/online" element={<ComprasProgramadas publicMode />} />
            <Route path="/loja/compras-programadas/fisica" element={<ComprasProgramadas publicMode />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/app" element={
              <ProtectedRoute>
                <PlatformLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to={p('appDashboard')} replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="complete-social-profile" element={<CompleteSocialProfile />} />
              <Route path="lounge" element={<Lounge />} />
              <Route path="services" element={<Services />} />
              <Route path="orders" element={<Navigate to={p('appLounge')} replace />} />
              <Route path="wallet" element={<Navigate to={p('appLounge')} replace />} />
              <Route path="payments" element={<Navigate to={p('appCart', '?tab=history')} replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="conta" element={<Conta />} />
              <Route path="meus-produtos" element={<Navigate to={p('appLounge')} replace />} />
              <Route path="loja" element={<Loja />} />
              <Route path="cart" element={<Cart />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="invoices/:id" element={<InvoiceDetail />} />
              <Route path="grupo-de-compras" element={<Navigate to={p('appGrupoComprasOnline')} replace />} />
              <Route path="grupo-de-compras/online" element={<ComprasProgramadas />} />
              <Route path="grupo-de-compras/fisica" element={<ComprasProgramadas />} />
              <Route path="affiliate" element={<Affiliate />} />
              <Route path="lista-desejos" element={<Navigate to={p('appLounge', '?tab=desejos')} replace />} />
              <Route path="envios" element={<Navigate to={p('appLounge')} replace />} />
              <Route path="admin" element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }>
                <Route index element={<Navigate to={p('appAdminPedidos')} replace />} />
                <Route path="pedidos" element={<AdminPedidosTab />} />
                <Route path="usuarios" element={<AdminUsuariosTab />} />
                <Route path="envios" element={<AdminEnviosTab />} />
                <Route path="produtos" element={<AdminProdutosTab />} />
                <Route path="catalogo-produtos" element={<AdminCatalogoProdutosTab />} />
                <Route path="busca-catalogo" element={<AdminBuscaCatalogoTab />} />
                <Route path="grupos" element={<AdminGruposTab />} />
                <Route path="marketing" element={<AdminMarketingTab />} />
                <Route path="fraude" element={<AdminFraudeTab />} />
                <Route path="notificacoes" element={<AdminNotificacoesTab />} />
                <Route path="recargas" element={<AdminRecargasTab />} />
                <Route path="invoices" element={<AdminInvoicesTab />} />
                <Route path="logs" element={<AdminLogsTab />} />
              </Route>
            </Route>
            <Route path="/faq" element={<FaqLayout />}>
              <Route index element={<Faq />} />
              <Route path="itens-proibidos" element={<ItensProibidos />} />
              <Route path="taxas-alfandegarias" element={<TaxasAlfandegarias />} />
            </Route>
            <Route path="/onde-comprar" element={<OndeComprar />} />
            <Route path="/legal" element={<LegalLayout />}>
              <Route index element={<Navigate to={p('legalPrivacy')} replace />} />
              <Route path="commercial-disclosure" element={<CommercialDisclosure />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="terms" element={<TermsOfService />} />
            </Route>
            <Route path="/servicos-e-precos" element={<ServicosEPrecosLayout />}>
              <Route index element={<Servicos />} />
              <Route path="fretes-prazos" element={<FretesEPrazos />} />
              <Route path="simulador" element={<Simulador />} />
            </Route>

            {/* English */}
            <Route path="/en" element={<Home />} />
            <Route path="/en/como-funciona" element={<Navigate to={e('servicosPrecos')} replace />} />
            <Route path="/en/contact" element={<Contact />} />
            <Route path="/en/store" element={<Navigate to={e('lojaPublicVitrine')} replace />} />
            <Route path="/en/store/storefront" element={<Loja />} />
            <Route path="/en/store/showcase" element={<Navigate to={e('lojaPublicVitrine')} replace />} />
            <Route path="/en/store/scheduled-buying" element={<Navigate to={e('lojaPublicProgramadasOnline')} replace />} />
            <Route path="/en/store/scheduled-buying/online" element={<ComprasProgramadas publicMode />} />
            <Route path="/en/store/scheduled-buying/physical" element={<ComprasProgramadas publicMode />} />
            <Route path="/en/login" element={<Login />} />
            <Route path="/en/register" element={<Register />} />
            <Route path="/en/forgot-password" element={<ForgotPassword />} />
            <Route path="/en/reset-password" element={<ResetPassword />} />
            <Route path="/en/app" element={
              <ProtectedRoute>
                <PlatformLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to={e('appDashboard')} replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="complete-social-profile" element={<CompleteSocialProfile />} />
              <Route path="lounge" element={<Lounge />} />
              <Route path="services" element={<Services />} />
              <Route path="orders" element={<Navigate to={e('appLounge')} replace />} />
              <Route path="wallet" element={<Navigate to={e('appLounge')} replace />} />
              <Route path="payments" element={<Navigate to={e('appCart', '?tab=history')} replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="account" element={<Conta />} />
              <Route path="my-products" element={<Navigate to={e('appLounge')} replace />} />
              <Route path="store" element={<Loja />} />
              <Route path="cart" element={<Cart />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="invoices/:id" element={<InvoiceDetail />} />
              <Route path="group-buying" element={<Navigate to={e('appGrupoComprasOnline')} replace />} />
              <Route path="group-buying/online" element={<ComprasProgramadas />} />
              <Route path="group-buying/physical" element={<ComprasProgramadas />} />
              <Route path="affiliate" element={<Affiliate />} />
              <Route path="wishlist" element={<Navigate to={e('appLounge', '?tab=desejos')} replace />} />
              <Route path="shipments" element={<Navigate to={e('appLounge')} replace />} />
              <Route path="admin" element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }>
                <Route index element={<Navigate to={e('appAdminPedidos')} replace />} />
                <Route path="orders" element={<AdminPedidosTab />} />
                <Route path="users" element={<AdminUsuariosTab />} />
                <Route path="shipping" element={<AdminEnviosTab />} />
                <Route path="products" element={<AdminProdutosTab />} />
                <Route path="catalog" element={<AdminCatalogoProdutosTab />} />
                <Route path="catalog-search" element={<AdminBuscaCatalogoTab />} />
                <Route path="groups" element={<AdminGruposTab />} />
                <Route path="marketing" element={<AdminMarketingTab />} />
                <Route path="fraud" element={<AdminFraudeTab />} />
                <Route path="notifications" element={<AdminNotificacoesTab />} />
                <Route path="top-ups" element={<AdminRecargasTab />} />
                <Route path="invoices" element={<AdminInvoicesTab />} />
                <Route path="logs" element={<AdminLogsTab />} />
              </Route>
            </Route>
            <Route path="/en/help" element={<FaqLayout />}>
              <Route index element={<Faq />} />
              <Route path="prohibited-items" element={<ItensProibidos />} />
              <Route path="customs-fees" element={<TaxasAlfandegarias />} />
            </Route>
            <Route path="/en/where-to-buy" element={<OndeComprar />} />
            <Route path="/en/legal" element={<LegalLayout />}>
              <Route index element={<Navigate to={e('legalPrivacy')} replace />} />
              <Route path="commercial-disclosure" element={<CommercialDisclosure />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="terms" element={<TermsOfService />} />
            </Route>
            <Route path="/en/services-pricing" element={<ServicosEPrecosLayout />}>
              <Route index element={<Servicos />} />
              <Route path="shipping-times" element={<FretesEPrazos />} />
              <Route path="shipping-calculator" element={<Simulador />} />
            </Route>
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <CookieConsentBanner />
      <WhatsAppFloating />
    </div>
  )
}

export default App

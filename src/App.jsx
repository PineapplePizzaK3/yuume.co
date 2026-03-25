import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import WhatsAppFloating from './components/WhatsAppFloating'
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
const LojaPublicRoute = lazy(() => import('./components/LojaPublicRoute'))
import { AdminRoute } from './components/AdminRoute'
const PlatformLayout = lazy(() => import('./layouts/PlatformLayout').then((m) => ({ default: m.PlatformLayout })))
const Login = lazy(() => import('./pages/platform/Login'))
const Register = lazy(() => import('./pages/platform/Register'))
const ForgotPassword = lazy(() => import('./pages/platform/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/platform/ResetPassword'))
const Dashboard = lazy(() => import('./pages/platform/Dashboard'))
const Services = lazy(() => import('./pages/platform/Services'))
const Payments = lazy(() => import('./pages/platform/Payments'))
const Profile = lazy(() => import('./pages/platform/Profile'))
const Conta = lazy(() => import('./pages/platform/Conta'))
const Loja = lazy(() => import('./pages/platform/Loja'))
const LojaMirror = lazy(() => import('./pages/LojaMirror'))
const Cart = lazy(() => import('./pages/platform/Cart'))
const ListaDesejos = lazy(() => import('./pages/platform/ListaDesejos'))
const GrupoDeCompras = lazy(() => import('./pages/platform/GrupoDeCompras'))
const Admin = lazy(() => import('./pages/platform/Admin'))
const Lounge = lazy(() => import('./pages/platform/Lounge'))

/**
 * Componente principal da aplicação.
 * Define as rotas e o layout (Navbar + conteúdo + Footer).
 */
function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-10 text-earth-600">Carregando...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/como-funciona" element={<Navigate to="/servicos-e-precos" replace />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/loja" element={<LojaPublicRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/app" element={
              <ProtectedRoute>
                <PlatformLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="lounge" element={<Lounge />} />
              <Route path="services" element={<Services />} />
              <Route path="orders" element={<Navigate to="/app/lounge" replace />} />
              <Route path="wallet" element={<Navigate to="/app/lounge" replace />} />
              <Route path="payments" element={<Payments />} />
              <Route path="profile" element={<Profile />} />
              <Route path="conta" element={<Conta />} />
              <Route path="meus-produtos" element={<Navigate to="/app/lounge" replace />} />
              <Route path="loja" element={<Loja />} />
              <Route path="cart" element={<Cart />} />
              <Route path="grupo-de-compras" element={<GrupoDeCompras />} />
              <Route path="lista-desejos" element={<ListaDesejos />} />
              <Route path="envios" element={<Navigate to="/app/lounge" replace />} />
              <Route path="admin" element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              } />
            </Route>
            <Route path="/faq" element={<FaqLayout />}>
              <Route index element={<Faq />} />
              <Route path="itens-proibidos" element={<ItensProibidos />} />
              <Route path="taxas-alfandegarias" element={<TaxasAlfandegarias />} />
            </Route>
            <Route path="/onde-comprar" element={<OndeComprar />} />
            <Route path="/legal" element={<LegalLayout />}>
              <Route index element={<Navigate to="/legal/privacy" replace />} />
              <Route path="commercial-disclosure" element={<CommercialDisclosure />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="terms" element={<TermsOfService />} />
            </Route>
            <Route path="/servicos-e-precos" element={<ServicosEPrecosLayout />}>
              <Route index element={<Servicos />} />
              <Route path="fretes-prazos" element={<FretesEPrazos />} />
              <Route path="simulador" element={<Simulador />} />
            </Route>
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  )
}

export default App

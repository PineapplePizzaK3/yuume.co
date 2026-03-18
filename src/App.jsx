import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import WhatsAppFloating from './components/WhatsAppFloating'
import Home from './pages/Home'
import Contact from './pages/Contact'
import OndeComprar from './pages/OndeComprar'
import ItensProibidos from './pages/como-funciona/ItensProibidos'
import TaxasAlfandegarias from './pages/como-funciona/TaxasAlfandegarias'
import ServicosEPrecosLayout from './pages/servicos-e-precos/ServicosEPrecosLayout'
import Servicos from './pages/servicos-e-precos/Servicos'
import FretesEPrazos from './pages/servicos-e-precos/FretesEPrazos'
import Simulador from './pages/servicos-e-precos/Simulador'
import FaqLayout from './pages/faq/FaqLayout'
import Faq from './pages/Faq'
import LegalLayout from './layouts/LegalLayout'
import CommercialDisclosure from './pages/legal/CommercialDisclosure'
import PrivacyPolicy from './pages/legal/PrivacyPolicy'
import TermsOfService from './pages/legal/TermsOfService'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { PlatformLayout } from './layouts/PlatformLayout'
import Login from './pages/platform/Login'
import Register from './pages/platform/Register'
import ForgotPassword from './pages/platform/ForgotPassword'
import ResetPassword from './pages/platform/ResetPassword'
import Dashboard from './pages/platform/Dashboard'
import Services from './pages/platform/Services'
import Orders from './pages/platform/Orders'
import Wallet from './pages/platform/Wallet'
import Payments from './pages/platform/Payments'
import Profile from './pages/platform/Profile'
import Conta from './pages/platform/Conta'
import Loja from './pages/platform/Loja'
import Cart from './pages/platform/Cart'
import ListaDesejos from './pages/platform/ListaDesejos'
import MeusProdutos from './pages/platform/MeusProdutos'
import GrupoDeCompras from './pages/platform/GrupoDeCompras'
import Envios from './pages/platform/Envios'
import Admin from './pages/platform/Admin'

/**
 * Componente principal da aplicação.
 * Define as rotas e o layout (Navbar + conteúdo + Footer).
 */
function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/como-funciona" element={<Navigate to="/servicos-e-precos" replace />} />
          <Route path="/contact" element={<Contact />} />
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
            <Route path="services" element={<Services />} />
            <Route path="orders" element={<Orders />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="payments" element={<Payments />} />
            <Route path="profile" element={<Profile />} />
            <Route path="conta" element={<Conta />} />
            <Route path="meus-produtos" element={<MeusProdutos />} />
            <Route path="loja" element={<Loja />} />
            <Route path="cart" element={<Cart />} />
            <Route path="grupo-de-compras" element={<GrupoDeCompras />} />
            <Route path="lista-desejos" element={<ListaDesejos />} />
            <Route path="envios" element={<Envios />} />
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
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  )
}

export default App

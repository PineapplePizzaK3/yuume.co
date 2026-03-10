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
import UnderConstruction from './pages/UnderConstruction'

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
          <Route path="/login" element={<UnderConstruction />} />
          <Route path="/faq" element={<FaqLayout />}>
            <Route index element={<Faq />} />
            <Route path="itens-proibidos" element={<ItensProibidos />} />
            <Route path="taxas-alfandegarias" element={<TaxasAlfandegarias />} />
          </Route>
          <Route path="/onde-comprar" element={<OndeComprar />} />
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

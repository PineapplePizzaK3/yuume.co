import { Navigate, Route } from 'react-router-dom'

export function ServicesRoutes({ components, p, e }) {
  const {
    Home,
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
  } = components

  return (
    <>
      <Route path="/redirecionamento" element={<Home />} />
      <Route path="/como-funciona" element={<Navigate to={p('servicosPrecos')} replace />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/loja" element={<Navigate to={p('lojaPublicVitrine')} replace />} />
      <Route path="/loja/vitrine" element={<Loja publicMode />} />
      <Route path="/loja/vitrine/grupo/:groupId" element={<GrupoDeCompraPagina publicMode />} />
      <Route path="/loja/vitrine/produto/:productId" element={<StoreProductDetail publicMode />} />
      <Route path="/loja/compras-programadas" element={<Navigate to={p('lojaPublicVitrine')} replace />} />
      <Route path="/loja/compras-programadas/online" element={<Navigate to={p('lojaPublicVitrine')} replace />} />
      <Route path="/loja/compras-programadas/fisica" element={<Navigate to={p('lojaPublicVitrine')} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <PlatformLayout />
          </ProtectedRoute>
        }
      >
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
        <Route path="loja/grupo/:groupId" element={<GrupoDeCompraPagina />} />
        <Route path="loja/produto/:productId" element={<StoreProductDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="grupo-de-compras" element={<Navigate to={p('appLoja')} replace />} />
        <Route path="grupo-de-compras/online" element={<Navigate to={p('appLoja')} replace />} />
        <Route path="grupo-de-compras/fisica" element={<Navigate to={p('appLoja')} replace />} />
        <Route path="affiliate" element={<Affiliate />} />
        <Route path="lista-desejos" element={<Navigate to={p('appLounge', '?tab=desejos')} replace />} />
        <Route path="envios" element={<Navigate to={p('appLounge')} replace />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to={p('appAdminPedidos')} replace />} />
          <Route path="pedidos" element={<AdminPedidosTab />} />
          <Route path="orcamentos" element={<AdminOrcamentosTab />} />
          <Route path="usuarios" element={<AdminUsuariosTab />} />
          <Route path="envios" element={<AdminEnviosTab />} />
          <Route path="produtos-usuarios" element={<AdminProdutosUsuariosTab />} />
          <Route path="aberturas" element={<AdminAberturasTab />} />
          <Route path="produtos" element={<AdminProdutosTab />} />
          <Route path="catalogo-produtos" element={<AdminCatalogoProdutosTab />} />
          <Route path="grupos" element={<AdminGruposTab />} />
          <Route path="calculadora-brasil" element={<AdminCalculadoraBrasilTab />} />
          <Route path="lotes" element={<AdminLotesTab />} />
          <Route path="marketing" element={<AdminMarketingTab />} />
          <Route path="emails" element={<AdminEmailsTab />} />
          <Route path="fraude" element={<AdminFraudeTab />} />
          <Route path="notificacoes" element={<AdminNotificacoesTab />} />
          <Route path="recargas" element={<AdminRecargasTab />} />
          <Route path="invoices" element={<AdminInvoicesTab />} />
          <Route path="controle-financeiro" element={<AdminControleFinanceiroTab />} />
          <Route path="logs" element={<AdminLogsTab />} />
          <Route path="fontes-mercado" element={<AdminMarketSourcesTab />} />
          <Route path="sets-catalogo" element={<AdminCatalogSetsTab />} />
          <Route path="catalogo/sets-catalogo" element={<AdminCatalogSetsTab />} />
          <Route path="operacao/pedidos" element={<AdminPedidosTab />} />
          <Route path="operacao/usuarios" element={<AdminUsuariosTab />} />
          <Route path="operacao/envios" element={<AdminEnviosTab />} />
          <Route path="operacao/produtos-usuarios" element={<AdminProdutosUsuariosTab />} />
          <Route path="operacao/aberturas" element={<AdminAberturasTab />} />
          <Route path="catalogo/produtos" element={<AdminProdutosTab />} />
          <Route path="catalogo/catalogo-produtos" element={<AdminCatalogoProdutosTab />} />
          <Route path="catalogo/orcamentos" element={<AdminOrcamentosTab />} />
          <Route path="catalogo/grupos" element={<AdminGruposTab />} />
          <Route path="catalogo/calculadora-brasil" element={<AdminCalculadoraBrasilTab />} />
          <Route path="catalogo/lotes" element={<AdminLotesTab />} />
          <Route path="growth/marketing" element={<AdminMarketingTab />} />
          <Route path="growth/emails" element={<AdminEmailsTab />} />
          <Route path="growth/fraude" element={<AdminFraudeTab />} />
          <Route path="growth/notificacoes" element={<AdminNotificacoesTab />} />
          <Route path="financeiro/recargas" element={<AdminRecargasTab />} />
          <Route path="financeiro/invoices" element={<AdminInvoicesTab />} />
          <Route path="financeiro/controle-financeiro" element={<AdminControleFinanceiroTab />} />
          <Route path="sistema/logs" element={<AdminLogsTab />} />
          <Route path="sistema/fontes-mercado" element={<AdminMarketSourcesTab />} />
        </Route>
      </Route>
      <Route path="/faq" element={<FaqLayout />}>
        <Route index element={<Faq />} />
        <Route path="itens-proibidos" element={<ItensProibidos />} />
        <Route path="taxas-alfandegarias" element={<TaxasAlfandegarias />} />
      </Route>
      <Route path="/live-rips/overlay" element={<LiveRipOverlayPage />} />
      <Route path="/live-rips" element={<LiveRipsLayout />}>
        <Route index element={<LiveRipsPage />} />
        <Route path="rip/:productId" element={<LiveRipDetailPage />} />
        <Route path="minha-rip" element={<MyRipPage />} />
        <Route path="live" element={<LiveRipBroadcastPage />} />
      </Route>
      <Route path="/onde-comprar" element={<OndeComprar />} />
      <Route path="/busca-catalogo" element={<CatalogSearchPublic />} />
      <Route path="/produto-temporario/abrir" element={<EphemeralProductOpen />} />
      <Route path="/produto-temporario/:token" element={<EphemeralProductDetail />} />
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

      <Route path="/en/forwarding" element={<Home />} />
      <Route path="/en/como-funciona" element={<Navigate to={e('servicosPrecos')} replace />} />
      <Route path="/en/contact" element={<Contact />} />
      <Route path="/en/store" element={<Navigate to={e('lojaPublicVitrine')} replace />} />
      <Route path="/en/store/storefront" element={<Loja publicMode />} />
      <Route path="/en/store/storefront/group/:groupId" element={<GrupoDeCompraPagina publicMode />} />
      <Route path="/en/store/storefront/product/:productId" element={<StoreProductDetail publicMode />} />
      <Route path="/en/store/showcase" element={<Navigate to={e('lojaPublicVitrine')} replace />} />
      <Route path="/en/store/scheduled-buying" element={<Navigate to={e('lojaPublicVitrine')} replace />} />
      <Route path="/en/store/scheduled-buying/online" element={<Navigate to={e('lojaPublicVitrine')} replace />} />
      <Route path="/en/store/scheduled-buying/physical" element={<Navigate to={e('lojaPublicVitrine')} replace />} />
      <Route path="/en/login" element={<Login />} />
      <Route path="/en/register" element={<Register />} />
      <Route path="/en/forgot-password" element={<ForgotPassword />} />
      <Route path="/en/reset-password" element={<ResetPassword />} />
      <Route
        path="/en/app"
        element={
          <ProtectedRoute>
            <PlatformLayout />
          </ProtectedRoute>
        }
      >
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
        <Route path="store/group/:groupId" element={<GrupoDeCompraPagina />} />
        <Route path="store/product/:productId" element={<StoreProductDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="group-buying" element={<Navigate to={e('appLoja')} replace />} />
        <Route path="group-buying/online" element={<Navigate to={e('appLoja')} replace />} />
        <Route path="group-buying/physical" element={<Navigate to={e('appLoja')} replace />} />
        <Route path="affiliate" element={<Affiliate />} />
        <Route path="wishlist" element={<Navigate to={e('appLounge', '?tab=desejos')} replace />} />
        <Route path="shipments" element={<Navigate to={e('appLounge')} replace />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to={e('appAdminPedidos')} replace />} />
          <Route path="orders" element={<AdminPedidosTab />} />
          <Route path="quotes" element={<AdminOrcamentosTab />} />
          <Route path="users" element={<AdminUsuariosTab />} />
          <Route path="shipping" element={<AdminEnviosTab />} />
          <Route path="user-products" element={<AdminProdutosUsuariosTab />} />
          <Route path="openings" element={<AdminAberturasTab />} />
          <Route path="products" element={<AdminProdutosTab />} />
          <Route path="catalog" element={<AdminCatalogoProdutosTab />} />
          <Route path="groups" element={<AdminGruposTab />} />
          <Route path="brazil-calculator" element={<AdminCalculadoraBrasilTab />} />
          <Route path="batches" element={<AdminLotesTab />} />
          <Route path="marketing" element={<AdminMarketingTab />} />
          <Route path="emails" element={<AdminEmailsTab />} />
          <Route path="fraud" element={<AdminFraudeTab />} />
          <Route path="notifications" element={<AdminNotificacoesTab />} />
          <Route path="top-ups" element={<AdminRecargasTab />} />
          <Route path="invoices" element={<AdminInvoicesTab />} />
          <Route path="financial-control" element={<AdminControleFinanceiroTab />} />
          <Route path="logs" element={<AdminLogsTab />} />
          <Route path="market-sources" element={<AdminMarketSourcesTab />} />
          <Route path="catalog-sets" element={<AdminCatalogSetsTab />} />
          <Route path="catalog/catalog-sets" element={<AdminCatalogSetsTab />} />
          <Route path="operations/orders" element={<AdminPedidosTab />} />
          <Route path="operations/users" element={<AdminUsuariosTab />} />
          <Route path="operations/shipping" element={<AdminEnviosTab />} />
          <Route path="operations/user-products" element={<AdminProdutosUsuariosTab />} />
          <Route path="operations/openings" element={<AdminAberturasTab />} />
          <Route path="catalog/products" element={<AdminProdutosTab />} />
          <Route path="catalog/catalog" element={<AdminCatalogoProdutosTab />} />
          <Route path="catalog/quotes" element={<AdminOrcamentosTab />} />
          <Route path="catalog/groups" element={<AdminGruposTab />} />
          <Route path="catalog/brazil-calculator" element={<AdminCalculadoraBrasilTab />} />
          <Route path="catalog/batches" element={<AdminLotesTab />} />
          <Route path="growth/marketing" element={<AdminMarketingTab />} />
          <Route path="growth/emails" element={<AdminEmailsTab />} />
          <Route path="growth/fraud" element={<AdminFraudeTab />} />
          <Route path="growth/notifications" element={<AdminNotificacoesTab />} />
          <Route path="finance/top-ups" element={<AdminRecargasTab />} />
          <Route path="finance/invoices" element={<AdminInvoicesTab />} />
          <Route path="finance/financial-control" element={<AdminControleFinanceiroTab />} />
          <Route path="system/logs" element={<AdminLogsTab />} />
          <Route path="system/market-sources" element={<AdminMarketSourcesTab />} />
        </Route>
      </Route>
      <Route path="/en/help" element={<FaqLayout />}>
        <Route index element={<Faq />} />
        <Route path="prohibited-items" element={<ItensProibidos />} />
        <Route path="customs-fees" element={<TaxasAlfandegarias />} />
      </Route>
      <Route path="/en/live-rips/overlay" element={<LiveRipOverlayPage />} />
      <Route path="/en/live-rips" element={<LiveRipsLayout />}>
        <Route index element={<LiveRipsPage />} />
        <Route path="rip/:productId" element={<LiveRipDetailPage />} />
        <Route path="my-rip" element={<MyRipPage />} />
        <Route path="live" element={<LiveRipBroadcastPage />} />
      </Route>
      <Route path="/en/where-to-buy" element={<OndeComprar />} />
      <Route path="/en/catalog-search" element={<CatalogSearchPublic />} />
      <Route path="/en/instant-product/open" element={<EphemeralProductOpen />} />
      <Route path="/en/instant-product/:token" element={<EphemeralProductDetail />} />
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
    </>
  )
}


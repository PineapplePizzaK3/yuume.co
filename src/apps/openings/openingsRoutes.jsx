import { Navigate, Route, useParams } from 'react-router-dom'
import { LocaleAliasRedirect } from '../../components/AliasRedirects'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { collectorBatchDetailPath, collectorOpeningDetailPath } from '../../lib/localeRoutes'

function LegacyBatchRedirect() {
  const { batchId, ripId } = useParams()
  const locale = useSiteLocale()
  return <Navigate to={collectorBatchDetailPath(batchId || ripId, locale)} replace />
}

function LegacySessionRedirect() {
  const { liveId, openingId } = useParams()
  const locale = useSiteLocale()
  return <Navigate to={collectorOpeningDetailPath(liveId || openingId, locale)} replace />
}

export function OpeningsRoutes({ components }) {
  const {
    EcosystemHome,
    OpeningsHub,
    RipsPage,
    RipDetailPage,
    BoxBreakPurchaseThanks,
    LivesPage,
    LivePage,
    CollectionPage,
    MyRipRecordPage,
    CardAssetPage,
    CatalogItemPage,
    ExplorePage,
    SetPage,
    JapanSearchPage,
    WishlistPage,
  } = components

  return (
    <>
      <Route path="/" element={<EcosystemHome />} />
      <Route path="/box-break/explorar" element={<RipsPage />} />
      <Route path="/box-break/sessoes/:sessionId" element={<LivePage />} />
      <Route path="/box-break/sessoes" element={<LivesPage />} />
      <Route path="/box-break/obrigado/:ripId" element={<BoxBreakPurchaseThanks />} />
      <Route path="/box-break/:batchId" element={<RipDetailPage />} />
      <Route path="/box-break" element={<OpeningsHub />} />
      <Route path="/colecionador" element={<LocaleAliasRedirect toRoute="minhaYuume" />} />
      <Route path="/rips/:ripId" element={<LegacyBatchRedirect />} />
      <Route path="/rips" element={<LocaleAliasRedirect toRoute="collectorBatchCatalog" />} />
      <Route path="/batches/explorar" element={<LocaleAliasRedirect toRoute="collectorBatchCatalog" />} />
      <Route path="/batches/:batchId" element={<LegacyBatchRedirect />} />
      <Route path="/batches" element={<LocaleAliasRedirect toRoute="collectorBatches" />} />
      <Route path="/lives/:liveId" element={<LegacySessionRedirect />} />
      <Route path="/lives" element={<LocaleAliasRedirect toRoute="collectorOpenings" />} />
      <Route path="/openings/:openingId" element={<LegacySessionRedirect />} />
      <Route path="/openings" element={<LocaleAliasRedirect toRoute="collectorOpenings" />} />
      <Route path="/colecao" element={<CollectionPage />} />
      <Route path="/colecao/rips/:ripId" element={<MyRipRecordPage />} />
      <Route path="/colecao/batches/:ripId" element={<MyRipRecordPage />} />
      <Route path="/colecao/cartas/:assetId" element={<CardAssetPage />} />
      <Route path="/item/:itemId" element={<CatalogItemPage />} />
      <Route path="/explorar" element={<ExplorePage />} />
      <Route path="/explorar/sets/:setId" element={<SetPage />} />
      <Route path="/japan-search" element={<JapanSearchPage />} />
      <Route path="/wishlist" element={<WishlistPage />} />
      <Route path="/aberturas" element={<LocaleAliasRedirect toRoute="collectorBatches" />} />
      <Route path="/aberturas/explorar" element={<LocaleAliasRedirect toRoute="collectorBatchCatalog" />} />
      <Route path="/minha-yuume/colecao" element={<LocaleAliasRedirect toRoute="collectorCollection" />} />
      <Route path="/minha-yuume/wishlist" element={<LocaleAliasRedirect toRoute="collectorWishlist" />} />

      <Route path="/en" element={<EcosystemHome />} />
      <Route path="/en/box-break/explore" element={<RipsPage />} />
      <Route path="/en/box-break/sessions/:sessionId" element={<LivePage />} />
      <Route path="/en/box-break/sessions" element={<LivesPage />} />
      <Route path="/en/box-break/thanks/:ripId" element={<BoxBreakPurchaseThanks />} />
      <Route path="/en/box-break/:batchId" element={<RipDetailPage />} />
      <Route path="/en/box-break" element={<OpeningsHub />} />
      <Route path="/en/collector" element={<LocaleAliasRedirect toRoute="minhaYuume" />} />
      <Route path="/en/rips/:ripId" element={<LegacyBatchRedirect />} />
      <Route path="/en/rips" element={<LocaleAliasRedirect toRoute="collectorBatchCatalog" />} />
      <Route path="/en/batches/explore" element={<LocaleAliasRedirect toRoute="collectorBatchCatalog" />} />
      <Route path="/en/batches/:batchId" element={<LegacyBatchRedirect />} />
      <Route path="/en/batches" element={<LocaleAliasRedirect toRoute="collectorBatches" />} />
      <Route path="/en/lives/:liveId" element={<LegacySessionRedirect />} />
      <Route path="/en/lives" element={<LocaleAliasRedirect toRoute="collectorOpenings" />} />
      <Route path="/en/openings/:openingId" element={<LegacySessionRedirect />} />
      <Route path="/en/openings" element={<LocaleAliasRedirect toRoute="collectorOpenings" />} />
      <Route path="/en/collection" element={<CollectionPage />} />
      <Route path="/en/collection/rips/:ripId" element={<MyRipRecordPage />} />
      <Route path="/en/collection/batches/:ripId" element={<MyRipRecordPage />} />
      <Route path="/en/collection/cards/:assetId" element={<CardAssetPage />} />
      <Route path="/en/item/:itemId" element={<CatalogItemPage />} />
      <Route path="/en/explore" element={<ExplorePage />} />
      <Route path="/en/explore/sets/:setId" element={<SetPage />} />
      <Route path="/en/japan-search" element={<JapanSearchPage />} />
      <Route path="/en/wishlist" element={<WishlistPage />} />
      <Route path="/en/aberturas" element={<LocaleAliasRedirect toRoute="collectorBatches" />} />
      <Route path="/en/aberturas/explorar" element={<LocaleAliasRedirect toRoute="collectorBatchCatalog" />} />
      <Route path="/en/minha-yuume/colecao" element={<LocaleAliasRedirect toRoute="collectorCollection" />} />
      <Route path="/en/minha-yuume/wishlist" element={<LocaleAliasRedirect toRoute="collectorWishlist" />} />
    </>
  )
}


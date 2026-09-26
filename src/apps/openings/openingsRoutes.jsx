import { Route } from 'react-router-dom'

export function OpeningsRoutes({ components }) {
  const {
    CollectorHome,
    RipsPage,
    RipDetailPage,
    LivesPage,
    LivePage,
    CollectionPage,
    MyRipRecordPage,
    CardAssetPage,
    CatalogItemPage,
    JapanSearchPage,
  } = components

  return (
    <>
      <Route path="/" element={<CollectorHome />} />
      <Route path="/rips" element={<RipsPage />} />
      <Route path="/rips/:ripId" element={<RipDetailPage />} />
      <Route path="/batches" element={<RipsPage />} />
      <Route path="/batches/:batchId" element={<RipDetailPage />} />
      <Route path="/lives" element={<LivesPage />} />
      <Route path="/lives/:liveId" element={<LivePage />} />
      <Route path="/openings" element={<LivesPage />} />
      <Route path="/openings/:openingId" element={<LivePage />} />
      <Route path="/colecao" element={<CollectionPage />} />
      <Route path="/colecao/rips/:ripId" element={<MyRipRecordPage />} />
      <Route path="/colecao/batches/:ripId" element={<MyRipRecordPage />} />
      <Route path="/colecao/cartas/:assetId" element={<CardAssetPage />} />
      <Route path="/item/:itemId" element={<CatalogItemPage />} />
      <Route path="/japan-search" element={<JapanSearchPage />} />

      <Route path="/en" element={<CollectorHome />} />
      <Route path="/en/rips" element={<RipsPage />} />
      <Route path="/en/rips/:ripId" element={<RipDetailPage />} />
      <Route path="/en/batches" element={<RipsPage />} />
      <Route path="/en/batches/:batchId" element={<RipDetailPage />} />
      <Route path="/en/lives" element={<LivesPage />} />
      <Route path="/en/lives/:liveId" element={<LivePage />} />
      <Route path="/en/openings" element={<LivesPage />} />
      <Route path="/en/openings/:openingId" element={<LivePage />} />
      <Route path="/en/collection" element={<CollectionPage />} />
      <Route path="/en/collection/rips/:ripId" element={<MyRipRecordPage />} />
      <Route path="/en/collection/batches/:ripId" element={<MyRipRecordPage />} />
      <Route path="/en/collection/cards/:assetId" element={<CardAssetPage />} />
      <Route path="/en/item/:itemId" element={<CatalogItemPage />} />
      <Route path="/en/japan-search" element={<JapanSearchPage />} />
    </>
  )
}


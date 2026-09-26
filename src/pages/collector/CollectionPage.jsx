import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { PageSeo } from '../../components/PageSeo'
import { CardAssetTile } from '../../components/collector/CardAssetTile'
import { listCollectionAssets, listMyRipRecords, listWishlistCards } from '../../services/collectorService'
import { collectorCardAssetPath, collectorCollectionRipPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'

const TAB_ASSETS = 'cards'
const TAB_RIPS = 'rips'
const TAB_WISHLIST = 'wishlist'
const VALID_TABS = new Set([TAB_ASSETS, TAB_RIPS, TAB_WISHLIST])

function CollectionPage() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const [searchParams, setSearchParams] = useSearchParams()
  const [assets, setAssets] = useState([])
  const [rips, setRips] = useState([])
  const [wishlist, setWishlist] = useState([])
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'

  const activeTab = VALID_TABS.has(searchParams.get('tab') || '') ? searchParams.get('tab') : TAB_ASSETS

  useEffect(() => {
    let active = true
    void Promise.all([listCollectionAssets(), listMyRipRecords(), listWishlistCards()]).then(([assetRes, ripRes, wishRes]) => {
      if (!active) return
      setAssets(Array.isArray(assetRes?.data) ? assetRes.data : [])
      setRips(Array.isArray(ripRes?.data) ? ripRes.data : [])
      setWishlist(Array.isArray(wishRes?.data) ? wishRes.data : [])
    })
    return () => {
      active = false
    }
  }, [])

  const setTab = (tab) => setSearchParams(tab === TAB_ASSETS ? {} : { tab })

  return (
    <>
      <PageSeo routeKey="collectorCollection" title={t('collector.meta.collectionTitle', { defaultValue: 'Colecao | Collector MVP' })} noindex />
      <section className="px-4 pb-10 pt-24">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-3xl font-semibold text-earth-900">
            {t('collector.collection.title', { defaultValue: 'Minha colecao' })}
          </h1>
          <p className="mt-2 text-earth-600">
            {t('collector.collection.description', {
              defaultValue: 'Acompanhe seus cards, seu historico de rips e os cards que voce quer encontrar.',
            })}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab(TAB_ASSETS)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${activeTab === TAB_ASSETS ? 'bg-earth-900 text-earth-50' : 'bg-white text-earth-700 border border-earth-300'}`}
            >
              {t('collector.collection.tabs.cards', { defaultValue: 'Cartas' })}
            </button>
            <button
              type="button"
              onClick={() => setTab(TAB_RIPS)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${activeTab === TAB_RIPS ? 'bg-earth-900 text-earth-50' : 'bg-white text-earth-700 border border-earth-300'}`}
            >
              {t('collector.collection.tabs.batches', { defaultValue: 'Aberturas' })}
            </button>
            <button
              type="button"
              onClick={() => setTab(TAB_WISHLIST)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${activeTab === TAB_WISHLIST ? 'bg-earth-900 text-earth-50' : 'bg-white text-earth-700 border border-earth-300'}`}
            >
              {t('collector.collection.tabs.wishlist', { defaultValue: 'Wishlist' })}
            </button>
          </div>
        </div>
      </section>
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          {activeTab === TAB_ASSETS ? (
            assets.length ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {assets.map((asset) => (
                  <CardAssetTile key={asset.id} asset={asset} to={collectorCardAssetPath(asset.id, locale)} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-earth-200 bg-earth-50 p-4 text-sm text-earth-600">
                {t('collector.empty.cards', { defaultValue: 'Nenhum card asset por enquanto.' })}
              </p>
            )
          ) : null}

          {activeTab === TAB_RIPS ? (
            rips.length ? (
              <div className="space-y-3">
                {rips.map((rip) => (
                  <Link
                    key={rip.id}
                    to={collectorCollectionRipPath(rip.id, locale)}
                    className="block rounded-xl border border-earth-200 bg-white p-4 shadow-sm transition hover:border-earth-300"
                  >
                    <p className="font-semibold text-earth-900">{rip.product?.name?.[localeKey] || rip.product?.id}</p>
                    <p className="text-sm text-earth-600">
                      {rip.code} • {rip.packsOpened}/{rip.packsPlanned}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-earth-200 bg-earth-50 p-4 text-sm text-earth-600">
                {t('collector.empty.batches', { defaultValue: 'Reserve uma abertura para ver seus registros aqui.' })}
              </p>
            )
          ) : null}

          {activeTab === TAB_WISHLIST ? (
            wishlist.length ? (
              <ul className="space-y-2">
                {wishlist.map((item) => (
                  <li key={item.id} className="rounded-lg border border-earth-200 bg-white px-4 py-3 text-sm text-earth-700">
                    <span className="font-medium text-earth-900">{item.card?.name?.[localeKey] || item.card?.id}</span> •{' '}
                    {item.card?.set} • {item.card?.rarity}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-earth-200 bg-earth-50 p-4 text-sm text-earth-600">
                {t('collector.empty.wishlist', { defaultValue: 'Sua wishlist ainda esta vazia.' })}
              </p>
            )
          ) : null}
        </div>
      </section>
    </>
  )
}

export default CollectionPage

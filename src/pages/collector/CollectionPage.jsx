import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { PageSeo } from '../../components/PageSeo'
import { CardAssetTile } from '../../components/collector/CardAssetTile'
import { isCollectorMockMode, listCollectionAssets, listMyRipRecords, listWishlistCards } from '../../services/collectorService'
import { listOwnedCollectionItems } from '../../services/collectionService'
import { catalogItemPath, collectorCardAssetPath, collectorCollectionRipPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { VisualEmptyState } from '../../components/VisualEmptyState'
import { MinhaYuumeTabs } from '../../components/platform/MinhaYuumeTabs'
import { IconBookmark, IconCards, IconHeart, IconLayers } from '../../components/home/HomeSectionIcons'
import { BoxBreakSetSummary } from '../../components/collector/BoxBreakSetSummary'
import { resolveLiveParticipationStatus } from '../../lib/liveRipParticipation'

const TAB_SETS = 'sets'
const TAB_ASSETS = 'cards'
const TAB_RIPS = 'rips'
const TAB_WISHLIST = 'wishlist'
const VALID_TABS = new Set([TAB_SETS, TAB_ASSETS, TAB_RIPS, TAB_WISHLIST])

function CollectionPage() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const path = useLocalizedPath()
  const locale = useSiteLocale()
  const [searchParams, setSearchParams] = useSearchParams()
  const [ownedItems, setOwnedItems] = useState([])
  const [ownedError, setOwnedError] = useState('')
  const [assets, setAssets] = useState([])
  const [rips, setRips] = useState([])
  const [wishlist, setWishlist] = useState([])
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const isMockMode = isCollectorMockMode()

  const activeTab = VALID_TABS.has(searchParams.get('tab') || '') ? searchParams.get('tab') : TAB_ASSETS

  useEffect(() => {
    let active = true
    const load = () => {
      void Promise.all([listCollectionAssets(), listMyRipRecords(), listWishlistCards()]).then(([assetRes, ripRes, wishRes]) => {
        if (!active) return
        setAssets(Array.isArray(assetRes?.data) ? assetRes.data : [])
        setRips(Array.isArray(ripRes?.data) ? ripRes.data : [])
        setWishlist(Array.isArray(wishRes?.data) ? wishRes.data : [])
      })
    }
    load()
    window.addEventListener('collector-demo-reset', load)
    return () => {
      active = false
      window.removeEventListener('collector-demo-reset', load)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || isMockMode) {
      setOwnedItems([])
      setOwnedError('')
      return
    }
    let active = true
    void listOwnedCollectionItems().then((res) => {
      if (!active) return
      setOwnedItems(Array.isArray(res?.data) ? res.data : [])
      setOwnedError(res?.error?.message || '')
    })
    return () => {
      active = false
    }
  }, [isAuthenticated, isMockMode])

  const setTab = (tab) => setSearchParams(tab === TAB_ASSETS ? {} : { tab })

  if (!isMockMode && !isAuthenticated) {
    return (
      <section className="mx-auto mt-24 max-w-3xl rounded-2xl border border-earth-200 bg-white p-6 text-earth-700 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-earth-900">
          {t('collector.collection.loginRequiredTitle', { defaultValue: 'Entre para ver sua colecao' })}
        </h1>
        <p className="mt-2 text-sm text-earth-600">
          {t('collector.collection.loginRequiredBody', { defaultValue: 'Sua colecao e seus registros de Box Break ficam disponiveis apos o login.' })}
        </p>
        <Link
          to={path('login')}
          state={{ from: location }}
          className="mt-4 inline-flex rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
        >
          {t('collector.actions.loginToContinue', { defaultValue: 'Entrar para continuar' })}
        </Link>
      </section>
    )
  }

  return (
    <>
      <PageSeo routeKey="collectorCollection" title={t('collector.meta.collectionTitle', { defaultValue: 'Colecao | Collector MVP' })} noindex={isMockMode} />
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
          {isAuthenticated ? <MinhaYuumeTabs active="colecao" /> : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab(TAB_SETS)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${activeTab === TAB_SETS ? 'bg-earth-900 text-earth-50' : 'bg-white text-earth-700 border border-earth-300'}`}
            >
              {t('collector.collection.tabs.sets', { defaultValue: 'Sets / Cartas' })}
            </button>
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
                  {t('collector.collection.tabs.batches', { defaultValue: 'Meus Box Breaks' })}
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
          {activeTab === TAB_SETS ? (
            ownedError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{ownedError}</p>
            ) : ownedItems.length ? (
              <ul className="space-y-2">
                {ownedItems.map((row) => {
                  const card = row.catalog_item
                  const label =
                    (localeKey === 'en' ? card?.name_en || card?.name_ja : card?.name_ja || card?.name_en) ||
                    row.custom_snapshot?.name ||
                    card?.number ||
                    row.id
                  const meta = [
                    card?.set?.set_code,
                    card?.number ? `#${card.number}` : null,
                    card?.rarity,
                    row.quantity > 1 ? `×${row.quantity}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  const to = card?.id ? catalogItemPath(card.id, locale) : null
                  const inner = (
                    <>
                      <span className="font-medium text-earth-900">{label}</span>
                      {meta ? <span className="text-earth-600"> · {meta}</span> : null}
                    </>
                  )
                  return (
                    <li key={row.id} className="rounded-lg border border-earth-200 bg-white px-4 py-3 text-sm text-earth-700">
                      {to ? (
                        <Link to={to} className="hover:text-earth-900">
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <VisualEmptyState
                className=""
                image="/home/tcg-2-packs.png"
                icon={IconLayers}
                title={t('collector.empty.sets', {
                  defaultValue: 'Nenhum item de set marcado ainda.',
                })}
                hint={t('collector.empty.setsHint', {
                  defaultValue: 'Abra um item do catálogo e toque em “Tenho este item”.',
                })}
                toRoute="collectorExplore"
                cta={t('collector.actions.exploreSets', { defaultValue: 'Explorar sets' })}
              />
            )
          ) : null}

          {activeTab === TAB_ASSETS ? (
            assets.length ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {assets.map((asset) => (
                  <CardAssetTile key={asset.id} asset={asset} to={collectorCardAssetPath(asset.id, locale)} />
                ))}
              </div>
            ) : (
              <VisualEmptyState
                className=""
                image="/home/tcg-1-japanese-booster-boxes-WLC.png"
                icon={IconCards}
                title={t('collector.empty.cards', { defaultValue: 'Nenhuma carta do Box Break por enquanto.' })}
                hint={t('collector.empty.cardsHint', {
                  defaultValue: 'As cartas aparecem aqui depois de um Box Break.',
                })}
                toRoute="collectorBatches"
                cta={t('nav.batches', { defaultValue: 'Box Break' })}
              />
            )
          ) : null}

          {activeTab === TAB_RIPS ? (
            rips.length ? (
              <div className="space-y-3">
                {rips.map((rip) => {
                  const participationStatus = resolveLiveParticipationStatus(rip)
                  return (
                  <Link
                    key={rip.id}
                    to={collectorCollectionRipPath(rip.id, locale)}
                    className="block rounded-xl border border-earth-200 bg-white p-4 shadow-sm transition hover:border-earth-300"
                  >
                    <BoxBreakSetSummary
                      compact
                      showDescription={false}
                      product={rip.product}
                      packs={rip.batch?.totalPacks || rip.product?.packsPerBox}
                      localeKey={localeKey}
                      title={rip.product?.name?.[localeKey] || rip.product?.id}
                    />
                    <p className="mt-3 text-sm text-earth-600">
                      {rip.code}{' '}
                      •{' '}
                      {rip.packsOpened > 0
                        ? `${rip.packsOpened}/${rip.packsPlanned}`
                        : t('collector.ripDetail.reservedPacks', {
                            defaultValue: '{{count}} pack(s) reservados',
                            count: rip.packsPlanned,
                          })}
                    </p>
                    <p className="mt-1 text-xs font-medium text-collector-700">
                      {t(`collector.participation.status.${participationStatus}`, {
                        defaultValue: participationStatus,
                      })}
                    </p>
                  </Link>
                  )
                })}
              </div>
            ) : (
              <VisualEmptyState
                className=""
                image={`${import.meta.env.BASE_URL}collector/openings-hero.png`}
                icon={IconHeart}
                title={t('collector.empty.batches', { defaultValue: 'Reserve um Box Break para ver seus registros aqui.' })}
                hint={t('collector.empty.batchesHint', {
                  defaultValue: 'Escolha uma caixa e acompanhe o resultado na sua coleção.',
                })}
                toRoute="collectorBatchCatalog"
                cta={t('collector.actions.exploreBatches', { defaultValue: 'Explorar Box Breaks' })}
              />
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
              <VisualEmptyState
                className=""
                image="/home/anime-1-figures.png"
                icon={IconBookmark}
                title={t('collector.empty.wishlist', { defaultValue: 'Sua wishlist ainda está vazia.' })}
                hint={t('collector.empty.wishlistHint', {
                  defaultValue: 'Abra um item do catálogo e toque em “Quero este”.',
                })}
                toRoute="collectorExplore"
                cta={t('collector.actions.exploreSets', { defaultValue: 'Explorar sets' })}
              />
            )
          ) : null}
        </div>
      </section>
    </>
  )
}

export default CollectionPage

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CardAssetTile } from '../collector/CardAssetTile'
import { VisualEmptyState } from '../VisualEmptyState'
import { IconCards, IconHeart } from '../home/HomeSectionIcons'
import { LocalizedLink } from '../LocalizedLink'
import { collectorCardAssetPath, collectorCollectionRipPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { listCollectionAssets, listMyRipRecords } from '../../services/collectorService'
import { BoxBreakSetSummary } from '../collector/BoxBreakSetSummary'
import { resolveLiveParticipationStatus } from '../../lib/liveRipParticipation'

export function MyBoxBreaksPanel() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const [rips, setRips] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void Promise.all([listMyRipRecords(), listCollectionAssets()]).then(([ripRes, assetRes]) => {
      if (!active) return
      setRips(Array.isArray(ripRes?.data) ? ripRes.data : [])
      setAssets(Array.isArray(assetRes?.data) ? assetRes.data : [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const allocationIds = new Set(rips.map((rip) => rip.id))
  const relatedAssets = assets.filter((asset) => allocationIds.has(asset.origin?.allocationId))

  if (loading) {
    return <p className="text-sm text-earth-600">{t('platform.dashboard.loading', { defaultValue: 'Carregando...' })}</p>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-earth-900">
            {t('platform.boxBreak.title', { defaultValue: 'Meus Box Breaks' })}
          </h2>
          <p className="mt-1 text-sm text-earth-600">
            {t('platform.boxBreak.subtitle', {
              defaultValue: 'Participações reservadas, resultados e cartas para sell-back.',
            })}
          </p>
        </div>
        <LocalizedLink
          toRoute="collectorBatchCatalog"
          className="rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
        >
          {t('collector.actions.exploreBatches', { defaultValue: 'Explorar Box Breaks' })}
        </LocalizedLink>
      </div>

      {rips.length ? (
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
              <p className="text-sm text-earth-600">
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
                {t(`collector.participation.status.${participationStatus}`, { defaultValue: participationStatus })}
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
      )}

      {relatedAssets.length ? (
        <div>
          <h3 className="text-base font-semibold text-earth-900">
            {t('platform.boxBreak.cardsTitle', { defaultValue: 'Cartas destes Box Breaks' })}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedAssets.map((asset) => (
              <CardAssetTile key={asset.id} asset={asset} to={collectorCardAssetPath(asset.id, locale)} />
            ))}
          </div>
        </div>
      ) : rips.length ? (
        <p className="flex items-center gap-2 text-sm text-earth-600">
          <IconCards />
          {t('platform.boxBreak.cardsEmpty', {
            defaultValue: 'As cartas aparecem aqui depois do Box Break.',
          })}
        </p>
      ) : null}
    </div>
  )
}

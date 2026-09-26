import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { PageSeo } from '../../components/PageSeo'
import { getCollectionAsset } from '../../services/collectorService'
import { collectorCollectionRipPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'

function CardAssetPage() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const { assetId } = useParams()
  const [asset, setAsset] = useState(null)
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'

  useEffect(() => {
    let active = true
    void getCollectionAsset(assetId).then((res) => {
      if (!active) return
      setAsset(res?.data || null)
    })
    return () => {
      active = false
    }
  }, [assetId])

  if (!asset) {
    return <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">{t('collector.errors.assetNotFound', { defaultValue: 'Card asset nao encontrado.' })}</div>
  }

  return (
    <>
      <PageSeo routeKey="collectorCollection" title={t('collector.meta.assetTitle', { defaultValue: 'Card Asset | Collector MVP' })} noindex />
      <section className="px-4 pb-12 pt-24">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-sm">
            <img src={asset.card?.image || '/logo.png'} alt={asset.card?.name?.[localeKey] || asset.id} className="h-full w-full object-cover" />
          </div>
          <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
            <h1 className="font-display text-2xl font-semibold text-earth-900">
              {asset.card?.name?.[localeKey] || asset.card?.id}
            </h1>
            <p className="mt-2 text-sm text-earth-600">
              {asset.card?.set} • {asset.card?.number} • {asset.card?.rarity}
            </p>

            <div className="mt-5 space-y-2 rounded-xl border border-earth-200 bg-earth-50 p-4 text-sm text-earth-700">
              <p>
                <span className="font-semibold text-earth-900">{t('collector.asset.origin', { defaultValue: 'Origem' })}:</span>{' '}
                {t('collector.asset.originBatch', { defaultValue: 'Abertura' })} {asset.origin?.batchId}
              </p>
              <p>
                <span className="font-semibold text-earth-900">{t('collector.asset.statusLabel', { defaultValue: 'Status' })}:</span>{' '}
                {t(`collector.asset.status.${asset.status}`, { defaultValue: asset.status })}
              </p>
              <p>
                <span className="font-semibold text-earth-900">{t('collector.asset.condition', { defaultValue: 'Condicao' })}:</span>{' '}
                {(asset.condition || 'nm').toUpperCase()}
              </p>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {['keep', 'ship', 'grade', 'sell'].map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled
                  className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-500"
                >
                  {t(`collector.asset.actions.${action}`, { defaultValue: action })} • {t('collector.asset.soon', { defaultValue: 'em breve' })}
                </button>
              ))}
            </div>

            <Link
              to={collectorCollectionRipPath(asset.origin?.allocationId || '', locale)}
              className="mt-5 inline-flex text-sm font-medium text-earth-700 hover:underline"
            >
              {t('collector.actions.backToBatchRecord', { defaultValue: 'Voltar para o registro da abertura' })}
            </Link>
          </article>
        </div>
      </section>
    </>
  )
}

export default CardAssetPage

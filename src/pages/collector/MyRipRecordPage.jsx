import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageSeo } from '../../components/PageSeo'
import { RipProgress } from '../../components/collector/RipProgress'
import { PullReveal } from '../../components/collector/PullReveal'
import { getMyRipRecord, isCollectorMockMode } from '../../services/collectorService'
import { getAssetByPullId, getCollectorCardById } from '../../data/collectorMock'
import { collectorCardAssetPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'

function MyRipRecordPage() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const path = useLocalizedPath()
  const locale = useSiteLocale()
  const { ripId } = useParams()
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const isMockMode = isCollectorMockMode()

  useEffect(() => {
    let active = true
    void getMyRipRecord(ripId).then((res) => {
      if (!active) return
      if (res?.error) {
        setError(res.error.message || 'error')
        setRecord(null)
      } else {
        setError('')
        setRecord(res?.data || null)
      }
    })
    return () => {
      active = false
    }
  }, [ripId])

  const labels = {
    packs: t('collector.batchDetail.packsLabel', { defaultValue: 'Posicoes reservadas' }),
    OPEN: t('collector.status.OPEN', { defaultValue: 'Aberta' }),
    SCHEDULED: t('collector.status.SCHEDULED', { defaultValue: 'Agendada' }),
    OPENING: t('collector.status.OPENING', { defaultValue: 'Em abertura' }),
    COMPLETED: t('collector.status.COMPLETED', { defaultValue: 'Concluida' }),
    FULFILLING: t('collector.status.FULFILLING', { defaultValue: 'Em fulfillment' }),
  }

  if (!isMockMode && !isAuthenticated) {
    return (
      <section className="mx-auto mt-24 max-w-3xl rounded-2xl border border-earth-200 bg-white p-6 text-earth-700 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-earth-900">
          {t('collector.collection.loginRequiredTitle', { defaultValue: 'Entre para ver sua colecao' })}
        </h1>
        <p className="mt-2 text-sm text-earth-600">
          {t('collector.collection.loginRequiredBody', { defaultValue: 'Sua colecao e seus registros de abertura ficam disponiveis apos o login.' })}
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

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">
        {t('collector.errors.joinRequired', { defaultValue: 'Participe do rip para acessar este registro.' })}
      </div>
    )
  }
  if (!record) {
    return <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">{t('loading')}</div>
  }

  return (
    <>
      <PageSeo routeKey="collectorCollection" title={t('collector.meta.recordTitle', { defaultValue: 'Registro do Rip | Collector MVP' })} noindex={isMockMode} />
      <section className="px-4 pb-10 pt-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
            <h1 className="font-display text-2xl font-semibold text-earth-900">
              {record.product?.name?.[localeKey] || record.product?.id}
            </h1>
            <p className="mt-2 text-sm text-earth-600">
              {record.code} • {record.batch?.batchCode || ''} • {record.bulk?.cardCount || 0} cards em bulk
            </p>
            {record.openingSession?.openingVideo ? (
              <a
                href={record.openingSession.openingVideo}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex text-xs font-medium text-earth-700 hover:underline"
              >
                {t('collector.actions.watchRecordedOpening', { defaultValue: 'Assistir abertura gravada' })}
              </a>
            ) : null}
            <p className="mt-3 rounded-lg bg-earth-50 p-3 text-sm text-earth-700">
              {record.bulk?.notes || t('collector.ripDetail.bulkDefault', { defaultValue: 'Bulk agregado sem cadastro individual de fillers.' })}
            </p>
            <div className="mt-4">
              <RipProgress rip={record} labels={labels} />
            </div>
          </article>

          <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-earth-900">
              {t('collector.ripDetail.pullHighlights', { defaultValue: 'Pulls relevantes' })}
            </h2>
            <div className="mt-4 space-y-3">
              {(record.pulls || []).map((pull) => {
                const card = getCollectorCardById(pull.cardId)
                const relatedAsset = getAssetByPullId(pull.id)
                return (
                  <div key={pull.id} className="rounded-xl border border-earth-200 bg-earth-50 p-3">
                    <PullReveal
                      compact
                      pull={{
                        card_name: card?.name?.[localeKey] || card?.name?.['pt-BR'] || card?.id || '',
                        rarity: card?.rarity || '',
                        image_url: card?.image || '',
                      }}
                    />
                    {relatedAsset ? (
                      <Link
                        to={collectorCardAssetPath(relatedAsset.id, locale)}
                        className="mt-2 inline-flex text-xs font-medium text-earth-700 hover:underline"
                      >
                        {t('collector.actions.viewRelatedAsset', { defaultValue: 'Ver card asset relacionado' })}
                      </Link>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </article>
        </div>
      </section>
    </>
  )
}

export default MyRipRecordPage

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { DemoBadge } from '../../components/collector/DemoBadge'
import { PullReveal } from '../../components/collector/PullReveal'
import { getOpeningSession, isCollectorMockMode } from '../../services/collectorService'
import { getCollectorCardById } from '../../data/collectorMock'

function toEmbeddableVideoUrl(rawUrl = '') {
  const raw = String(rawUrl || '').trim()
  if (!raw) return ''
  if (raw.includes('/embed/')) return raw
  try {
    const url = new URL(raw)
    const videoId = url.searchParams.get('v')
    if (videoId) return `https://www.youtube.com/embed/${videoId}`
  } catch {
    return ''
  }
  return ''
}

function LivePage() {
  const { t, i18n } = useTranslation()
  const { liveId, openingId, sessionId } = useParams()
  const [opening, setOpening] = useState(null)
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR'
  const isMockMode = isCollectorMockMode()
  const targetOpeningId = sessionId || openingId || liveId || ''

  useEffect(() => {
    let active = true
    void getOpeningSession(targetOpeningId).then((res) => {
      if (!active) return
      setOpening(res?.data || null)
    })
    return () => {
      active = false
    }
  }, [targetOpeningId])

  const allocations = useMemo(() => opening?.batch?.allocations || [], [opening?.batch?.allocations])
  const pulls = opening?.pulls || []
  const embeddableVideoUrl = toEmbeddableVideoUrl(opening?.openingVideo)

  if (!opening) {
    return <div className="mx-auto max-w-6xl px-4 py-24 text-earth-600">{t('collector.errors.openingNotFound', { defaultValue: 'Opening session nao encontrada.' })}</div>
  }

  return (
    <>
      <PageSeo routeKey="collectorOpenings" title={t('collector.meta.openingDetailTitle', { defaultValue: 'Opening Session | Collector MVP' })} noindex={isMockMode} />
      <section className="px-4 pb-10 pt-24">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <DemoBadge />
              <span className="rounded-full bg-earth-100 px-3 py-1 text-xs font-semibold text-earth-700">
                {t(`collector.opening.status.${opening.status}`, { defaultValue: opening.status })}
              </span>
            </div>
            <h1 className="font-display text-3xl font-semibold text-earth-900">{opening.title?.[locale] || opening.id}</h1>
            <p className="mt-2 text-sm text-earth-600">
              {opening.batch?.batchCode} • {opening.batch?.product?.name?.[locale] || opening.batch?.product?.id}
            </p>
            {embeddableVideoUrl ? (
              <div className="mt-5 overflow-hidden rounded-xl border border-earth-200 bg-black">
                <iframe
                  title={opening.title?.[locale] || 'Opening session'}
                  src={embeddableVideoUrl}
                  className="aspect-video w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-earth-200 bg-earth-50 p-3 text-sm text-earth-700">
                {t('collector.opening.recordingInProgress', { defaultValue: 'Box Break em gravacao. Video sera publicado ao final da sessao.' })}
              </p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-xl font-semibold text-earth-900">
                {t('collector.opening.allocationsTitle', { defaultValue: 'Participações deste Box Break' })}
              </h2>
              <ul className="mt-4 space-y-2">
                {allocations.map((allocation) => (
                  <li key={allocation.id} className="rounded-lg border border-earth-200 bg-earth-50 px-3 py-2 text-sm text-earth-700">
                    <span className="font-semibold text-earth-900">{allocation.id}</span> • {allocation.quantity} pack(s)
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-earth-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-xl font-semibold text-earth-900">
                {t('collector.opening.pullTitle', { defaultValue: 'Pulls registrados' })}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {pulls.map((pull) => {
                  const card = getCollectorCardById(pull.cardId)
                  return (
                    <PullReveal
                      key={pull.id}
                      compact
                      pull={{
                        card_name: card?.name?.[locale] || card?.name?.['pt-BR'] || card?.id || '',
                        rarity: card?.rarity || '',
                        image_url: card?.image || '',
                      }}
                    />
                  )
                })}
              </div>
            </article>
          </div>
        </div>
      </section>
    </>
  )
}

export default LivePage

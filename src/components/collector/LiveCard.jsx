import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DemoBadge } from './DemoBadge'

export function LiveCard({ live, to }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR'
  const title = live?.title?.[locale] || live?.title?.['pt-BR'] || live?.id || ''
  const startsAt = live?.startsAt ? new Date(live.startsAt) : null
  const dateLabel = startsAt && !Number.isNaN(startsAt.getTime())
    ? startsAt.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
    : '--'
  const published = live?.status === 'PUBLISHED'
  const recording = live?.status === 'RECORDING'

  return (
    <article className="rounded-xl border border-earth-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <DemoBadge />
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${recording ? 'bg-collector-100 text-collector-700' : 'bg-earth-100 text-earth-700'}`}>
          {published
            ? t('collector.opening.statusPublished', { defaultValue: 'Publicado' })
            : recording
              ? t('collector.opening.statusRecording', { defaultValue: 'Gravando' })
              : t('collector.opening.statusScheduled', { defaultValue: 'Agendada' })}
        </span>
      </div>
      <h3 className="font-display text-lg font-semibold text-earth-900">{title}</h3>
      <p className="mt-1 text-sm text-earth-600">{dateLabel}</p>
      <Link
        to={to}
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 transition hover:bg-earth-50"
      >
        {t('collector.actions.openOpening', { defaultValue: 'Ver abertura' })}
      </Link>
    </article>
  )
}

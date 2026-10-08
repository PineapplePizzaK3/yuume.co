import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { catalogItemPath, catalogSetPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'

function ReasonList({ reasons }) {
  const { t } = useTranslation()
  if (!reasons?.length) return null
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-earth-500">
      {reasons.map((r) => (
        <li key={r.code}>
          {t(`collector.recs.reasons.${r.code}`, {
            defaultValue: r.code,
            ...r.params,
          })}
        </li>
      ))}
    </ul>
  )
}

function RecCard({ row, onDismiss }) {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const name = localeKey === 'en' ? row.nameEn || row.nameJa : row.nameJa || row.nameEn

  return (
    <div className="rounded-xl border border-earth-200 bg-white p-3">
      <Link to={catalogItemPath(row.catalogItemId, locale)} className="font-medium text-earth-900 hover:underline">
        {name || row.number || '—'}
      </Link>
      <p className="text-xs text-earth-500">
        {[row.setCode, row.number ? `#${row.number}` : null, row.rarity].filter(Boolean).join(' · ')}
      </p>
      {row.market?.bestPriceJpy != null ? (
        <p className="mt-1 text-sm text-earth-700">¥{row.market.bestPriceJpy}</p>
      ) : null}
      <ReasonList reasons={row.reasons} />
      <div className="mt-2 flex flex-wrap gap-2">
        {row.market?.url ? (
          <a href={row.market.url} target="_blank" rel="noreferrer" className="text-xs text-earth-700 underline">
            {t('collector.market.open', { defaultValue: 'Abrir' })}
          </a>
        ) : (
          <Link to={catalogItemPath(row.catalogItemId, locale)} className="text-xs text-earth-700 underline">
            {t('collector.recs.find', { defaultValue: 'Find in Japan' })}
          </Link>
        )}
        {onDismiss ? (
          <button type="button" onClick={() => onDismiss(row.catalogItemId)} className="text-xs text-earth-500 hover:text-earth-800">
            {t('collector.recs.dismiss', { defaultValue: 'Dispensar' })}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function RecommendationFeed({ buckets, onDismiss }) {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  if (!buckets) return null

  const sections = [
    { key: 'foundForYou', title: t('collector.recs.foundForYou', { defaultValue: 'Encontramos pra você' }), items: buckets.foundForYou },
    { key: 'goodTiming', title: t('collector.recs.goodTiming', { defaultValue: 'Bom momento' }), items: buckets.goodTiming },
    { key: 'related', title: t('collector.recs.related', { defaultValue: 'Relacionados' }), items: buckets.related },
  ]

  const hasAny =
    sections.some((s) => s.items?.length) || (buckets.finishYourSet && buckets.finishYourSet.length > 0)

  if (!hasAny) {
    return (
      <p className="text-sm text-earth-600">
        {t('collector.recs.empty', {
          defaultValue: 'Sem recomendações ainda. Acompanhe sets, adicione wishlist e aguarde snapshots.',
        })}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {sections.map((section) =>
        section.items?.length ? (
          <div key={section.key}>
            <h3 className="text-sm font-semibold text-earth-800">{section.title}</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((row) => (
                <RecCard key={row.catalogItemId} row={row} onDismiss={onDismiss} />
              ))}
            </div>
          </div>
        ) : null
      )}

      {buckets.finishYourSet?.length ? (
        <div>
          <h3 className="text-sm font-semibold text-earth-800">
            {t('collector.recs.finishYourSet', { defaultValue: 'Complete seu set' })}
          </h3>
          <div className="mt-2 space-y-3">
            {buckets.finishYourSet.map((group) => (
              <div key={group.setId} className="rounded-xl border border-earth-200 bg-white p-3">
                <Link
                  to={catalogSetPath(group.setId, locale)}
                  className="font-medium text-earth-900 hover:underline"
                >
                  {group.setName || group.setCode}
                </Link>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(group.items || []).map((row) => (
                    <RecCard key={row.catalogItemId} row={row} onDismiss={onDismiss} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

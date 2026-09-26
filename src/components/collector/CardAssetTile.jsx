import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function CardAssetTile({ asset, to }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR'
  const cardName = asset?.card?.name?.[locale] || asset?.card?.name?.['pt-BR'] || asset?.card?.id || ''
  const statusLabel = t(`collector.asset.status.${asset?.status}`, { defaultValue: asset?.status || 'held' })
  return (
    <Link to={to} className="group overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm transition hover:border-earth-300">
      <div className="aspect-[3/4] overflow-hidden bg-earth-100">
        <img src={asset?.card?.image || '/logo.png'} alt={cardName} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
      </div>
      <div className="p-3">
        <p className="truncate font-semibold text-earth-900">{cardName}</p>
        <p className="text-xs text-earth-600">
          {asset?.card?.set} • {asset?.card?.rarity}
        </p>
        <p className="mt-1 text-xs font-medium text-collector-700">{statusLabel}</p>
      </div>
    </Link>
  )
}

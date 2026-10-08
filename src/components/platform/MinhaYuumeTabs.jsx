import { useTranslation } from 'react-i18next'
import { LocalizedLink } from '../LocalizedLink'

const TABS = [
  { id: 'resumo', toRoute: 'minhaYuume', labelKey: 'platform.dashboard.tabSummary', fallback: 'Resumo' },
  { id: 'colecao', toRoute: 'collectorCollection', labelKey: 'platform.dashboard.tabCollection', fallback: 'Minha coleção' },
  { id: 'box-break', toRoute: 'minhaYuumeBoxBreak', labelKey: 'platform.dashboard.tabBoxBreak', fallback: 'Box Break' },
]

export function MinhaYuumeTabs({ active = 'resumo' }) {
  const { t } = useTranslation()
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const selected = tab.id === active
        return (
          <LocalizedLink
            key={tab.id}
            toRoute={tab.toRoute}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              selected ? 'bg-earth-900 text-white' : 'border border-earth-200 bg-white text-earth-700 hover:bg-earth-50'
            }`}
            aria-current={selected ? 'page' : undefined}
          >
            {t(tab.labelKey, { defaultValue: tab.fallback })}
          </LocalizedLink>
        )
      })}
    </div>
  )
}

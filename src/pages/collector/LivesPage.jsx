import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { LiveCard } from '../../components/collector/LiveCard'
import { isCollectorMockMode, listOpeningSessions } from '../../services/collectorService'
import { collectorOpeningDetailPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'

function LivesPage() {
  const { t } = useTranslation()
  const locale = useSiteLocale()
  const isMockMode = isCollectorMockMode()
  const [lives, setLives] = useState([])

  useEffect(() => {
    let active = true
    void listOpeningSessions().then((res) => {
      if (!active) return
      setLives(Array.isArray(res?.data) ? res.data : [])
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <PageSeo routeKey="collectorOpenings" title={t('collector.meta.openingsTitle', { defaultValue: 'Opening Sessions | Collector MVP' })} noindex={isMockMode} />
      <section className="px-4 pb-10 pt-24">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-3xl font-semibold text-earth-900">
            {t('collector.opening.title', { defaultValue: 'Opening sessions' })}
          </h1>
          <p className="mt-2 text-earth-600">
            {t('collector.opening.description', { defaultValue: 'Acompanhe Box Breaks programados, em gravacao e publicados.' })}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {lives.map((live) => (
              <LiveCard key={live.id} live={live} to={collectorOpeningDetailPath(live.id, locale)} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default LivesPage

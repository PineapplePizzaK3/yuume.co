import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../PageSeo'
import { LocalizedLink } from '../LocalizedLink'
import { CollectorOnboarding } from './CollectorOnboarding'
import { RecommendationFeed } from './RecommendationFeed'
import { useAuth } from '../../hooks/useAuth'
import { useCollectorFlags } from '../../hooks/useCollectorFlags'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import { catalogSetPath } from '../../lib/localeRoutes'
import { listSets } from '../../services/catalogService'
import { getTrackedSetProgress } from '../../services/trackedSetService'
import { listWishlistItems } from '../../services/wishlistCatalogService'
import { dismissRecommendationItem, getCollectorRecommendations } from '../../services/recommendationService'

/**
 * Collector Home v2 — collection loop first. Shown when collector_home_v2_enabled is true.
 */
export function CollectorHomeDashboard() {
  const { t, i18n } = useTranslation()
  const { user, isAuthenticated } = useAuth()
  const { recommendations: recsEnabled, openings } = useCollectorFlags()
  const path = useLocalizedPath()
  const locale = useSiteLocale()
  const location = useLocation()
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const [progress, setProgress] = useState([])
  const [sets, setSets] = useState([])
  const [wishlistCount, setWishlistCount] = useState(0)
  const [recs, setRecs] = useState(null)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const franchises = [...new Set((sets || []).map((s) => s.franchise).filter(Boolean))]

  const reload = async () => {
    setLoading(true)
    const setsRes = await listSets()
    setSets(Array.isArray(setsRes.data) ? setsRes.data : [])
    if (!isAuthenticated) {
      setProgress([])
      setWishlistCount(0)
      setRecs(null)
      setLoading(false)
      return
    }
    const [prog, wish, rec] = await Promise.all([
      getTrackedSetProgress(),
      listWishlistItems({ limit: 50 }),
      recsEnabled ? getCollectorRecommendations({ userId: user?.id }) : Promise.resolve({ data: null }),
    ])
    setProgress(Array.isArray(prog.data) ? prog.data : [])
    setWishlistCount((wish.data || []).length)
    setRecs(rec.data)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, recsEnabled])

  const handleDismiss = async (catalogItemId) => {
    if (!user?.id) return
    await dismissRecommendationItem(user.id, catalogItemId)
    void reload()
  }

  return (
    <>
      <PageSeo
        routeKey="collectorHub"
        title={t('collector.meta.homeV2Title', { defaultValue: 'Coleção | YuumeCo' })}
        description={t('collector.meta.homeV2Description', {
          defaultValue: 'Sua coleção conectada ao mercado japonês.',
        })}
      />

      <section className="px-4 pb-8 pt-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">
            {t('collector.homeV2.eyebrow', { defaultValue: 'Minha coleção' })}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-earth-900 sm:text-4xl">
            {t('collector.homeV2.title', { defaultValue: 'Sua coleção → Japão' })}
          </h1>
          <p className="mt-3 max-w-2xl text-earth-600">
            {t('collector.homeV2.subtitle', {
              defaultValue: 'Acompanhe sets, marque o que falta, ache no Japão e consolide envios.',
            })}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <LocalizedLink
              toRoute="collectorExplore"
              className="rounded-lg bg-earth-900 px-4 py-2.5 text-sm font-medium text-earth-50 hover:bg-earth-800"
            >
              {t('collector.actions.explore', { defaultValue: 'Explorar sets' })}
            </LocalizedLink>
            <LocalizedLink
              toRoute="collectorWishlist"
              className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 hover:bg-earth-50"
            >
              {t('collector.actions.wishlist', { defaultValue: 'Wishlist' })}
              {wishlistCount ? ` (${wishlistCount})` : ''}
            </LocalizedLink>
            <LocalizedLink
              toRoute="collectorCollection"
              className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 hover:bg-earth-50"
            >
              {t('collector.actions.openCollection', { defaultValue: 'Minha coleção' })}
            </LocalizedLink>
            {isAuthenticated ? (
              <LocalizedLink
                toRoute="appDashboard"
                className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 hover:bg-earth-50"
              >
                {t('collector.homeV2.opsCta', { defaultValue: 'Pedidos e carteira' })}
              </LocalizedLink>
            ) : null}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => setOnboardingOpen(true)}
                className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 hover:bg-earth-50"
              >
                {t('collector.onboarding.open', { defaultValue: 'Começar coleção' })}
              </button>
            ) : (
              <Link
                to={path('login')}
                state={{ from: location }}
                className="rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-medium text-earth-800 hover:bg-earth-50"
              >
                {t('collector.actions.loginToContinue', { defaultValue: 'Entrar' })}
              </Link>
            )}
            {openings ? (
              <LocalizedLink
                toRoute="collectorBatches"
                className="rounded-lg border border-dashed border-earth-300 px-4 py-2.5 text-sm text-earth-600 hover:bg-earth-50"
              >
                {t('collector.actions.exploreBatches', { defaultValue: 'Box Break' })}
              </LocalizedLink>
            ) : null}
          </div>
        </div>
      </section>

      <section className="px-4 pb-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <h2 className="font-display text-xl font-semibold text-earth-900">
              {t('collector.homeV2.tracked', { defaultValue: 'Sets acompanhados' })}
            </h2>
            {loading ? (
              <p className="mt-2 text-sm text-earth-600">{t('collector.common.loading', { defaultValue: 'Carregando...' })}</p>
            ) : !isAuthenticated ? (
              <p className="mt-2 text-sm text-earth-600">
                {t('collector.homeV2.loginHint', { defaultValue: 'Entre para ver progresso e recomendações.' })}
              </p>
            ) : progress.length === 0 ? (
              <p className="mt-2 text-sm text-earth-600">
                {t('collector.homeV2.noTracked', {
                  defaultValue: 'Nenhum set acompanhado. Explore e marque “acompanhar”.',
                })}
              </p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {progress.map((row) => {
                  const name = localeKey === 'en' ? row.name_en || row.name_ja : row.name_ja || row.name_en
                  const pct = row.percentage != null ? Math.round(Number(row.percentage)) : null
                  return (
                    <li key={row.set_id} className="rounded-xl border border-earth-200 bg-white p-4">
                      <Link to={catalogSetPath(row.set_id, locale)} className="font-medium text-earth-900 hover:underline">
                        {name || row.set_code}
                      </Link>
                      <p className="mt-1 text-xs text-earth-500">{row.set_code}</p>
                      {row.status === 'VERIFIED' && pct != null ? (
                        <p className="mt-2 text-sm text-earth-700">
                          {t('collector.homeV2.completion', {
                            defaultValue: '{{owned}}/{{total}} ({{pct}}%) · faltam {{missing}}',
                            owned: row.owned,
                            total: row.total,
                            pct,
                            missing: row.missing,
                          })}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-amber-700">
                          {t('collector.item.setNotVerified', {
                            defaultValue: 'Set {{status}} — % só após VERIFIED.',
                            status: row.status,
                          })}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {recsEnabled && isAuthenticated ? (
            <div>
              <h2 className="font-display text-xl font-semibold text-earth-900">
                {t('collector.recs.title', { defaultValue: 'Recomendações' })}
              </h2>
              <div className="mt-3">
                <RecommendationFeed buckets={recs} onDismiss={handleDismiss} />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {onboardingOpen && isAuthenticated ? (
        <CollectorOnboarding
          franchises={franchises}
          sets={sets}
          userId={user.id}
          onClose={() => setOnboardingOpen(false)}
          onDone={async () => {
            setOnboardingOpen(false)
            await reload()
          }}
        />
      ) : null}
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { CollectorOnboarding } from '../../components/collector/CollectorOnboarding'
import { listSets } from '../../services/catalogService'
import { listTrackedSetIds, trackSet } from '../../services/trackedSetService'
import { computeSetProgress, setStatusLabelKey } from '../../lib/collection/completion'
import { catalogSetPath, localizedPath } from '../../lib/localeRoutes'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'

const STATUS_BADGE = {
  VERIFIED: 'bg-emerald-100 text-emerald-800',
  VALIDATING: 'bg-amber-100 text-amber-800',
  IMPORTED: 'bg-sky-100 text-sky-800',
  PENDING: 'bg-earth-100 text-earth-700',
}

export default function ExplorePage() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const path = useLocalizedPath()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const [sets, setSets] = useState([])
  const [tracked, setTracked] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'

  const load = async () => {
    setLoading(true)
    setError('')
    const [setsRes, trackedRes] = await Promise.all([
      listSets(),
      isAuthenticated ? listTrackedSetIds() : Promise.resolve({ data: [], error: null }),
    ])
    if (setsRes.error) {
      setError(setsRes.error.message || t('collector.errors.setsLoad', { defaultValue: 'Não foi possível carregar os sets.' }))
    }
    setSets(Array.isArray(setsRes.data) ? setsRes.data : [])
    setTracked(new Set((trackedRes.data || []).map((row) => row.set_id)))
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const franchises = useMemo(() => [...new Set(sets.map((s) => s.franchise).filter(Boolean))], [sets])

  const handleTrack = async (setId, next) => {
    if (!isAuthenticated) return
    setBusyId(setId)
    const res = await trackSet(setId, next)
    setBusyId('')
    if (res.error) {
      setError(res.error.message || t('collector.errors.trackFailed', { defaultValue: 'Não foi possível atualizar o acompanhamento.' }))
      return
    }
    setTracked((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(setId)
      else copy.delete(setId)
      return copy
    })
  }

  return (
    <>
      <PageSeo
        routeKey="collectorExplore"
        title={t('collector.meta.exploreTitle', { defaultValue: 'Explorar sets | YuumeCo' })}
        description={t('collector.meta.exploreDescription', {
          defaultValue: 'Explore sets japoneses e acompanhe a completude da sua coleção.',
        })}
      />
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-24">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-earth-900">
              {t('collector.explore.title', { defaultValue: 'Explorar sets' })}
            </h1>
            <p className="mt-2 max-w-2xl text-earth-600">
              {t('collector.explore.description', {
                defaultValue: 'Escolha sets para acompanhar. Completude e faltantes só aparecem em sets verificados.',
              })}
            </p>
          </div>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => setShowOnboarding(true)}
              className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm font-medium text-earth-800 hover:bg-earth-50"
            >
              {t('collector.onboarding.open', { defaultValue: 'Começar coleção' })}
            </button>
          ) : (
            <Link
              to={path('login')}
              state={{ from: location }}
              className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
            >
              {t('collector.actions.loginToContinue', { defaultValue: 'Entrar para continuar' })}
            </Link>
          )}
        </div>

        {error ? <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        {loading ? (
          <p className="mt-8 text-sm text-earth-600">{t('collector.common.loading', { defaultValue: 'Carregando...' })}</p>
        ) : sets.length === 0 ? (
          <p className="mt-8 rounded-lg border border-earth-200 bg-earth-50 p-4 text-sm text-earth-600">
            {t('collector.empty.setsExplore', { defaultValue: 'Nenhum set cadastrado ainda.' })}
          </p>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((set) => {
              const name = localeKey === 'en' ? set.name_en || set.name_ja : set.name_ja || set.name_en
              const isTracked = tracked.has(set.id)
              const progress = computeSetProgress({ total: 0, owned: 0, setStatus: set.status })
              return (
                <article key={set.id} className="rounded-xl border border-earth-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-earth-500">{set.set_code}</p>
                      <Link to={catalogSetPath(set.id, locale)} className="mt-1 block font-semibold text-earth-900 hover:underline">
                        {name || set.set_code}
                      </Link>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[set.status] || STATUS_BADGE.PENDING}`}>
                      {t(setStatusLabelKey(set.status), { defaultValue: set.status })}
                    </span>
                  </div>
                  {!progress.available ? (
                    <p className="mt-3 text-xs text-amber-700">
                      {t('collector.progress.checklistPending', { defaultValue: 'Checklist em validação' })}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-emerald-700">
                      {t('collector.progress.verifiedReady', {
                        defaultValue: 'Checklist verificado — abra o set para marcar o que você tem.',
                      })}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to={catalogSetPath(set.id, locale)}
                      className="rounded border border-earth-300 px-3 py-1.5 text-sm text-earth-800 hover:bg-earth-50"
                    >
                      {t('collector.explore.openSet', { defaultValue: 'Abrir set' })}
                    </Link>
                    {isAuthenticated ? (
                      <button
                        type="button"
                        disabled={busyId === set.id}
                        onClick={() => handleTrack(set.id, !isTracked)}
                        className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
                          isTracked
                            ? 'border border-earth-300 bg-white text-earth-800 hover:bg-earth-50'
                            : 'bg-earth-900 text-earth-50 hover:bg-earth-800'
                        }`}
                      >
                        {isTracked
                          ? t('collector.explore.untrack', { defaultValue: 'Parar de acompanhar' })
                          : t('collector.explore.track', { defaultValue: 'Acompanhar' })}
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {showOnboarding && user?.id ? (
        <CollectorOnboarding
          franchises={franchises}
          sets={sets}
          userId={user.id}
          onClose={() => setShowOnboarding(false)}
          onDone={async () => {
            setShowOnboarding(false)
            await load()
          }}
        />
      ) : null}

      <div className="mx-auto max-w-6xl px-4 pb-8 text-sm text-earth-500">
        <Link to={localizedPath('collectorCollection', locale)} className="hover:text-earth-800">
          {t('collector.actions.openCollection', { defaultValue: 'Ver minha coleção' })}
        </Link>
      </div>
    </>
  )
}

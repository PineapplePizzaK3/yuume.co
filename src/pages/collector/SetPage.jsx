import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { getSet, listSetItems } from '../../services/catalogService'
import { listOwnedCollectionItems, setCatalogItemOwned } from '../../services/collectionService'
import { listTrackedSetIds, trackSet } from '../../services/trackedSetService'
import {
  completionUnavailableMessageKey,
  computeSetProgress,
  setStatusLabelKey,
} from '../../lib/collection/completion'
import { catalogItemPath, catalogSetPath, localizedPath } from '../../lib/localeRoutes'
import { useAuth } from '../../hooks/useAuth'
import { useLocalizedPath } from '../../hooks/useLocalizedPath'
import { useSiteLocale } from '../../hooks/useSiteLocale'

const STATUS_BADGE = {
  VERIFIED: 'bg-emerald-100 text-emerald-800',
  VALIDATING: 'bg-amber-100 text-amber-800',
  IMPORTED: 'bg-sky-100 text-sky-800',
  PENDING: 'bg-earth-100 text-earth-700',
}

export default function SetPage() {
  const { setId } = useParams()
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const path = useLocalizedPath()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated } = useAuth()
  const [set, setSet] = useState(null)
  const [items, setItems] = useState([])
  const [ownedIds, setOwnedIds] = useState(() => new Set())
  const [tracked, setTracked] = useState(false)
  const [missingOnly, setMissingOnly] = useState(searchParams.get('filter') === 'missing')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'

  const load = async () => {
    setLoading(true)
    setError('')
    const [setRes, itemsRes, trackedRes] = await Promise.all([
      getSet(setId),
      listSetItems(setId, { includeOutOfChecklist: false }),
      isAuthenticated ? listTrackedSetIds() : Promise.resolve({ data: [] }),
    ])
    if (setRes.error || !setRes.data) {
      setError(setRes.error?.message || t('collector.errors.setNotFound', { defaultValue: 'Set não encontrado.' }))
      setSet(null)
      setItems([])
      setLoading(false)
      return
    }
    setSet(setRes.data)
    setItems(Array.isArray(itemsRes.data) ? itemsRes.data : [])
    setTracked((trackedRes.data || []).some((row) => row.set_id === setId))

    if (isAuthenticated) {
      const ownedRes = await listOwnedCollectionItems({ limit: 500 })
      const checklistIds = new Set((itemsRes.data || []).map((item) => item.id))
      setOwnedIds(
        new Set(
          (ownedRes.data || [])
            .map((row) => row.catalog_item_id)
            .filter((id) => checklistIds.has(id))
        )
      )
    } else {
      setOwnedIds(new Set())
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, isAuthenticated])

  useEffect(() => {
    setSearchParams(missingOnly ? { filter: 'missing' } : {}, { replace: true })
  }, [missingOnly, setSearchParams])

  const progress = useMemo(() => {
    const total = items.length
    const owned = items.filter((item) => ownedIds.has(item.id)).length
    return computeSetProgress({ total, owned, setStatus: set?.status })
  }, [items, ownedIds, set?.status])

  const visibleItems = useMemo(() => {
    if (!missingOnly) return items
    if (!progress.available) return []
    return items.filter((item) => !ownedIds.has(item.id))
  }, [items, missingOnly, ownedIds, progress.available])

  const handleToggle = async (itemId) => {
    if (!isAuthenticated || busyId) return
    const nextOwned = !ownedIds.has(itemId)
    setBusyId(itemId)
    const res = await setCatalogItemOwned(itemId, nextOwned)
    setBusyId('')
    if (res.error) {
      setError(res.error.message || t('collector.errors.collectionUpdate', { defaultValue: 'Não foi possível atualizar a coleção.' }))
      return
    }
    setOwnedIds((prev) => {
      const copy = new Set(prev)
      if (nextOwned) copy.add(itemId)
      else copy.delete(itemId)
      return copy
    })
  }

  const handleTrack = async () => {
    if (!isAuthenticated || !setId) return
    const next = !tracked
    setBusyId('track')
    const res = await trackSet(setId, next)
    setBusyId('')
    if (res.error) {
      setError(res.error.message || t('collector.errors.trackFailed', { defaultValue: 'Não foi possível atualizar o acompanhamento.' }))
      return
    }
    setTracked(next)
    if (next && set?.status === 'VERIFIED') await load()
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-24 text-earth-600">{t('collector.common.loading', { defaultValue: 'Carregando...' })}</div>
  }

  if (!set) {
    return <div className="mx-auto max-w-4xl px-4 py-24 text-earth-600">{error || t('collector.errors.setNotFound', { defaultValue: 'Set não encontrado.' })}</div>
  }

  const name = localeKey === 'en' ? set.name_en || set.name_ja : set.name_ja || set.name_en

  return (
    <>
      <PageSeo routeKey="collectorExplore" title={`${name || set.set_code} | YuumeCo`} />
      <section className="mx-auto max-w-4xl px-4 pb-16 pt-24">
        <Link to={localizedPath('collectorExplore', locale)} className="text-sm text-earth-600 hover:text-earth-900">
          ← {t('collector.explore.title', { defaultValue: 'Explorar sets' })}
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-earth-500">{set.set_code}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-earth-900">{name || set.set_code}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[set.status] || STATUS_BADGE.PENDING}`}>
                {t(setStatusLabelKey(set.status), { defaultValue: set.status })}
              </span>
              {progress.available ? (
                <span className="text-sm text-earth-600">
                  {t('collector.progress.summary', {
                    defaultValue: '{{owned}}/{{total}} ({{pct}}%) · faltam {{missing}}',
                    owned: progress.owned,
                    total: progress.total,
                    pct: progress.percentage,
                    missing: progress.missing,
                  })}
                </span>
              ) : (
                <span className="text-sm text-amber-700">{t(completionUnavailableMessageKey(), { defaultValue: 'Checklist em validação' })}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAuthenticated ? (
              <button
                type="button"
                disabled={busyId === 'track'}
                onClick={handleTrack}
                className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60 ${
                  tracked ? 'border border-earth-300 bg-white text-earth-800' : 'bg-earth-900 text-earth-50 hover:bg-earth-800'
                }`}
              >
                {tracked
                  ? t('collector.explore.untrack', { defaultValue: 'Parar de acompanhar' })
                  : t('collector.explore.track', { defaultValue: 'Acompanhar' })}
              </button>
            ) : (
              <Link to={path('login')} state={{ from: location }} className="rounded-lg bg-earth-900 px-3 py-2 text-sm font-medium text-earth-50">
                {t('collector.actions.loginToContinue', { defaultValue: 'Entrar para continuar' })}
              </Link>
            )}
          </div>
        </div>

        {error ? <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-earth-800">
            <input
              type="checkbox"
              checked={missingOnly}
              disabled={!progress.available}
              onChange={(e) => setMissingOnly(e.target.checked)}
            />
            {t('collector.setPage.filterMissing', { defaultValue: 'Só faltantes' })}
          </label>
          {!progress.available && missingOnly ? (
            <span className="text-xs text-amber-700">{t(completionUnavailableMessageKey(), { defaultValue: 'Checklist em validação' })}</span>
          ) : null}
        </div>

        <ul className="mt-4 divide-y divide-earth-100 rounded-xl border border-earth-200 bg-white">
          {visibleItems.length === 0 ? (
            <li className="px-4 py-6 text-sm text-earth-600">
              {missingOnly
                ? t('collector.setPage.noMissing', { defaultValue: 'Nada faltando neste filtro.' })
                : t('collector.setPage.noItems', { defaultValue: 'Este set ainda não tem itens no checklist.' })}
            </li>
          ) : (
            visibleItems.map((item) => {
              const itemName = localeKey === 'en' ? item.name_en || item.name_ja : item.name_ja || item.name_en
              const isOwned = ownedIds.has(item.id)
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-14 font-mono text-earth-500">{item.number || '—'}</span>
                  <Link to={catalogItemPath(item.id, locale)} className="min-w-0 flex-1 font-medium text-earth-900 hover:underline">
                    {itemName || '—'}
                  </Link>
                  <span className="w-12 text-earth-500">{item.rarity || '—'}</span>
                  {isAuthenticated ? (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleToggle(item.id)}
                      className={`rounded px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
                        isOwned ? 'bg-emerald-100 text-emerald-800' : 'border border-earth-300 text-earth-700 hover:bg-earth-50'
                      }`}
                    >
                      {isOwned
                        ? t('collector.setPage.owned', { defaultValue: 'Tenho' })
                        : t('collector.setPage.markOwned', { defaultValue: 'Marcar' })}
                    </button>
                  ) : null}
                </li>
              )
            })
          )}
        </ul>

        <p className="mt-4 text-xs text-earth-500">
          {t('collector.item.noAutoAcquire', {
            defaultValue: 'Compras e holdings no Japão não entram sozinhas na coleção — só quando você marca.',
          })}
          {' · '}
          <Link to={catalogSetPath(set.id, locale)} className="hover:text-earth-800">
            {set.set_code}
          </Link>
        </p>
      </section>
    </>
  )
}

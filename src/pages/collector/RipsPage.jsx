import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import { LocalizedLink } from '../../components/LocalizedLink'
import { RipCard } from '../../components/collector/RipCard'
import { VisualEmptyState } from '../../components/VisualEmptyState'
import { OPENING_CATALOG_CATEGORIES } from '../../data/collectorLiveRipCatalog'
import { BOX_BREAK_LANE_OTHERS, batchMatchesLane } from '../../lib/boxBreakLanes'
import { isCollectorMockMode, listOpeningBatches } from '../../services/collectorService'
import { collectorBatchDetailPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import {
  IconCards,
  IconLayers,
  IconSpark,
} from '../../components/home/HomeSectionIcons'

const GAME_FILTERS = [
  { id: '', Icon: IconLayers, labelKey: 'collector.filters.allGames', defaultValue: 'Todos os jogos' },
  { id: 'pokemon-standard', Icon: IconCards, labelKey: 'collector.hubSteps.catalog.lanePokemon', defaultValue: 'Pokémon' },
  { id: 'one-piece', Icon: IconSpark, labelKey: 'collector.hubSteps.catalog.laneOnePiece', defaultValue: 'One Piece' },
  { id: BOX_BREAK_LANE_OTHERS, Icon: IconLayers, labelKey: 'collector.filters.otherGames', defaultValue: 'Outros jogos' },
]

const GAME_IDS = new Set([
  ...OPENING_CATALOG_CATEGORIES.map((item) => item.id),
  BOX_BREAK_LANE_OTHERS,
])

function RipsPage() {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'
  const isMockMode = isCollectorMockMode()
  const [searchParams, setSearchParams] = useSearchParams()
  const gameFromUrl = GAME_IDS.has(searchParams.get('game') || '') ? searchParams.get('game') : ''
  const [game, setGame] = useState(gameFromUrl)
  const [batches, setBatches] = useState([])

  useEffect(() => {
    setGame(gameFromUrl)
  }, [gameFromUrl])

  useEffect(() => {
    let active = true
    const catalogGame = game === BOX_BREAK_LANE_OTHERS ? '' : game
    void listOpeningBatches({ game: catalogGame }).then((res) => {
      if (!active) return
      const rows = Array.isArray(res?.data) ? res.data : []
      setBatches(
        game === BOX_BREAK_LANE_OTHERS
          ? rows.filter((row) => batchMatchesLane(row, BOX_BREAK_LANE_OTHERS))
          : rows
      )
    })
    return () => {
      active = false
    }
  }, [game])

  const categoryLabelById = useMemo(
    () =>
      new Map(
        OPENING_CATALOG_CATEGORIES.map((row) => [row.id, row.label[localeKey] || row.id])
      ),
    [localeKey]
  )
  const extraGames = useMemo(
    () =>
      OPENING_CATALOG_CATEGORIES.filter(
        (item) => item.id !== 'pokemon-standard' && item.id !== 'one-piece'
      ),
    []
  )
  const extraGameValue = extraGames.some((item) => item.id === game) ? game : ''

  return (
    <>
      <PageSeo
        routeKey="collectorBatchCatalog"
        title={t('collector.meta.batchesTitle', { defaultValue: 'Box Break | YuumeCo' })}
        description={t('collector.meta.batchesDescription', { defaultValue: 'Descubra Box Breaks disponíveis e reserve sua participação.' })}
        noindex={isMockMode}
      />
      <section className="px-4 pb-10 pt-24">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4">
          <div>
            <LocalizedLink toRoute="collectorBatches" className="text-sm text-earth-600 hover:text-earth-900">
              ← {t('nav.batches', { defaultValue: 'Box Break' })}
            </LocalizedLink>
            <h1 className="mt-3 font-display text-3xl font-semibold text-earth-900">
              {t('collector.batches.title', { defaultValue: 'Box Break' })}
            </h1>
            <p className="mt-2 text-earth-600">
              {t('collector.batches.description', { defaultValue: 'Escolha o jogo, reserve sua participação e acompanhe o Box Break gravado.' })}
            </p>
          </div>
          {extraGames.length ? (
            <select
              value={extraGameValue}
              onChange={(event) => {
                const next = event.target.value
                setGame(next)
                setSearchParams(next ? { game: next } : {}, { replace: true })
              }}
              className="rounded-lg border border-earth-300 bg-white px-3 py-2 text-sm text-earth-800"
            >
              <option value="">
                {t('collector.filters.moreGames', { defaultValue: 'Mais jogos' })}
              </option>
              {extraGames.map((item) => (
                <option key={item.id} value={item.id}>
                  {categoryLabelById.get(item.id)}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </section>
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap gap-2">
            {GAME_FILTERS.map((filter) => {
              const FilterIcon = filter.Icon
              const active = game === filter.id
              return (
                <button
                  key={filter.id || 'all'}
                  type="button"
                  onClick={() => {
                    setGame(filter.id)
                    setSearchParams(filter.id ? { game: filter.id } : {}, { replace: true })
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? 'border-earth-800 bg-earth-900 text-earth-50'
                      : 'border-earth-200 bg-white text-earth-800 hover:border-earth-400 hover:bg-earth-50'
                  }`}
                >
                  <FilterIcon className="h-4 w-4" />
                  {t(filter.labelKey, { defaultValue: filter.defaultValue })}
                </button>
              )
            })}
          </div>
          {batches.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {batches.map((rip) => (
                <RipCard
                  key={rip.id}
                  rip={rip}
                  product={rip.product}
                  ctaTo={collectorBatchDetailPath(rip.id, locale)}
                  ctaLabel={t('collector.actions.openBatch', { defaultValue: 'Ver Box Break' })}
                />
              ))}
            </div>
          ) : (
            <VisualEmptyState
              image={`${import.meta.env.BASE_URL}collector/openings-hero.png`}
              icon={IconLayers}
              title={t('collector.home.emptyBatches', { defaultValue: 'Nenhum Box Break disponível no momento.' })}
              hint={t('collector.home.emptyBatchesHint', {
                defaultValue: 'Tente outra categoria ou volte para ver as caixas em destaque.',
              })}
              toRoute="collectorBatches"
              cta={t('nav.batches', { defaultValue: 'Box Break' })}
            />
          )}
        </div>
      </section>
    </>
  )
}

export default RipsPage

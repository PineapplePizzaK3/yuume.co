import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LocalizedLink } from '../LocalizedLink'
import { CreditsInline } from '../CreditsAmount'
import {
  BOX_BREAK_LANE_LIMIT,
  BOX_BREAK_LANES,
  catalogSearchForLane,
  pickTopBatchesForLane,
} from '../../lib/boxBreakLanes'
import { collectorBatchDetailPath } from '../../lib/localeRoutes'
import { useSiteLocale } from '../../hooks/useSiteLocale'
import {
  HomeIconBadge,
  IconCards,
  IconLayers,
  IconSpark,
} from '../home/HomeSectionIcons'
import { LiveRipJpVersionBadge } from '../live-rips/LiveRipJpVersionBadge'

const LANE_TITLE_KEYS = {
  'pokemon-standard': 'collector.hubSteps.catalog.lanePokemon',
  'one-piece': 'collector.hubSteps.catalog.laneOnePiece',
  others: 'collector.hubSteps.catalog.laneOthers',
}

const LANE_TITLE_DEFAULTS = {
  'pokemon-standard': 'Pokémon',
  'one-piece': 'One Piece',
  others: 'Outros jogos',
}

const LANE_ICONS = {
  'pokemon-standard': IconCards,
  'one-piece': IconSpark,
  others: IconLayers,
}

function batchDisplayName(batch, localeKey) {
  return (
    batch?.product?.name?.[localeKey]
    || batch?.product?.name?.['pt-BR']
    || batch?.product?.id
    || batch?.batchCode
    || batch?.id
    || ''
  )
}

function batchPrice(batch) {
  return Number(
    batch?.boxPriceJpy
    || batch?.product?.priceJpy
    || (Number(batch?.pricePerPositionJpy || 0) * Number(batch?.totalPacks || 0))
    || 0
  )
}

function LaneCard({ batch, locale, localeKey }) {
  const { t } = useTranslation()
  const name = batchDisplayName(batch, localeKey)
  const price = batchPrice(batch)
  const remaining = Math.max(
    0,
    Number(
      batch?.availablePositions
      ?? Math.max(0, Number(batch?.totalPacks || 0) - Number(batch?.reservedPositions || 0))
    )
  )
  const total = Number(batch?.totalPacks || 0)
  const remainingPct = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0
  const remainingLabel = t('collector.batchCard.remainingLabel', { defaultValue: 'Participações disponíveis' })

  return (
    <Link
      to={collectorBatchDetailPath(batch.id, locale)}
      className="flex min-w-[18rem] items-start gap-3 rounded-lg border border-earth-200 bg-earth-50 p-2.5 transition hover:border-earth-300 hover:bg-white lg:min-w-0"
    >
      <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded-md bg-earth-200">
        <img
          src={batch.product?.image || '/logo.png'}
          alt=""
          className="h-full w-full object-cover"
        />
        <LiveRipJpVersionBadge size={16} className="right-1 top-1" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-earth-900">{name}</p>
        {price > 0 ? (
          <div className="mt-1">
            <CreditsInline amount={price} className="text-xs font-medium text-earth-800" />
          </div>
        ) : null}
        {total > 0 ? (
          <div className="mt-1.5">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-earth-600">
              <span className="truncate">{remainingLabel}</span>
              <span className="shrink-0 tabular-nums font-medium text-earth-800">
                {t('collector.batchCard.positions', {
                  defaultValue: '{{reserved}}/{{total}}',
                  reserved: remaining,
                  total,
                })}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-earth-200"
              role="progressbar"
              aria-valuenow={remainingPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={remainingLabel}
            >
              <div
                className="h-full rounded-full bg-collector-600 transition-[width] duration-300"
                style={{ width: `${remainingPct}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-earth-500">
            {t('collector.batchCard.positions', {
              defaultValue: '{{reserved}}/{{total}}',
              reserved: remaining,
              total,
            })}
          </p>
        )}
      </div>
    </Link>
  )
}

function LaneTrack({ items, locale, localeKey, compact = false }) {
  return (
    <>
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 lg:hidden"
        tabIndex={0}
      >
        {items.map((batch) => (
            <div key={`${batch.id}-x`} className="w-[18rem] shrink-0 snap-start">
            <LaneCard batch={batch} locale={locale} localeKey={localeKey} />
          </div>
        ))}
      </div>

      <div
        className={`hidden flex-col gap-3 overflow-y-auto pr-1 lg:flex ${compact ? 'h-[20rem]' : 'h-[28rem]'}`}
        tabIndex={0}
      >
        {items.map((batch) => (
          <LaneCard key={`${batch.id}-y`} batch={batch} locale={locale} localeKey={localeKey} />
        ))}
      </div>
    </>
  )
}

export function BoxBreakCategoryLanes({ batches, compact = false }) {
  const { t, i18n } = useTranslation()
  const locale = useSiteLocale()
  const localeKey = i18n.language === 'en' ? 'en' : 'pt-BR'

  const lanes = useMemo(
    () =>
      BOX_BREAK_LANES.map((lane) => ({
        ...lane,
        items: pickTopBatchesForLane(batches, lane.id, BOX_BREAK_LANE_LIMIT),
      })),
    [batches]
  )

  const hasAny = lanes.some((lane) => lane.items.length > 0)

  if (!hasAny) {
    return (
      <div className="overflow-hidden rounded-2xl border border-earth-200 bg-earth-50">
        <div className="grid sm:grid-cols-[0.9fr_1.1fr]">
          <div className="aspect-[4/3] bg-earth-100 sm:aspect-auto">
            <img
              src={`${import.meta.env.BASE_URL}collector/openings-hero.png`}
              alt=""
              className="h-full min-h-[12rem] w-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-center p-6">
            <HomeIconBadge>
              <IconLayers />
            </HomeIconBadge>
            <p className="font-display text-lg font-semibold text-earth-900">
              {t('collector.home.emptyBatches', { defaultValue: 'Nenhum Box Break disponível no momento.' })}
            </p>
            <p className="mt-2 text-sm text-earth-600">
              {t('collector.home.emptyBatchesHint', {
                defaultValue: 'Tente outra categoria ou volte para ver as caixas em destaque.',
              })}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {lanes.map((lane) => {
        const LaneIcon = LANE_ICONS[lane.id] || IconLayers
        return (
        <article
          key={lane.id}
          className="overflow-hidden rounded-xl border border-earth-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <HomeIconBadge className="mb-0 h-8 w-8">
                <LaneIcon />
              </HomeIconBadge>
              <h3 className="font-display text-lg font-semibold text-earth-900">
                {t(LANE_TITLE_KEYS[lane.id], { defaultValue: LANE_TITLE_DEFAULTS[lane.id] })}
              </h3>
            </div>
            <LocalizedLink
              toRoute="collectorBatchCatalog"
              search={catalogSearchForLane(lane.id)}
              className="shrink-0 text-xs font-medium text-earth-700 hover:underline"
            >
              {t('collector.hubSteps.catalog.viewLane', { defaultValue: 'Ver todas' })}
            </LocalizedLink>
          </div>
          {lane.items.length === 0 ? (
            <p className="text-sm text-earth-600">
              {t('collector.home.emptyBatches', { defaultValue: 'Nenhum Box Break disponível no momento.' })}
            </p>
          ) : (
            <LaneTrack items={lane.items} locale={locale} localeKey={localeKey} compact={compact} />
          )}
        </article>
        )
      })}
    </div>
  )
}

import { summarizeLiveRipSet } from '../../lib/liveRipSetSummary'
import { LiveRipJpVersionBadge } from '../live-rips/LiveRipJpVersionBadge'

const IMAGE_FRAME = {
  compact: { width: 80, height: 96, badge: 16 },
  default: { width: 128, height: 176, badge: 20 },
  hero: { width: 176, height: 240, badge: 22 },
}

export function BoxBreakSetSummary({
  product,
  packs,
  localeKey = 'pt-BR',
  compact = false,
  size = '',
  title = '',
  titleAs = 'p',
  showDescription = true,
}) {
  const summary = summarizeLiveRipSet(
    {
      ...product,
      packsPerBox: packs || product?.packsPerBox,
    },
    localeKey
  )
  if (!summary.image && !summary.description && !title) return null
  const TitleTag = titleAs === 'h1' ? 'h1' : 'p'
  const frame = IMAGE_FRAME[size] || (compact ? IMAGE_FRAME.compact : IMAGE_FRAME.default)

  return (
    <div className={`flex items-start gap-3 ${compact ? '' : 'sm:gap-4'}`}>
      <div
        className="relative shrink-0 overflow-hidden rounded-lg border border-earth-100 bg-earth-50"
        style={{ width: frame.width, height: frame.height }}
      >
        <img
          src={summary.image}
          alt=""
          className="h-full w-full object-cover"
        />
        <LiveRipJpVersionBadge
          size={frame.badge}
          className={compact || size === 'hero' ? 'right-1 top-1' : ''}
        />
      </div>
      <div className="min-w-0 flex-1">
        {summary.game ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-earth-500">{summary.game}</p>
        ) : null}
        {title ? (
          <TitleTag
            className={`mt-1 font-semibold text-earth-900 ${
              titleAs === 'h1' ? 'font-display text-2xl' : 'text-sm leading-snug'
            }`}
          >
            {title}
          </TitleTag>
        ) : null}
        {showDescription && summary.description ? (
          <p className={`mt-1 text-sm leading-snug text-earth-600 ${compact ? 'line-clamp-2' : size === 'hero' ? '' : 'line-clamp-4'}`}>
            {summary.description}
          </p>
        ) : null}
        {summary.packs > 0 ? (
          <p className="mt-1.5 text-xs text-earth-500">
            {summary.setCode ? `${summary.setCode} • ` : ''}
            {summary.language}
            {` • ${summary.packs} packs`}
          </p>
        ) : null}
      </div>
    </div>
  )
}

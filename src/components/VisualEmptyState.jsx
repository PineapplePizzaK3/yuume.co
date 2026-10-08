import { LocalizedLink } from './LocalizedLink'
import { HomeIconBadge } from './home/HomeSectionIcons'

export function VisualEmptyState({
  image = '/home/anime-1-figures.png',
  icon: Icon,
  title,
  hint,
  toRoute,
  cta,
  className = 'mt-6',
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-earth-200 bg-earth-50 ${className}`}>
      <div className="grid sm:grid-cols-[0.9fr_1.1fr]">
        <div className="aspect-[4/3] bg-earth-100 sm:aspect-auto">
          <img src={image} alt="" className="h-full min-h-[10rem] w-full object-cover" />
        </div>
        <div className="flex flex-col justify-center p-6">
          {Icon ? (
            <HomeIconBadge>
              <Icon />
            </HomeIconBadge>
          ) : null}
          <p className="font-display text-lg font-semibold text-earth-900">{title}</p>
          {hint ? <p className="mt-2 text-sm text-earth-600">{hint}</p> : null}
          {toRoute && cta ? (
            <LocalizedLink
              toRoute={toRoute}
              className="mt-4 inline-flex w-fit rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
            >
              {cta}
            </LocalizedLink>
          ) : null}
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const STEPS = [
  { key: 'step1', image: `${import.meta.env.BASE_URL}collector/how-it-works/step-1-choose-box.png` },
  { key: 'step2', image: `${import.meta.env.BASE_URL}collector/how-it-works/step-2-buy-packs.png` },
  { key: 'step3', image: `${import.meta.env.BASE_URL}collector/how-it-works/step-3-opening.png` },
  { key: 'step4', image: `${import.meta.env.BASE_URL}collector/how-it-works/step-4-collection.png` },
]

function ChevronLeftIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function BoxBreakHowItWorksCarousel() {
  const { t } = useTranslation()
  const scrollerRef = useRef(null)
  const [active, setActive] = useState(0)

  const scrollToIndex = useCallback((index) => {
    const el = scrollerRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(STEPS.length - 1, index))
    const slide = el.children[clamped]
    if (!(slide instanceof HTMLElement)) return
    el.scrollTo({ left: slide.offsetLeft, behavior: 'auto' })
    setActive(clamped)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    const syncActive = () => {
      const children = Array.from(el.children).slice(0, STEPS.length)
      let closest = 0
      let closestDist = Number.POSITIVE_INFINITY
      children.forEach((child, index) => {
        if (!(child instanceof HTMLElement)) return
        const dist = Math.abs(child.offsetLeft - el.scrollLeft)
        if (dist < closestDist) {
          closestDist = dist
          closest = index
        }
      })
      setActive(closest)
    }

    el.addEventListener('scroll', syncActive, { passive: true })
    return () => el.removeEventListener('scroll', syncActive)
  }, [])

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollToIndex(active + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollToIndex(active - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      scrollToIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      scrollToIndex(STEPS.length - 1)
    }
  }

  return (
    <section id="openings-step-howItWorks" className="border-t border-earth-200 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold text-earth-900">
          {t('collector.hubSteps.howItWorks.heading', { defaultValue: 'Como funciona na prática' })}
        </h2>
        <p className="mt-2 max-w-2xl text-earth-600">
          {t('collector.hubSteps.howItWorks.lead', {
            defaultValue: 'Da escolha da caixa ao resultado do Box Break, o fluxo acontece em quatro passos.',
          })}
        </p>

        <div
          className="relative mt-8"
          role="region"
          aria-roledescription="carousel"
          aria-label={t('collector.hubSteps.howItWorks.heading', { defaultValue: 'Como funciona na prática' })}
        >
          <div
            ref={scrollerRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-earth-400 [&::-webkit-scrollbar]:hidden"
          >
            {STEPS.map((step, index) => (
              <article
                key={step.key}
                className="grid w-[92%] shrink-0 snap-start overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm sm:w-[82%] lg:w-[78%] lg:grid-cols-[1.15fr_0.85fr]"
                aria-hidden={index !== active}
              >
                <div className="flex aspect-video items-center justify-center overflow-hidden bg-white p-6 sm:p-8">
                  <img
                    src={step.image}
                    alt={t(`collector.hubSteps.howItWorks.${step.key}Alt`)}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                </div>
                <div className="flex flex-col justify-center p-5 sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-earth-500">
                    {t('collector.hubSteps.stepLabel', { defaultValue: 'Passo {{number}}', number: index + 1 })}
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-earth-900 sm:text-2xl">
                    {t(`collector.hubSteps.howItWorks.${step.key}`)}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-earth-600 sm:text-base">
                    {t(`collector.hubSteps.howItWorks.${step.key}Detail`)}
                  </p>
                </div>
              </article>
            ))}
            <div className="w-[8%] shrink-0 sm:w-[18%] lg:w-[22%]" aria-hidden />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => scrollToIndex(active - 1)}
              disabled={active === 0}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-earth-300 bg-white text-earth-800 shadow-sm transition hover:bg-earth-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t('collector.hubSteps.howItWorks.prev', { defaultValue: 'Passo anterior' })}
            >
              <ChevronLeftIcon />
            </button>

            <div className="flex items-center gap-2" role="tablist">
              {STEPS.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={t('collector.hubSteps.howItWorks.goToStep', {
                    defaultValue: 'Ir para o passo {{number}}',
                    number: index + 1,
                  })}
                  onClick={() => scrollToIndex(index)}
                  className={`h-2.5 rounded-full transition ${
                    index === active ? 'w-6 bg-earth-800' : 'w-2.5 bg-earth-300 hover:bg-earth-400'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollToIndex(active + 1)}
              disabled={active === STEPS.length - 1}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-earth-300 bg-white text-earth-800 shadow-sm transition hover:bg-earth-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t('collector.hubSteps.howItWorks.next', { defaultValue: 'Próximo passo' })}
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

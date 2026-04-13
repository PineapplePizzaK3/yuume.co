import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageSeo } from '../../components/PageSeo'
import GrupoDeCompras from './GrupoDeCompras'

function Chevron({ open }) {
  return (
    <span className={`shrink-0 text-earth-400 transition-transform ${open ? 'rotate-180' : ''}`}>
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  )
}

function CollapsibleSection({ id, title, open, onToggle, children }) {
  return (
    <section
      id={id}
      className="overflow-hidden rounded-xl border border-earth-200 bg-white shadow-sm"
    >
      <button
        type="button"
        onClick={() => onToggle()}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-earth-50 sm:px-5"
        aria-expanded={open}
      >
        <span className="text-lg font-semibold text-earth-900">{title}</span>
        <Chevron open={open} />
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-earth-100 px-3 pb-5 pt-2 sm:px-4">{children}</div>
        </div>
      </div>
    </section>
  )
}

export default function ComprasProgramadas({ publicMode = false }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [onlineOpen, setOnlineOpen] = useState(true)
  const [fisicaOpen, setFisicaOpen] = useState(true)

  const applyHash = useCallback(() => {
    const raw = (location.hash || '').replace(/^#/, '')
    const h = raw === 'physical' ? 'fisica' : raw
    if (h === 'online') {
      setOnlineOpen(true)
      setFisicaOpen(false)
      requestAnimationFrame(() => {
        document.getElementById('compras-programadas-online')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }
    if (h === 'fisica') {
      setOnlineOpen(false)
      setFisicaOpen(true)
      requestAnimationFrame(() => {
        document.getElementById('compras-programadas-fisica')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [location.hash])

  useEffect(() => {
    applyHash()
  }, [applyHash])

  return (
    <>
      {!publicMode && (
        <PageSeo
          routeKey="appGrupoCompras"
          title={t('meta.appGroupBuy.title')}
          description={t('meta.appGroupBuy.description')}
          noindex
        />
      )}
      <div className={publicMode ? 'px-4 pt-24 pb-12' : ''}>
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="text-2xl font-bold text-earth-900">{t('platform.groupBuy.pageTitle')}</h1>
          <p className="mt-2 text-earth-600">{t('platform.groupBuy.intro')}</p>

          <div className="mt-6 flex flex-col gap-4">
            <CollapsibleSection
              id="compras-programadas-online"
              title={t('platform.groupBuy.tabOnline')}
              open={onlineOpen}
              onToggle={() => setOnlineOpen((v) => !v)}
            >
              <GrupoDeCompras embedded hideHeader destination="online" />
            </CollapsibleSection>

            <CollapsibleSection
              id="compras-programadas-fisica"
              title={t('platform.groupBuy.tabPhysical')}
              open={fisicaOpen}
              onToggle={() => setFisicaOpen((v) => !v)}
            >
              <GrupoDeCompras embedded hideHeader destination="physical" />
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </>
  )
}

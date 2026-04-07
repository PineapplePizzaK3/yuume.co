import { Link, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSiteLocale } from '../hooks/useSiteLocale'
import {
  LOCALE_EN,
  LOCALE_PT_BR,
  localizedRoutePath,
} from '../lib/localeRoutes'
import { FlagIcon } from './FlagIcon'

/** SVG flags render everywhere; emoji regional flags break on Windows (show as “BR”, “US”). */
function LangFlag({ code, size, title }) {
  return (
    <span aria-hidden className="inline-flex shrink-0" title={title}>
      <FlagIcon code={code} size={size} />
    </span>
  )
}

const LANG_OPTIONS = [
  {
    locale: LOCALE_PT_BR,
    labelKey: 'nav.langPt',
    flagCode: 'BR',
    flagTitleKey: 'platform.triCurrency.flagBr',
  },
  {
    locale: LOCALE_EN,
    labelKey: 'nav.langEn',
    flagCode: 'US',
    flagTitleKey: 'platform.triCurrency.flagUs',
  },
]

/**
 * Desktop: hover opens menu; shows current language + flag on the control.
 * @param {object} props
 * @param {'dropdown'} props.variant
 */
export function LanguageSwitcherDropdown() {
  const { t } = useTranslation()
  const location = useLocation()
  const siteLocale = useSiteLocale()
  const pathWithSearch = location.pathname + location.search

  const options = useMemo(
    () =>
      LANG_OPTIONS.map((opt) => ({
        ...opt,
        label: t(opt.labelKey),
        to: localizedRoutePath(pathWithSearch, opt.locale),
      })),
    [pathWithSearch, t],
  )

  const current = options.find((o) => o.locale === siteLocale) ?? options[0]

  return (
    <div className="group relative flex items-center self-stretch">
      <button
        type="button"
        className="flex h-full max-h-9 items-center gap-1.5 rounded-lg border border-earth-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-earth-800 transition hover:bg-earth-100"
        aria-haspopup="menu"
        aria-label={`${current.label} — ${t('nav.langMenuAria')}`}
      >
        <LangFlag code={current.flagCode} size={18} title={t(current.flagTitleKey)} />
        <span>{current.label}</span>
        <svg
          className="h-3.5 w-3.5 shrink-0 text-earth-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className="pointer-events-none invisible absolute right-0 top-full z-[60] min-w-[11rem] pt-1.5 opacity-0 transition-[opacity,visibility] duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100"
        role="menu"
        aria-label={t('nav.langMenuAria')}
      >
        <div className="overflow-hidden rounded-lg border border-earth-200 bg-white py-1 shadow-lg">
          {options.map((opt) => {
            const active = opt.locale === siteLocale
            const row = (
              <>
                <LangFlag code={opt.flagCode} size={20} title={t(opt.flagTitleKey)} />
                {opt.label}
              </>
            )
            if (active) {
              return (
                <span
                  key={opt.locale}
                  role="menuitem"
                  aria-current="true"
                  className="flex cursor-default items-center gap-2 bg-earth-100 px-3 py-2 text-sm font-medium text-earth-900"
                >
                  {row}
                </span>
              )
            }
            return (
              <Link
                key={opt.locale}
                to={opt.to}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm text-earth-700 transition hover:bg-earth-50 hover:text-earth-900"
              >
                {row}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Mobile drawer / footer: list all languages with flags; highlights current.
 * @param {object} props
 * @param {() => void} [props.onNavigate]
 * @param {string} [props.className]
 */
export function LanguageSwitcherInline({ onNavigate, className = '' }) {
  const { t } = useTranslation()
  const location = useLocation()
  const siteLocale = useSiteLocale()
  const pathWithSearch = location.pathname + location.search

  const options = useMemo(
    () =>
      LANG_OPTIONS.map((opt) => ({
        ...opt,
        label: t(opt.labelKey),
        to: localizedRoutePath(pathWithSearch, opt.locale),
      })),
    [pathWithSearch, t],
  )

  return (
    <div
      className={`flex flex-col gap-1 ${className}`.trim()}
      role="group"
      aria-label={t('nav.langMenuAria')}
    >
      {options.map((opt) => {
        const active = opt.locale === siteLocale
        const inner = (
          <>
            <LangFlag code={opt.flagCode} size={20} title={t(opt.flagTitleKey)} />
            {opt.label}
          </>
        )
        if (active) {
          return (
            <span
              key={opt.locale}
              className="flex items-center gap-2 rounded-lg bg-earth-200 px-3 py-2 text-sm font-medium text-earth-900"
              aria-current="page"
            >
              {inner}
            </span>
          )
        }
        return (
          <Link
            key={opt.locale}
            to={opt.to}
            onClick={() => onNavigate?.()}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-earth-700 transition hover:bg-earth-100 hover:text-earth-900"
          >
            {inner}
          </Link>
        )
      })}
    </div>
  )
}

/**
 * Footer: compact horizontal row, current language shown first in label style.
 */
export function LanguageSwitcherFooterRow() {
  const { t } = useTranslation()
  const location = useLocation()
  const siteLocale = useSiteLocale()
  const pathWithSearch = location.pathname + location.search

  const options = useMemo(
    () =>
      LANG_OPTIONS.map((opt) => ({
        ...opt,
        label: t(opt.labelKey),
        to: localizedRoutePath(pathWithSearch, opt.locale),
      })),
    [pathWithSearch, t],
  )

  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={t('nav.langMenuAria')}>
      <span className="text-xs font-semibold uppercase tracking-wide text-earth-500">
        {t('nav.langMenuAria')}
      </span>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {options.map((opt) => {
          const active = opt.locale === siteLocale
          return (
            <Link
              key={opt.locale}
              to={opt.to}
              className={`inline-flex items-center gap-1.5 text-sm transition ${
                active
                  ? 'font-semibold text-earth-900'
                  : 'text-earth-600 hover:text-earth-900'
              }`}
              aria-current={active ? 'true' : undefined}
            >
              <LangFlag code={opt.flagCode} size={18} title={t(opt.flagTitleKey)} />
              {opt.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

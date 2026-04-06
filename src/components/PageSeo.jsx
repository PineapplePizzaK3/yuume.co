import { Helmet } from 'react-helmet-async'
import { alternateUrls, LOCALE_EN } from '../lib/localeRoutes'
import { useSiteLocale } from '../hooks/useSiteLocale'

function absoluteSiteOrigin() {
  const env = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '')
  if (env) return env
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/**
 * @param {object} props
 * @param {keyof import('../lib/localeRoutes').ROUTES} props.routeKey — for hreflang alternates
 * @param {string | null} [props.title] — omit (null) to only emit alternates/canonical (use Helmet for title elsewhere)
 * @param {string} [props.description]
 * @param {boolean} [props.noindex]
 */
export function PageSeo({ routeKey, title, description, noindex = false }) {
  const locale = useSiteLocale()
  const origin = absoluteSiteOrigin()
  const { ptBR, en } = alternateUrls(routeKey)
  const canonical = locale === LOCALE_EN ? en : ptBR
  const htmlLang = locale === LOCALE_EN ? 'en' : 'pt-BR'
  const ogLocale = locale === LOCALE_EN ? 'en_US' : 'pt_BR'
  const ogAlt = locale === LOCALE_EN ? 'pt_BR' : 'en_US'

  return (
    <Helmet htmlAttributes={{ lang: htmlLang }}>
      {title != null && title !== '' ? <title>{title}</title> : null}
      {description ? <meta name="description" content={description} /> : null}
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
      {origin && canonical.startsWith('http') ? <link rel="canonical" href={canonical} /> : null}
      {!noindex && origin && ptBR.startsWith('http') && en.startsWith('http') ? (
        <>
          <link rel="alternate" hrefLang="pt-BR" href={ptBR} />
          <link rel="alternate" hrefLang="en" href={en} />
          <link rel="alternate" hrefLang="x-default" href={`${origin}/`} />
        </>
      ) : null}
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:locale:alternate" content={ogAlt} />
    </Helmet>
  )
}

import { Link } from 'react-router-dom'
import { localizedPath } from '../lib/localeRoutes'
import { useSiteLocale } from '../hooks/useSiteLocale'

/**
 * @param {object} props
 * @param {string} props.toRoute — key from ROUTES
 * @param {string} [props.search] — e.g. "?tab=pedidos"
 * @param {React.ReactNode} props.children
 */
export function LocalizedLink({ toRoute, search = '', children, ...rest }) {
  const locale = useSiteLocale()
  const to = localizedPath(toRoute, locale, search)
  return (
    <Link to={to} {...rest}>
      {children}
    </Link>
  )
}

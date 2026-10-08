import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSiteLocale } from '../hooks/useSiteLocale'
import { localizedPath } from '../lib/localeRoutes'

export function ProdutosAliasRedirect() {
  const { isAuthenticated, loading } = useAuth()
  const locale = useSiteLocale()
  if (loading) return null
  return (
    <Navigate
      to={localizedPath(isAuthenticated ? 'appLoja' : 'lojaPublicVitrine', locale)}
      replace
    />
  )
}

export function LocaleAliasRedirect({ toRoute, queryAndHash = '' }) {
  const locale = useSiteLocale()
  return <Navigate to={localizedPath(toRoute, locale, queryAndHash)} replace />
}

/**
 * AdminRoute - Wraps pages that require admin role.
 * Redirects to /app/dashboard if user is not admin.
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { getLocaleFromPathname, localizedPath } from '../lib/localeRoutes'

export function AdminRoute({ children }) {
  const { t } = useTranslation()
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const { pathname } = useLocation()
  const locale = getLocaleFromPathname(pathname)

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-earth-600">{t('loading')}</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={localizedPath('login', locale)} replace />
  }

  if (!isAdmin) {
    return <Navigate to={localizedPath('appDashboard', locale)} replace />
  }

  return children
}

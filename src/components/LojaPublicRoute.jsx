/**
 * Rota /loja: espelho da loja para quem não está logado.
 * Se logado, redireciona para /app/loja (loja completa dentro da plataforma).
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getLocaleFromPathname, localizedPath } from '../lib/localeRoutes'
import LojaHub from '../pages/platform/LojaHub'

export default function LojaPublicRoute() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const locale = getLocaleFromPathname(pathname)
  if (user) return <Navigate to={localizedPath('appLoja', locale)} replace />
  return <LojaHub publicMode />
}

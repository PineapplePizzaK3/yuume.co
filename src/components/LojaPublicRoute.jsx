/**
 * Rota /loja: espelho da loja para quem não está logado.
 * Se logado, redireciona para /app/loja (loja completa dentro da plataforma).
 */
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LojaMirror from '../pages/LojaMirror'

export default function LojaPublicRoute() {
  const { user } = useAuth()
  if (user) return <Navigate to="/app/loja" replace />
  return <LojaMirror />
}

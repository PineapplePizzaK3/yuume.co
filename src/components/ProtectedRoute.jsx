/**
 * ProtectedRoute - Wraps pages that require authentication.
 * Redirects to /login if user is not authenticated.
 * Se o usuário tem 2FA ativo mas não verificou nesta sessão, exibe MFAGate.
 */
import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { MFAGate } from './MFAGate'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, session } = useAuth()
  const location = useLocation()
  const [aalCheck, setAalCheck] = useState({ loading: true, needsMFA: false })

  useEffect(() => {
    if (!isAuthenticated || !session) {
      setAalCheck({ loading: false, needsMFA: false })
      return
    }
    let cancelled = false
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setAalCheck({ loading: false, needsMFA: false })
        return
      }
      const needsMFA = data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2'
      setAalCheck({ loading: false, needsMFA: !!needsMFA })
    })
    return () => { cancelled = true }
  }, [isAuthenticated, session])

  if (loading || aalCheck.loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-earth-600">Carregando...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (aalCheck.needsMFA) {
    return <MFAGate />
  }

  return children
}

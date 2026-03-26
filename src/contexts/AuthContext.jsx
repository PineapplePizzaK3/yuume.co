/**
 * AuthContext - Estado de autenticação centralizado.
 * Um único provedor garante que Navbar, rotas e demais componentes
 * vejam o mesmo estado (ex.: ao deslogar, todos atualizam).
 */
import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile } from '../services/profileService'

const AuthContext = createContext(null)
const PROFILE_CACHE_KEY = 'platform_profile_cache_v1'

function readCachedProfile(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    return cache?.[userId] ?? null
  } catch {
    return null
  }
}

function writeCachedProfile(userId, profile) {
  if (!userId || !profile) return
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[userId] = profile
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // noop
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const safetyTimeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 3000)

    const init = async () => {
      try {
        // Não force timeout curto aqui: se a rede/Supabase estiver “acordando”,
        // um timeout falso derruba a sessão e parece que o usuário foi deslogado.
        const session = (await supabase.auth.getSession()).data.session
        if (cancelled) return
        setSession(session ?? null)
        setUser(session?.user ?? null)
        if (session?.user?.id) {
          const profilePromise = getProfile(session.user.id).then((r) => r.data)
          const profileTimeout = new Promise((resolve) =>
            setTimeout(() => resolve(null), 2000)
          )
          const data = await Promise.race([profilePromise, profileTimeout])
          if (!cancelled) {
            if (data) {
              setProfile(data)
              writeCachedProfile(session.user.id, data)
            } else {
              const cached = readCachedProfile(session.user.id)
              if (cached) setProfile(cached)
            }
          }
        } else {
          setProfile(null)
        }
      } catch (e) {
        console.warn('Auth init:', e?.message ?? e)
        // Não zere a sessão por erro transitório (offline/timeout). Mantém estado atual.
      } finally {
        clearTimeout(safetyTimeout)
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
      clearTimeout(safetyTimeout)
    }
  }, [])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const prevUserId = user?.id
      setSession(session)
      setUser(session?.user ?? null)
      try {
        if (session?.user?.id) {
          const { data, error } = await getProfile(session.user.id)
          if (data) {
            setProfile(data)
            writeCachedProfile(session.user.id, data)
          } else if (error) {
            const cached = readCachedProfile(session.user.id)
            if (cached) {
              setProfile(cached)
            } else if (prevUserId !== session.user.id) {
              // Avoid keeping stale profile from another user.
              setProfile(null)
            }
          } else if (prevUserId !== session.user.id) {
            setProfile(null)
          }
        } else {
          setProfile(null)
        }
      } catch (e) {
        if (!session?.user?.id) {
          setProfile(null)
        } else {
          const cached = readCachedProfile(session.user.id)
          if (cached) setProfile(cached)
        }
      } finally {
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [user?.id])

  const refreshProfile = async () => {
    if (!user?.id) return
    const { data } = await getProfile(user.id)
    if (data) {
      setProfile(data)
      writeCachedProfile(user.id, data)
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signUp = async (email, password, options = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: options.userMetadata },
    })
    return { data, error }
  }

  const signOut = async () => {
    setUser(null)
    setSession(null)
    setProfile(null)
    await supabase.auth.signOut()
  }

  const signInWithOAuth = async (provider) => {
    // Para OAuth, use sempre o origin atual.
    const siteUrl = window.location.origin
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${siteUrl}/app/complete-social-profile`,
      },
    })
    return { data, error }
  }

  const providers = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers
    : []
  const isSocialUser = providers.includes('google') || providers.includes('facebook')
  const socialOnboardingCompleted = user?.user_metadata?.social_onboarding_completed === true
  // Evita falso positivo durante lentidão do backend:
  // a obrigatoriedade depende do flag de onboarding concluído.
  const needsSocialOnboarding = !!user && isSocialUser && !socialOnboardingCompleted

  const value = {
    user,
    session,
    profile,
    loading,
    isAuthenticated: !!user,
    isAdmin: profile?.role === 'admin',
    needsSocialOnboarding,
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

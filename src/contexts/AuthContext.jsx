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
    const MAX_WAIT = 2500
    const safetyTimeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 3000)

    const init = async () => {
      try {
        const sessionPromise = supabase.auth.getSession().then((r) => r.data.session)
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve(null), MAX_WAIT)
        )
        const session = await Promise.race([sessionPromise, timeoutPromise])
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
        if (!cancelled) {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
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
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${siteUrl}/app/dashboard`,
      },
    })
    return { data, error }
  }

  const value = {
    user,
    session,
    profile,
    loading,
    isAuthenticated: !!user,
    isAdmin: profile?.role === 'admin',
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

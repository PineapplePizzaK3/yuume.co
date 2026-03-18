/**
 * Supabase client configuration.
 * Uses anon key only - never expose service_role key in frontend.
 * RLS policies enforce server-side security.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Usar placeholders quando credenciais estiverem ausentes para evitar crash da aplicação.
// Auth e outras funções não funcionarão até as credenciais serem configuradas.
const url = supabaseUrl || 'https://placeholder.supabase.co'
const key = supabaseAnonKey || 'placeholder-anon-key'
const REQUEST_TIMEOUT_MS = 25000

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Tempo esgotado ao conectar com o servidor.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env'
  )
}

const storage =
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : undefined

export const supabase = createClient(url, key, {
  auth: {
    // Mantém o usuário logado entre recarregamentos/sessões
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage,
  },
  global: {
    fetch: fetchWithTimeout,
  },
})

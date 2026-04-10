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
/** Edge Functions (ex.: catalog-search) podem demorar ao agregar lojas externas. */
const FUNCTIONS_REQUEST_TIMEOUT_MS = 120000

function resolveRequestUrl(input) {
  if (typeof input === 'string') return input
  if (input && typeof input === 'object' && 'url' in input && typeof input.url === 'string') {
    return input.url
  }
  return ''
}

/**
 * Avoids sporadic browser LockManager aborts:
 * "AbortError: Lock broken by another request with the 'steal' option."
 * We run auth critical sections directly in the same tab.
 */
async function authBestEffortLock(_name, _acquireTimeout, fn) {
  return await fn()
}

async function fetchWithTimeout(input, init = {}) {
  const ms = resolveRequestUrl(input).includes('/functions/v1/')
    ? FUNCTIONS_REQUEST_TIMEOUT_MS
    : REQUEST_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ms)
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
    lock: authBestEffortLock,
  },
  global: {
    fetch: fetchWithTimeout,
  },
})

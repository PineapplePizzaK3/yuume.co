const DB_TIMEOUT_MS = 25000
const DB_SLOW_MS = 1200

export async function withDbTimeout(promise, ms = DB_TIMEOUT_MS, label = 'db_query') {
  const startedAt = Date.now()
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operação demorou demais. Tente novamente.')), ms)
  )
  try {
    return await Promise.race([promise, timeout])
  } finally {
    const elapsed = Date.now() - startedAt
    if (import.meta.env.DEV && elapsed >= DB_SLOW_MS) {
      // Ajuda a identificar gargalos reais de Supabase durante desenvolvimento.
      console.warn(`[DB SLOW] ${label} levou ${elapsed}ms`)
    }
  }
}

export function toServiceError(error) {
  if (error && typeof error === 'object' && 'message' in error) {
    return error
  }
  return { message: String(error ?? 'Erro inesperado') }
}

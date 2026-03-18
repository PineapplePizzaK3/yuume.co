const DB_TIMEOUT_MS = 25000

export async function withDbTimeout(promise, ms = DB_TIMEOUT_MS) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operação demorou demais. Tente novamente.')), ms)
  )
  return Promise.race([promise, timeout])
}

export function toServiceError(error) {
  if (error && typeof error === 'object' && 'message' in error) {
    return error
  }
  return { message: String(error ?? 'Erro inesperado') }
}

/**
 * Utilitários para imagens de produtos.
 * Imagens do Supabase Storage podem ser otimizadas via Image Transformation (Plano Pro+).
 * Em planos free, a URL original é usada.
 */

const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/

/**
 * Verifica se a URL é do Supabase Storage e extrai bucket e path.
 * @param {string} url - URL pública da imagem
 * @returns {{ bucket: string, path: string } | null}
 */
function parseSupabaseStorageUrl(url) {
  if (!url || typeof url !== 'string') return null
  const match = url.match(SUPABASE_STORAGE_PATTERN)
  if (!match) return null
  return { bucket: match[1], path: match[2] }
}

/**
 * Gera URL otimizada para thumbnail/card (Supabase Image Transformation).
 * Se a URL não for do Supabase ou o plano não suportar transform, retorna a URL original.
 *
 * Por que a imagem pode parecer de baixa qualidade:
 * - Upscaling: imagem pequena esticada para área grande → pixelada
 * - Downscaling excessivo: qualidade de interpolação do browser
 * - Resolução inadequada: pedir dimensões adequadas ao display melhora nitidez
 *
 * @param {string} url - URL original da imagem
 * @param {{ width?: number, height?: number, quality?: number }} options - Dimensões para o card
 * @returns {string} URL otimizada ou original
 */
export function getOptimizedImageUrl(url, options = {}) {
  const { width = 400, height = 320, quality = 85 } = options
  const parsed = parseSupabaseStorageUrl(url)
  if (!parsed) return url

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) return url

  // URL de transform: /storage/v1/render/image/public/bucket/path?width=&height=&quality=
  const base = supabaseUrl.replace(/\/$/, '')
  const params = new URLSearchParams()
  params.set('width', String(width))
  params.set('height', String(height))
  params.set('quality', String(quality))
  return `${base}/storage/v1/render/image/public/${parsed.bucket}/${parsed.path}?${params.toString()}`
}

/**
 * URL para thumbnail de card (menor, carrega rápido).
 */
export function getCardThumbnailUrl(url) {
  return getOptimizedImageUrl(url, { width: 320, height: 256, quality: 85 })
}

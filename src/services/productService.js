/**
 * Product service - produtos da loja virtual.
 * Usuários veem apenas produtos ativos; admin pode CRUD.
 */
import { supabase } from '../lib/supabase'

/** Timeout em ms - Supabase free tier pode levar ~30–60s ao acordar após pausa */
const DB_TIMEOUT = 60000

async function withTimeout(promise, ms = DB_TIMEOUT) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operação demorou demais. Tente novamente.')), ms)
  )
  return Promise.race([promise, timeout])
}

function toError(err) {
  return err instanceof Error ? err : { message: String(err) }
}

export async function getProducts() {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .is('purchase_group_id', null)
        .order('created_at', { ascending: false })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toError(e) }
  }
}

/** Produtos de um grupo de compras */
export async function getPurchaseGroupProducts(groupId) {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('get_purchase_group_products', { p_group_id: groupId })
    )
    const list = Array.isArray(data) ? data : (data ?? [])
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toError(e) }
  }
}

/** Admin: usa RPC para contornar problemas de acesso direto à tabela products */
export async function getProductsAdmin() {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('admin_list_products')
    )
    const list = Array.isArray(data) ? data : (data ?? [])
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toError(e) }
  }
}

/** Admin: usa RPC para criar produto */
export async function createProduct(product) {
  try {
    const imageUrls = Array.isArray(product.image_urls) ? product.image_urls : []
    const payload = {
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      weight_kg: product.weight_kg ?? 0,
      image_url: product.image_url ?? (imageUrls[0] || ''),
      image_urls: imageUrls,
      is_active: product.is_active ?? true,
      ...(product.hasOwnProperty('stock_quantity') && { stock_quantity: product.stock_quantity ?? null }),
    }
    const { data, error } = await withTimeout(
      supabase.rpc('admin_create_product', { p_product: payload })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toError(e) }
  }
}

/** Admin: usa RPC para atualizar produto */
export async function updateProduct(id, product) {
  try {
    const imageUrls = Array.isArray(product.image_urls) ? product.image_urls : []
    const payload = {
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      weight_kg: product.weight_kg ?? 0,
      image_url: product.image_url ?? (imageUrls[0] || ''),
      image_urls: imageUrls,
      is_active: product.is_active ?? true,
      ...(product.hasOwnProperty('stock_quantity') && { stock_quantity: product.stock_quantity ?? null }),
    }
    const { data, error } = await withTimeout(
      supabase.rpc('admin_update_product', { p_id: id, p_product: payload })
    )
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toError(e) }
  }
}

/** Admin: usa RPC para remover produto */
export async function deleteProduct(id) {
  try {
    const { error } = await withTimeout(
      supabase.rpc('admin_delete_product', { p_id: id })
    )
    return { error }
  } catch (e) {
    return { error: toError(e) }
  }
}

const PRODUCT_IMAGES_BUCKET = 'product-images'

/**
 * Upload de imagem para pedido (Personal Shopping).
 * Usa bucket product-images com path orders/{userId}/
 * @returns {{ data: string | null, error }}
 */
export async function uploadOrderAttachment(file, userId) {
  if (!file || !file.type?.startsWith('image/')) {
    return { data: null, error: { message: 'Selecione um arquivo de imagem.' } }
  }
  if (!userId) return { data: null, error: { message: 'Usuário não identificado.' } }
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `orders/${userId}/${safeName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) return { data: null, error: uploadError }

    const { data: urlData } = supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(uploadData.path)

    return { data: urlData?.publicUrl ?? null, error: null }
  } catch (e) {
    return { data: null, error: toError(e) }
  }
}

/**
 * Admin: upload de imagem para o bucket product-images.
 * Retorna a URL pública da imagem ou erro.
 * @param {File} file - arquivo de imagem (ex.: do input type="file")
 * @returns {Promise<{ data: string | null, error }>} - data = URL pública
 */
export async function uploadProductImage(file) {
  if (!file || !file.type?.startsWith('image/')) {
    return { data: null, error: { message: 'Selecione um arquivo de imagem (JPEG, PNG, GIF ou WebP).' } }
  }
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${safeName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      return { data: null, error: uploadError }
    }

    const { data: urlData } = supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(uploadData.path)

    return { data: urlData?.publicUrl ?? null, error: null }
  } catch (e) {
    return { data: null, error: toError(e) }
  }
}

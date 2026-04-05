/**
 * Product service - produtos da loja virtual.
 * Usuários veem apenas produtos ativos; admin pode CRUD.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

export async function getProducts() {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('list_store_products', {
        p_limit: 500,
        p_offset: 0,
      })
    , 60000, 'products:getProducts')
    const list = Array.isArray(data) ? data : (data ?? [])
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/** Produtos de um grupo de compras */
export async function getPurchaseGroupProducts(groupId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('get_purchase_group_products', { p_group_id: groupId })
    , 60000, 'products:getPurchaseGroupProducts')
    const list = Array.isArray(data) ? data : (data ?? [])
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/** Admin: usa RPC para contornar problemas de acesso direto à tabela products */
export async function getProductsAdmin(limit = 500, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_list_products', {
        p_limit: limit,
        p_offset: offset,
      })
    , 60000, 'products:getProductsAdmin')
    const list = Array.isArray(data) ? data : (data ?? [])
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/** Admin: lista produtos publicados na loja virtual (vínculo). */
export async function getStoreProductsAdmin(limit = 500, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_list_store_products', {
        p_limit: limit,
        p_offset: offset,
      })
    , 60000, 'products:getStoreProductsAdmin')
    const list = Array.isArray(data) ? data : (data ?? [])
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/** Admin: publica produto-base na loja virtual. */
export async function addProductToStoreAdmin(productId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_add_product_to_store', {
        p_product_id: productId,
      })
    , 60000, 'products:addProductToStoreAdmin')
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/** Admin: remove produto da loja virtual sem apagar da base. */
export async function removeProductFromStoreAdmin(productId) {
  try {
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_remove_product_from_store', {
        p_product_id: productId,
      })
    , 60000, 'products:removeProductFromStoreAdmin')
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
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
      ...(Object.prototype.hasOwnProperty.call(product, 'item_condition') && { item_condition: product.item_condition }),
      ...(product.hasOwnProperty('stock_quantity') && { stock_quantity: product.stock_quantity ?? null }),
    }
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_create_product', { p_product: payload })
    , 60000, 'products:createProduct')
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
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
      ...(Object.prototype.hasOwnProperty.call(product, 'item_condition') && { item_condition: product.item_condition }),
      ...(product.hasOwnProperty('stock_quantity') && { stock_quantity: product.stock_quantity ?? null }),
    }
    const { data, error } = await withDbTimeout(
      supabase.rpc('admin_update_product', { p_id: id, p_product: payload })
    , 60000, 'products:updateProduct')
    return { data: data ?? null, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/** Admin: usa RPC para remover produto */
export async function deleteProduct(id) {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('admin_delete_product', { p_id: id })
    , 60000, 'products:deleteProduct')
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
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
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    const sessionUserId = userData?.user?.id
    if (userErr || !sessionUserId) {
      return { data: null, error: { message: 'Sessão inválida. Faça login novamente.' } }
    }
    if (userId && userId !== sessionUserId) {
      return { data: null, error: { message: 'Usuário da sessão não confere.' } }
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `orders/${sessionUserId}/${safeName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) return { data: null, error: uploadError }

    const { data: urlData } = supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(uploadData.path)

    return { data: urlData?.publicUrl ?? null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Upload de comprovante PIX para recarga de carteira.
 * Path: pix-comprovantes/{userId}/topup-{requestId}-{timestamp}.ext
 */
export async function uploadWalletTopupComprovante(file, userId, requestId) {
  if (!file || !file.type?.startsWith('image/')) {
    return { data: null, error: { message: 'Selecione uma imagem do comprovante (JPG, PNG).' } }
  }
  if (!userId || !requestId) return { data: null, error: { message: 'Dados obrigatórios ausentes.' } }
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeName = `topup-${requestId}-${Date.now()}.${ext}`
    const path = `pix-comprovantes/${userId}/${safeName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) return { data: null, error: uploadError }

    const { data: urlData } = supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(uploadData.path)

    return { data: urlData?.publicUrl ?? null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
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
    return { data: null, error: toServiceError(e) }
  }
}

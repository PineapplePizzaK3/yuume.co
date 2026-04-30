/**
 * Log service - registra ações do admin.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'

/**
 * Registra uma ação do admin.
 * @param {string} action - Ex: 'order_approve', 'product_create', 'group_delete'
 * @param {string} [entityType] - Ex: 'order', 'product', 'purchase_group'
 * @param {string} [entityId] - UUID do registro afetado
 * @param {object} [details] - Dados extras (ex: { status: 'approved' })
 */
export async function logAdminAction(action, entityType = null, entityId = null, details = {}) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_insert_log', {
        p_action: action,
        p_entity_type: entityType,
        p_entity_id: entityId || null,
        p_details: details,
      })
    )
    return { data, error }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

/**
 * Lista logs do admin (ações dos administradores).
 */
export async function getAdminLogs(limit = 100, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_list_logs', { p_limit: limit, p_offset: offset })
    )
    const list = Array.isArray(data) ? data : (data ?? [])
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Lista logs de atividades dos usuários (pedidos, carrinho, perfil).
 */
export async function getUserLogs(limit = 100, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_list_user_logs', { p_limit: limit, p_offset: offset })
    )
    const list = Array.isArray(data) ? data : (data ?? [])
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Lista logs de autenticação (registro e login de usuários).
 */
export async function getAuthLogs(limit = 100, offset = 0) {
  try {
    const { data, error } = await withDbTimeout(
      callAdminRpc('admin_list_auth_logs', { p_limit: limit, p_offset: offset })
    )
    const list = Array.isArray(data) ? data : (data ?? [])
    return { data: list, error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

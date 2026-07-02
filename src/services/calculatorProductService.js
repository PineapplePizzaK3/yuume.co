import { callAdminRpc } from './adminRpcService'

export async function listCalculatorProductsAdmin({ limit = 200, offset = 0 } = {}) {
  const { data, error } = await callAdminRpc('admin_list_calculator_products', {
    p_limit: limit,
    p_offset: offset,
  })
  return { data: Array.isArray(data) ? data : [], error }
}

export async function createCalculatorProductAdmin(payload) {
  const { data, error } = await callAdminRpc('admin_create_calculator_product', {
    p_payload: payload || {},
  })
  return { data, error }
}

export async function updateCalculatorProductAdmin(id, payload) {
  const { data, error } = await callAdminRpc('admin_update_calculator_product', {
    p_id: id,
    p_payload: payload || {},
  })
  return { data, error }
}

export async function deleteCalculatorProductAdmin(id) {
  const { data, error } = await callAdminRpc('admin_delete_calculator_product', {
    p_id: id,
  })
  return { data, error }
}

import { callAdminRpc } from './adminRpcService'

export async function listCalculatorBatchesAdmin({ limit = 200, offset = 0 } = {}) {
  const { data, error } = await callAdminRpc('admin_list_calculator_batches', {
    p_limit: limit,
    p_offset: offset,
  })
  return { data: Array.isArray(data) ? data : [], error }
}

export async function createCalculatorBatchAdmin(payload) {
  const { data, error } = await callAdminRpc('admin_create_calculator_batch', {
    p_payload: payload || {},
  })
  return { data, error }
}

export async function updateCalculatorBatchAdmin(id, payload) {
  const { data, error } = await callAdminRpc('admin_update_calculator_batch', {
    p_id: id,
    p_payload: payload || {},
  })
  return { data, error }
}

export async function deleteCalculatorBatchAdmin(id) {
  const { data, error } = await callAdminRpc('admin_delete_calculator_batch', {
    p_id: id,
  })
  return { data, error }
}

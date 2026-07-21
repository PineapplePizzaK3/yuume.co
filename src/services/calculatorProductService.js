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

export async function duplicateCalculatorProductAdmin(product) {
  const source = product || {}
  const payload = {
    name: `Cópia de ${String(source.name || 'Produto').trim()}`,
    notes: source.notes || null,
    base_cost_yen: source.base_cost_yen,
    declared_value_yen: source.declared_value_yen,
    weight_grams: source.weight_grams,
    shipping_mode: source.shipping_mode,
    direct_method: source.direct_method,
    lote_kg: source.lote_kg,
    customs_factor: source.customs_factor,
    brl_per_jpy: source.brl_per_jpy,
    margin_percent: source.margin_percent,
    comparative_price_brl: source.comparative_price_brl,
    packaging_brl: source.packaging_brl,
    local_shipping_brl: source.local_shipping_brl,
    international_shipping_yen: source.international_shipping_yen,
    landed_cost_yen: source.landed_cost_yen,
    landed_cost_brl: source.landed_cost_brl,
    final_price_brl: source.final_price_brl,
    calculation_snapshot: source.calculation_snapshot || {},
  }
  return createCalculatorProductAdmin(payload)
}

export async function listCalculatorProductTemplatesAdmin({ limit = 200, offset = 0 } = {}) {
  const { data, error } = await callAdminRpc('admin_list_calculator_product_templates', {
    p_limit: limit,
    p_offset: offset,
  })
  return { data: Array.isArray(data) ? data : [], error }
}

export async function createCalculatorProductTemplateAdmin(name, templateData) {
  const { data, error } = await callAdminRpc('admin_create_calculator_product_template', {
    p_payload: {
      name,
      template_data: templateData || {},
    },
  })
  return { data, error }
}

export async function deleteCalculatorProductTemplateAdmin(id) {
  const { data, error } = await callAdminRpc('admin_delete_calculator_product_template', {
    p_id: id,
  })
  return { data, error }
}

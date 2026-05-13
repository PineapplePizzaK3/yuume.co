import { supabase } from '../lib/supabase'
import { toServiceError, withDbTimeout } from '../lib/dbGuard'
import { callAdminRpc } from './adminRpcService'

const EMAIL_TEMPLATES_SETTINGS_KEY = 'admin_email_templates_v1'

export async function getAdminEmailTemplates() {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('system_settings')
        .select('value, updated_at')
        .eq('key', EMAIL_TEMPLATES_SETTINGS_KEY)
        .maybeSingle()
    )
    if (error) return { data: null, error }
    return { data: data?.value || null, error: null }
  } catch (e) {
    return { data: null, error: toServiceError(e) }
  }
}

export async function saveAdminEmailTemplates(payload) {
  try {
    const safePayload = payload && typeof payload === 'object' ? payload : {}
    const { error } = await withDbTimeout(
      callAdminRpc('admin_save_system_settings', {
        p_payload: {
          [EMAIL_TEMPLATES_SETTINGS_KEY]: safePayload,
        },
      })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}


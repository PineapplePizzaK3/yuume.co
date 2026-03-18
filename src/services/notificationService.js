/**
 * Notification service - notificações do usuário.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

export async function getMyNotifications(userId, limit = 20) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(100, limit)))
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

export async function markNotificationRead(notificationId) {
  try {
    const { error } = await withDbTimeout(
      supabase.rpc('mark_notification_read', { p_notification_id: notificationId })
    )
    return { error }
  } catch (e) {
    return { error: toServiceError(e) }
  }
}


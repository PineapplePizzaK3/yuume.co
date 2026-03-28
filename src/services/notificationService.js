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

export async function getMyAdminNotifications(userId, limit = 50) {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .like('type', 'admin_%')
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(200, limit)))
    )
    if (error || !Array.isArray(data) || data.length === 0) {
      return { data: data ?? [], error }
    }

    const requesterIds = Array.from(new Set(
      data
        .map((n) => n?.meta?.user_id)
        .filter((v) => typeof v === 'string' && v.trim().length > 0)
    ))

    if (requesterIds.length === 0) {
      return { data, error: null }
    }

    const { data: profiles, error: profilesError } = await withDbTimeout(
      supabase
        .from('profiles')
        .select('id,name,email')
        .in('id', requesterIds)
    )

    if (profilesError) {
      return { data, error: null }
    }

    const profileById = new Map((profiles || []).map((p) => [p.id, p]))
    const enriched = data.map((n) => {
      const requesterId = n?.meta?.user_id
      const profile = requesterId ? profileById.get(requesterId) : null
      if (!requesterId || !profile) return n
      return {
        ...n,
        meta: {
          ...(n.meta || {}),
          requester_name: profile.name || null,
          requester_email: profile.email || null,
        },
      }
    })

    return { data: enriched, error: null }
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


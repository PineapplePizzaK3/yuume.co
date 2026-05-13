import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from './resendEmail.js'

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function authorizeCron(req) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return true
  const auth = String(req.headers?.authorization || '').trim()
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const header = String(req.headers?.['x-cron-secret'] || '').trim()
  return bearer === secret || header === secret
}

function parseCsvEmails(raw) {
  return String(raw || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.includes('@'))
}

function uniqueEmails(values) {
  return Array.from(new Set(values.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean)))
}

function toBool(input) {
  const value = String(input || '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

function getRequesterLabel(notification, requesterById) {
  const meta = notification?.meta || {}
  const requesterId = meta?.user_id ? String(meta.user_id) : ''
  const requester = requesterById.get(requesterId)
  if (requester?.name) return requester.name
  if (requester?.email) return requester.email
  if (meta?.requester_name) return String(meta.requester_name)
  if (meta?.requester_email) return String(meta.requester_email)
  if (requesterId) return requesterId
  return 'usuario nao identificado'
}

function getEntityLabel(meta) {
  if (meta?.order_id) return `pedido ${String(meta.order_id).slice(0, 8)}`
  if (meta?.shipment_id) return `envio ${String(meta.shipment_id).slice(0, 8)}`
  if (meta?.topup_request_id) return `recarga ${String(meta.topup_request_id).slice(0, 8)}`
  return null
}

function buildEmailContent(notifications, requesterById, adminPanelUrl) {
  const subject = `[Admin] ${notifications.length} nova(s) acao(oes) pendente(s)`
  const lines = []
  lines.push('Acoes de usuarios que exigem intervencao do admin:')
  lines.push('')
  for (const n of notifications) {
    const meta = n?.meta || {}
    const requesterLabel = getRequesterLabel(n, requesterById)
    const entity = getEntityLabel(meta)
    const title = n?.title ? String(n.title) : 'Acao do admin necessaria'
    const body = n?.body ? String(n.body) : ''
    const createdAt = n?.created_at ? new Date(n.created_at).toISOString() : ''
    lines.push(`- ${title}`)
    if (body) lines.push(`  detalhe: ${body}`)
    if (entity) lines.push(`  item: ${entity}`)
    lines.push(`  usuario: ${requesterLabel}`)
    if (createdAt) lines.push(`  criado_em: ${createdAt}`)
    lines.push(`  tipo: ${String(n?.type || 'admin_action_required')}`)
    lines.push('')
  }
  lines.push(`Abrir painel: ${adminPanelUrl}`)

  return {
    subject,
    text: lines.join('\n'),
  }
}

async function listPendingAdminNotifications(supabase, limit) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20))
  const { data, error } = await supabase
    .from('notifications')
    .select('id,type,title,body,meta,created_at,read_at')
    .like('type', 'admin_%')
    .order('created_at', { ascending: true })
    .limit(safeLimit)

  if (error) throw new Error(error.message || 'Falha ao listar notificacoes')
  return (data || []).filter((n) => !n?.meta?.email_notified_at)
}

async function loadRequesterProfiles(supabase, notifications) {
  const requesterIds = Array.from(new Set(
    notifications
      .map((n) => n?.meta?.user_id)
      .filter((id) => typeof id === 'string' && id.trim().length > 0)
  ))
  if (requesterIds.length === 0) return new Map()
  const { data } = await supabase
    .from('profiles')
    .select('id,name,email')
    .in('id', requesterIds)
  return new Map((data || []).map((row) => [row.id, row]))
}

async function listAdminRecipients(supabase) {
  const fromEnv = parseCsvEmails(process.env.ADMIN_ALERT_EMAILS)
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'admin')
    .not('email', 'is', null)
  const fromDb = (data || []).map((row) => String(row.email || '').trim().toLowerCase()).filter(Boolean)
  return uniqueEmails([...fromEnv, ...fromDb])
}

async function markNotificationsAsEmailed(supabase, notifications, sentAtIso, recipients) {
  for (const n of notifications) {
    const nextMeta = {
      ...(n.meta || {}),
      email_notified_at: sentAtIso,
      email_notified_to: recipients,
    }
    const { error } = await supabase
      .from('notifications')
      .update({ meta: nextMeta })
      .eq('id', n.id)
    if (error) {
      throw new Error(`Falha ao marcar notificacao ${n.id}: ${error.message || 'erro desconhecido'}`)
    }
  }
}

export async function runAdminActionEmailNotifier(req) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { status: 500, body: { ok: false, error: 'Supabase admin not configured' } }
  }
  if (!authorizeCron(req)) {
    return { status: 401, body: { ok: false, error: 'Unauthorized' } }
  }

  const dryRun = toBool(req.query?.dry_run) || toBool(req.headers?.['x-dry-run'])
  const limit = Number(req.query?.limit || req.headers?.['x-limit'] || 20)
  const adminPanelUrl = String(process.env.ADMIN_PANEL_URL || `${process.env.VITE_SITE_URL || ''}/platform/admin`).trim()

  const notifications = await listPendingAdminNotifications(supabase, limit)
  if (notifications.length === 0) {
    return {
      status: 200,
      body: {
        ok: true,
        sent: false,
        reason: 'no_pending_notifications',
        checked: 0,
      },
    }
  }

  const recipients = await listAdminRecipients(supabase)
  if (recipients.length === 0) {
    return {
      status: 200,
      body: {
        ok: true,
        sent: false,
        reason: 'no_admin_recipients',
        pending_notifications: notifications.length,
      },
    }
  }

  const requesterById = await loadRequesterProfiles(supabase, notifications)
  const email = buildEmailContent(notifications, requesterById, adminPanelUrl)
  if (dryRun) {
    return {
      status: 200,
      body: {
        ok: true,
        dry_run: true,
        pending_notifications: notifications.length,
        recipients,
        subject: email.subject,
      },
    }
  }

  await sendResendEmail({
    to: recipients,
    subject: email.subject,
    text: email.text,
  })

  const sentAtIso = new Date().toISOString()
  await markNotificationsAsEmailed(supabase, notifications, sentAtIso, recipients)

  return {
    status: 200,
    body: {
      ok: true,
      sent: true,
      sent_at: sentAtIso,
      notifications_sent: notifications.length,
      recipients_count: recipients.length,
    },
  }
}

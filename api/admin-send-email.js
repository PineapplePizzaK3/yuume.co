import { getAuthenticatedUser, getSupabaseAdmin, isAdminUser } from '../server-lib/antiFraud.js'
import { sendResendEmail } from '../server-lib/resendEmail.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseBody(req) {
  if (!req?.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return null
    }
  }
  if (typeof req.body === 'object') return req.body
  return {}
}

function normalizeRecipients(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function validateRecipients(recipients) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return 'Campo "to" obrigatorio'
  }
  if (recipients.length > 50) {
    return 'Limite maximo de 50 destinatarios por envio'
  }
  const invalid = recipients.find((email) => !EMAIL_REGEX.test(String(email)))
  if (invalid) {
    return `Email invalido: ${invalid}`
  }
  return ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const { user, error: authError } = await getAuthenticatedUser(req, supabase)
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const isAdmin = await isAdminUser(supabase, user.id)
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const body = parseBody(req)
  if (!body) {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const to = normalizeRecipients(body.to)
  const subject = String(body.subject || '').trim()
  const text = String(body.text || '').trim()
  const html = String(body.html || '').trim()
  const from = String(body.from || '').trim()

  const recipientError = validateRecipients(to)
  if (recipientError) {
    return res.status(400).json({ error: recipientError })
  }
  if (!subject) {
    return res.status(400).json({ error: 'Campo "subject" obrigatorio' })
  }
  if (!text && !html) {
    return res.status(400).json({ error: 'Informe ao menos "text" ou "html"' })
  }

  try {
    const result = await sendResendEmail({
      to,
      subject,
      text,
      html,
      from: from || undefined,
    })
    console.info('admin-send-email:sent', {
      by_user_id: user.id,
      recipients_count: to.length,
      subject_length: subject.length,
      resend_id: result?.id || null,
    })
    return res.status(200).json({
      ok: true,
      id: result?.id || null,
      recipients_count: to.length,
    })
  } catch (err) {
    console.error('admin-send-email:error', {
      by_user_id: user.id,
      error: err?.message || String(err),
    })
    return res.status(500).json({ error: err?.message || 'Failed to send email' })
  }
}

import { getAuthenticatedUser, getSupabaseAdmin, isAdminUser } from '../server-lib/antiFraud.js'
import { getDefaultSupportFrom, sendResendEmail } from '../server-lib/resendEmail.js'
import { buildProfessionalEmailTemplate } from '../server-lib/professionalEmailTemplate.js'

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

function toBool(input) {
  const value = String(input || '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

function normalizeReplyTo(value) {
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
  const replyTo = normalizeReplyTo(body.reply_to || body.replyTo)
  const useProfessionalTemplate = toBool(body.use_professional_template)
  const preheader = String(body.preheader || '').trim()
  const headline = String(body.headline || '').trim()
  const ctaLabel = String(body.cta_label || '').trim()
  const ctaUrl = String(body.cta_url || '').trim()
  const signatureName = String(body.signature_name || '').trim()
  const sendFrom = from || getDefaultSupportFrom()

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
  const invalidReplyTo = replyTo.find((email) => !EMAIL_REGEX.test(String(email)))
  if (invalidReplyTo) {
    return res.status(400).json({ error: `reply_to invalido: ${invalidReplyTo}` })
  }
  if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) {
    return res.status(400).json({ error: 'cta_url deve comecar com http:// ou https://' })
  }

  let finalHtml = html
  let finalText = text
  if (useProfessionalTemplate) {
    const professional = buildProfessionalEmailTemplate({
      subject,
      bodyText: text,
      bodyHtml: html,
      preheader,
      headline,
      ctaLabel,
      ctaUrl,
      signatureName,
      from,
    })
    finalHtml = professional.html
    finalText = professional.text
  }

  try {
    const result = await sendResendEmail({
      to,
      subject,
      text: finalText,
      html: finalHtml,
      from: sendFrom || undefined,
      replyTo,
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

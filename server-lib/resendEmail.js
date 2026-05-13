function trimString(value) {
  return String(value || '').trim()
}

function ensureArray(value) {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

function normalizeRecipients(value) {
  return ensureArray(value)
    .map((item) => trimString(item).toLowerCase())
    .filter(Boolean)
}

function normalizeReplyTo(value) {
  const items = ensureArray(value)
    .map((item) => trimString(item).toLowerCase())
    .filter(Boolean)
  return items
}

export function getDefaultResendFrom() {
  return trimString(process.env.ADMIN_ALERT_FROM || 'Admin Alerts <onboarding@resend.dev>')
}

export async function sendResendEmail({ to, subject, text, html, from, replyTo }) {
  const apiKey = trimString(process.env.RESEND_API_KEY)
  if (!apiKey) {
    throw new Error('RESEND_API_KEY nao configurado')
  }

  const recipients = normalizeRecipients(to)
  if (recipients.length === 0) {
    throw new Error('Destinatario de email obrigatorio')
  }

  const safeSubject = trimString(subject)
  if (!safeSubject) {
    throw new Error('Assunto do email obrigatorio')
  }

  const safeText = trimString(text)
  const safeHtml = trimString(html)
  if (!safeText && !safeHtml) {
    throw new Error('Informe text ou html para enviar email')
  }

  const safeFrom = trimString(from || getDefaultResendFrom())
  const safeReplyTo = normalizeReplyTo(replyTo)
  const payload = {
    from: safeFrom,
    to: recipients,
    subject: safeSubject,
  }
  if (safeText) payload.text = safeText
  if (safeHtml) payload.html = safeHtml
  if (safeReplyTo.length > 0) payload.reply_to = safeReplyTo

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.message || `Resend HTTP ${response.status}`)
  }
  return body
}

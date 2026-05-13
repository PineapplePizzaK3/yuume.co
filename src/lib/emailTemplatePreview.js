function trimString(value) {
  return String(value || '').trim()
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeUrl(value) {
  const url = trimString(value)
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) return ''
  return url
}

function toParagraphsFromText(text) {
  const blocks = String(text || '')
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean)
  return blocks
    .map((part) => `<p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.65;">${escapeHtml(part).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

export function buildProfessionalEmailPreview({
  subject,
  bodyText,
  bodyHtml,
  preheader,
  headline,
  ctaLabel,
  ctaUrl,
  signatureName,
  from,
}) {
  const brandName = trimString(import.meta.env.VITE_EMAIL_BRAND_NAME || 'Yuume')
  const supportEmail = trimString(import.meta.env.VITE_EMAIL_SUPPORT_EMAIL || '')
  const companyAddress = trimString(import.meta.env.VITE_EMAIL_COMPANY_ADDRESS || '')
  const websiteUrl = normalizeUrl(import.meta.env.VITE_SITE_URL || '')
  const logoUrl = normalizeUrl(import.meta.env.VITE_EMAIL_LOGO_URL || '')

  const safeSubject = trimString(subject) || `Mensagem de ${brandName}`
  const safePreheader = trimString(preheader) || safeSubject
  const safeHeadline = trimString(headline) || safeSubject
  const safeBodyHtml = trimString(bodyHtml)
  const safeBodyText = trimString(bodyText)
  const safeCtaUrl = normalizeUrl(ctaUrl)
  const safeCtaLabel = trimString(ctaLabel)
  const safeFrom = trimString(from)
  const safeSignatureName = trimString(signatureName || brandName)

  const bodyContent = safeBodyHtml || toParagraphsFromText(safeBodyText)
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName)}" style="max-height:42px;display:block;margin:0 0 12px;"/>`
    : ''
  const ctaBlock = safeCtaUrl && safeCtaLabel
    ? `<tr>
      <td style="padding:0 32px 8px;">
        <a href="${escapeHtml(safeCtaUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(safeCtaLabel)}</a>
      </td>
    </tr>`
    : ''
  const supportBlock = supportEmail
    ? `<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">Suporte: ${escapeHtml(supportEmail)}</p>`
    : ''
  const addressBlock = companyAddress
    ? `<p style="margin:6px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">${escapeHtml(companyAddress)}</p>`
    : ''
  const websiteBlock = websiteUrl
    ? `<p style="margin:6px 0 0;color:#6b7280;font-size:12px;line-height:1.5;"><a href="${escapeHtml(websiteUrl)}" style="color:#4b5563;text-decoration:underline;">${escapeHtml(websiteUrl)}</a></p>`
    : ''
  const fromBlock = safeFrom
    ? `<p style="margin:6px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">Remetente: ${escapeHtml(safeFrom)}</p>`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>${escapeHtml(safeSubject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(safePreheader)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
            <tr>
              <td style="padding:28px 32px 10px;">
                ${logoBlock}
                <p style="margin:0;color:#6b7280;font-size:13px;letter-spacing:0.02em;">${escapeHtml(brandName)}</p>
                <h1 style="margin:10px 0 0;color:#111827;font-size:24px;line-height:1.3;">${escapeHtml(safeHeadline)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px;">${bodyContent}</td>
            </tr>
            ${ctaBlock}
            <tr>
              <td style="padding:4px 32px 0;">
                <p style="margin:0;color:#1f2937;font-size:15px;line-height:1.6;">Atenciosamente,<br/><strong>${escapeHtml(safeSignatureName)}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid #f3f4f6;">
                ${supportBlock}
                ${websiteBlock}
                ${addressBlock}
                ${fromBlock}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const textLines = [
    safeHeadline,
    '',
    safeBodyText || String(safeBodyHtml || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    '',
    safeCtaUrl && safeCtaLabel ? `${safeCtaLabel}: ${safeCtaUrl}` : '',
    '',
    'Atenciosamente,',
    safeSignatureName,
    '',
    supportEmail ? `Suporte: ${supportEmail}` : '',
    websiteUrl ? `Site: ${websiteUrl}` : '',
    companyAddress || '',
  ].filter(Boolean)

  return {
    html,
    text: textLines.join('\n'),
  }
}


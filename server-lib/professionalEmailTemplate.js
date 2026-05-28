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

function toParagraphsFromText(text) {
  const blocks = String(text || '')
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean)
  return blocks
    .map((part) => `<p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.65;">${escapeHtml(part).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function normalizeUrl(value) {
  const url = trimString(value)
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) return ''
  return url
}

function buildFooterSocialLinks({ websiteUrl, instagramUrl }) {
  const links = []
  if (websiteUrl) {
    links.push(
      `<a href="${escapeHtml(websiteUrl)}" title="Website ${escapeHtml(websiteUrl)}" aria-label="Website ${escapeHtml(websiteUrl)}" style="display:inline-block;margin-right:8px;text-decoration:none;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid #d1d5db;border-radius:9999px;color:#374151;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" role="img" aria-hidden="true" style="display:block;fill:#374151;">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm7.93 9h-3.1a15.9 15.9 0 0 0-1.16-5.02A8.03 8.03 0 0 1 19.93 11ZM12 4c.9 0 2.46 2.06 2.86 7H9.14c.4-4.94 1.96-7 2.86-7ZM8.33 5.98A15.9 15.9 0 0 0 7.17 11h-3.1a8.03 8.03 0 0 1 4.26-5.02ZM4.07 13h3.1a15.9 15.9 0 0 0 1.16 5.02A8.03 8.03 0 0 1 4.07 13ZM12 20c-.9 0-2.46-2.06-2.86-7h5.72c-.4 4.94-1.96 7-2.86 7Zm3.67-1.98A15.9 15.9 0 0 0 16.83 13h3.1a8.03 8.03 0 0 1-4.26 5.02Z"/>
          </svg>
        </span>
      </a>`
    )
  }
  if (instagramUrl) {
    links.push(
      `<a href="${escapeHtml(instagramUrl)}" title="Instagram YuumeCo" aria-label="Instagram YuumeCo" style="display:inline-block;text-decoration:none;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid #d1d5db;border-radius:9999px;color:#374151;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" role="img" aria-hidden="true" style="display:block;fill:#374151;">
            <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm8.95 1.35a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z"/>
          </svg>
        </span>
      </a>`
    )
  }
  if (links.length === 0) return ''
  return `<div style="margin:10px 0 2px;">${links.join('')}</div>`
}

export function buildProfessionalEmailTemplate({
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
  const brandName = trimString(process.env.EMAIL_BRAND_NAME || process.env.BUSINESS_NAME || 'YuumeCo')
  const supportEmail = 'support@yuume.co'
  const companyAddress = trimString(process.env.EMAIL_COMPANY_ADDRESS || '')
  const websiteUrl = normalizeUrl(process.env.VITE_SITE_URL || process.env.SITE_URL || '')
  const instagramUrl = normalizeUrl(process.env.EMAIL_INSTAGRAM_URL || 'https://instagram.com/yuume_co')
  const logoUrl = normalizeUrl(process.env.EMAIL_LOGO_URL || '')

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
  const socialLinksBlock = buildFooterSocialLinks({ websiteUrl, instagramUrl })
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
                ${socialLinksBlock}
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
    `Atenciosamente,`,
    safeSignatureName,
    '',
    supportEmail ? `Suporte: ${supportEmail}` : '',
    websiteUrl ? `Site: ${websiteUrl}` : '',
    instagramUrl ? `Instagram: ${instagramUrl}` : '',
    companyAddress || '',
  ].filter(Boolean)

  return {
    html,
    text: textLines.join('\n'),
  }
}

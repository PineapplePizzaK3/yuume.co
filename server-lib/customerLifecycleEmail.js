import { sendResendEmail } from './resendEmail.js'
import { buildProfessionalEmailTemplate } from './professionalEmailTemplate.js'

function getSiteBaseUrl() {
  const raw =
    process.env.VITE_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    ''
  const normalized = String(raw || '').trim().replace(/\/+$/, '')
  if (!normalized) return ''
  if (/^https?:\/\//i.test(normalized)) return normalized
  return `https://${normalized}`
}

function getPlatformUrl(pathname) {
  const base = getSiteBaseUrl()
  if (!base) return pathname
  return `${base}${pathname}`
}

function getSignatureName() {
  return String(process.env.EMAIL_BRAND_NAME || process.env.BUSINESS_NAME || 'YuumeCo').trim()
}

async function loadRecipientProfile(supabase, userId) {
  const { data } = await supabase
    .from('profiles')
    .select('name,email')
    .eq('id', userId)
    .maybeSingle()
  const email = String(data?.email || '').trim().toLowerCase()
  if (!email) return null
  return {
    name: String(data?.name || '').trim(),
    email,
  }
}

export async function sendOrderPaymentConfirmedEmail(supabase, orderRow) {
  const userId = String(orderRow?.user_id || '').trim()
  if (!userId) return { ok: false, reason: 'missing_user_id' }

  const profile = await loadRecipientProfile(supabase, userId)
  if (!profile) return { ok: false, reason: 'missing_recipient_email' }

  const orderShort = String(orderRow?.id || '').slice(0, 8)
  const isStore = String(orderRow?.order_source || '') === 'store'
  const status = String(orderRow?.status || '')
  const ordersUrl = getPlatformUrl('/platform/orders')
  const signatureName = getSignatureName()
  const greeting = profile.name ? `Olá, ${profile.name}!` : 'Olá!'

  const subject = `Pagamento confirmado do pedido ${orderShort || ''}`.trim()
  const headline = 'Pagamento recebido'
  const preheader = 'Seu pagamento foi confirmado com sucesso.'
  const lines = [
    greeting,
    '',
    `O pagamento do seu pedido ${orderShort || ''} foi confirmado.`.trim(),
    status === 'products_paid' || (isStore && orderRow?.ship_immediately)
      ? 'Agora vamos seguir para a etapa de envio e te avisamos assim que tiver novidade.'
      : 'Seu pedido já está em andamento e você vai receber as próximas atualizações por e-mail.',
    '',
    'Obrigada(o) por confiar na YuumeCo!',
    signatureName,
  ]
  const bodyText = lines.filter(Boolean).join('\n')

  const template = buildProfessionalEmailTemplate({
    subject,
    bodyText,
    preheader,
    headline,
    ctaLabel: 'Acompanhar meus pedidos',
    ctaUrl: ordersUrl,
    signatureName,
  })

  await sendResendEmail({
    to: [profile.email],
    subject,
    text: template.text,
    html: template.html,
  })
  return { ok: true, to: profile.email }
}

export async function sendWalletTopupDecisionEmail(supabase, topupRow, decision) {
  const userId = String(topupRow?.user_id || '').trim()
  if (!userId) return { ok: false, reason: 'missing_user_id' }

  const profile = await loadRecipientProfile(supabase, userId)
  if (!profile) return { ok: false, reason: 'missing_recipient_email' }

  const isApproved = decision === 'approved'
  const requestShort = String(topupRow?.id || '').slice(0, 8)
  const amountJpy = Number(topupRow?.amount_jpy)
  const amountLine = Number.isFinite(amountJpy) && amountJpy > 0
    ? `Valor da recarga: JPY ${amountJpy.toFixed(0)}.`
    : ''
  const walletUrl = getPlatformUrl('/platform/payments')
  const signatureName = getSignatureName()
  const greeting = profile.name ? `Olá, ${profile.name}!` : 'Olá!'

  const subject = isApproved
    ? `Recarga aprovada ${requestShort ? `(${requestShort})` : ''}`.trim()
    : `Atualização da recarga ${requestShort ? `(${requestShort})` : ''}`.trim()
  const headline = isApproved ? 'Sua recarga foi aprovada' : 'Sua recarga foi atualizada'
  const preheader = isApproved
    ? 'Sua recarga já foi aprovada e creditada.'
    : 'Sua solicitação de recarga foi analisada.'

  const bodyText = [
    greeting,
    '',
    isApproved
      ? 'Boa notícia: sua recarga foi aprovada e o crédito já está disponível na sua carteira.'
      : 'Sua solicitação de recarga foi analisada, mas não conseguimos aprovar desta vez.',
    amountLine,
    '',
    isApproved
      ? 'Obrigada(o) por usar a YuumeCo!'
      : 'Se quiser, você pode enviar uma nova solicitação. Estamos por aqui para te ajudar.',
    signatureName,
  ]
    .filter(Boolean)
    .join('\n')

  const template = buildProfessionalEmailTemplate({
    subject,
    bodyText,
    preheader,
    headline,
    ctaLabel: 'Ver pagamentos',
    ctaUrl: walletUrl,
    signatureName,
  })

  await sendResendEmail({
    to: [profile.email],
    subject,
    text: template.text,
    html: template.html,
  })
  return { ok: true, to: profile.email }
}

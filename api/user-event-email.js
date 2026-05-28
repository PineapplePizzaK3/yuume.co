import { getAuthenticatedUser, getSupabaseAdmin } from '../server-lib/antiFraud.js'
import { sendResendEmail } from '../server-lib/resendEmail.js'
import { buildProfessionalEmailTemplate } from '../server-lib/professionalEmailTemplate.js'

const ORDER_STATUS_LABELS = {
  pending_approval: 'Aguardando aprovação',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  awaiting_quote: 'Aguardando orçamento',
  quoted: 'Orçamento enviado',
  awaiting_arrival: 'Aguardando chegada',
  item_received: 'Pacotes recebidos',
  stored: 'Em armazenamento',
  ready_for_shipment: 'Pronto para envio',
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  products_paid: 'Produtos pagos (frete pendente)',
  shipped: 'Enviado',
  completed: 'Finalizado',
}

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

function getSiteOrdersUrl() {
  const baseUrl =
    process.env.VITE_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    ''
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!normalized) return '/platform/orders'
  if (/^https?:\/\//i.test(normalized)) return `${normalized}/platform/orders`
  return `https://${normalized}/platform/orders`
}

function getSignatureName() {
  return String(process.env.EMAIL_BRAND_NAME || process.env.BUSINESS_NAME || 'YuumeCo').trim()
}

function buildEventCopy(eventType, orderRow, shipmentRow) {
  if (eventType === 'shipment_requested') {
    const shipmentShort = String(shipmentRow?.id || '').slice(0, 8)
    return {
      subject: `Recebemos sua solicitação de envio ${shipmentShort || ''}`.trim(),
      preheader: 'Sua solicitação de envio chegou certinho por aqui.',
      headline: 'Seu envio foi solicitado',
      lines: [
        `A gente recebeu sua solicitação de envio ${shipmentShort ? `(${shipmentShort})` : ''}.`.trim(),
        'Obrigada(o) pela confiança! Nosso time já vai analisar tudo com carinho.',
      ],
    }
  }

  if (eventType === 'extra_services_requested') {
    const orderShort = String(orderRow?.id || '').slice(0, 8)
    return {
      subject: `Serviços extras recebidos para o pedido ${orderShort || ''}`.trim(),
      preheader: 'Sua solicitação de serviços extras já chegou pra gente.',
      headline: 'Pedido de serviços extras recebido',
      lines: [
        `Recebemos seu pedido de serviços extras para o pedido ${orderShort || ''}.`.trim(),
        'Obrigada(o)! Em breve a gente te atualiza com os próximos passos.',
      ],
    }
  }

  const orderShort = String(orderRow?.id || '').slice(0, 8)
  const statusLabel = ORDER_STATUS_LABELS[String(orderRow?.status || '')] || String(orderRow?.status || 'atualizado')
  const isStore = String(orderRow?.order_source || '') === 'store'
  return {
    subject: `${isStore ? 'Pedido da loja' : 'Pedido'} ${orderShort || ''} recebido com sucesso`.trim(),
    preheader: 'Seu pedido foi recebido com sucesso.',
    headline: 'Pedido recebido',
    lines: [
      `Recebemos seu pedido ${orderShort || ''} e ele já está em: ${statusLabel}.`.trim(),
      'Obrigado por comprar com a gente! Vamos cuidar de tudo com bastante atenção.',
    ],
  }
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

  const body = parseBody(req)
  if (!body) return res.status(400).json({ error: 'Invalid JSON body' })

  const eventType = String(body.event_type || '').trim()
  const orderId = String(body.order_id || '').trim()
  const shipmentId = String(body.shipment_id || '').trim()
  const userId = user.id

  if (!eventType) {
    return res.status(400).json({ error: 'event_type is required' })
  }

  let orderRow = null
  let shipmentRow = null

  if (eventType === 'order_created' || eventType === 'extra_services_requested') {
    if (!orderId) return res.status(400).json({ error: 'order_id is required' })
    const { data } = await supabase
      .from('orders')
      .select('id,user_id,status,order_source')
      .eq('id', orderId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return res.status(404).json({ error: 'Order not found' })
    orderRow = data
  } else if (eventType === 'shipment_requested') {
    if (!shipmentId) return res.status(400).json({ error: 'shipment_id is required' })
    const { data } = await supabase
      .from('shipments')
      .select('id,user_id,status')
      .eq('id', shipmentId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return res.status(404).json({ error: 'Shipment not found' })
    shipmentRow = data
  } else {
    return res.status(400).json({ error: 'Unsupported event_type' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name,email')
    .eq('id', userId)
    .maybeSingle()

  const to = String(profile?.email || '').trim().toLowerCase()
  if (!to) return res.status(200).json({ ok: false, reason: 'missing_recipient_email' })

  const name = String(profile?.name || '').trim()
  const displayName = name || 'cliente'
  const greeting = `Olá, ${displayName}!`
  const copy = buildEventCopy(eventType, orderRow, shipmentRow)
  const ordersUrl = getSiteOrdersUrl()
  const signatureName = getSignatureName()

  const bodyText = [
    greeting,
    '',
    ...copy.lines,
    '',
    `Você pode acompanhar tudo por aqui: ${ordersUrl}`,
    '',
    'Obrigada(o) pela confiança!',
    signatureName,
  ].join('\n')

  const template = buildProfessionalEmailTemplate({
    subject: copy.subject,
    bodyText,
    preheader: copy.preheader,
    headline: copy.headline,
    ctaLabel: 'Acompanhar meus pedidos',
    ctaUrl: ordersUrl,
    signatureName,
  })

  await sendResendEmail({
    to: [to],
    subject: copy.subject,
    text: template.text,
    html: template.html,
  })

  return res.status(200).json({ ok: true })
}

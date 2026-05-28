import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, getSupabaseAdmin, isAdminUser } from '../../server-lib/antiFraud.js'
import { sendResendEmail } from '../../server-lib/resendEmail.js'
import { buildProfessionalEmailTemplate } from '../../server-lib/professionalEmailTemplate.js'

const ALLOWED_RPCS = new Set([
  'admin_add_inventory_from_order',
  'admin_add_product_to_store',
  'admin_approve_order',
  'admin_approve_wallet_topup',
  'admin_create_order_for_user',
  'admin_create_product',
  'admin_create_purchase_group',
  'admin_create_purchase_group_product',
  'admin_delete_order',
  'admin_delete_product',
  'admin_delete_purchase_group',
  'admin_delete_purchase_group_product',
  'admin_delete_shipment',
  'admin_delete_user_inventory',
  'admin_get_shipping_panel',
  'admin_get_user_full',
  'admin_insert_log',
  'admin_list_auth_logs',
  'admin_list_logs',
  'admin_list_product_categories',
  'admin_list_products',
  'admin_list_purchase_groups',
  'admin_list_store_products',
  'admin_list_user_logs',
  'admin_list_users',
  'admin_list_wallet_topup_requests',
  'admin_orders_with_users',
  'admin_process_affiliate_auto_payouts',
  'admin_reject_order',
  'admin_reject_wallet_topup',
  'admin_remove_product_from_store',
  'admin_register_package',
  'admin_save_system_settings',
  'admin_set_quote',
  'admin_set_shipment_completed',
  'admin_set_shipment_freight',
  'admin_set_shipment_paid',
  'admin_set_shipment_shipped',
  'admin_set_shipping_await_payment',
  'admin_sync_product_variants',
  'admin_update_order',
  'admin_update_order_status',
  'admin_update_product',
  'admin_update_profile',
  'admin_update_purchase_group',
  'admin_update_purchase_group_product',
  'admin_update_user_inventory',
  'admin_wallet_credit',
  'admin_wallet_debit',
  'create_affiliate_payout_candidates',
])

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

const ORDER_EMAIL_RPCS = new Set([
  'admin_update_order_status',
  'admin_set_quote',
  'admin_set_shipping_await_payment',
  'admin_update_order',
])

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

function shouldSendOrderEmail(fn, data) {
  if (!ORDER_EMAIL_RPCS.has(fn)) return false
  if (!data || typeof data !== 'object') return false
  return Boolean(data.user_id && data.id && data.status)
}

function getOrderStatusLabel(status) {
  const key = String(status || '').trim()
  return ORDER_STATUS_LABELS[key] || key || 'Atualizado'
}

function getOrdersUrl(req) {
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

function formatOrderAmount(orderRow) {
  const quoteAmount = Number(orderRow?.quote_amount)
  if (Number.isFinite(quoteAmount) && quoteAmount > 0) {
    const currency = String(orderRow?.quote_currency || 'BRL')
    return `Orçamento: ${currency} ${quoteAmount.toFixed(2)}`
  }
  const shippingCost = Number(orderRow?.shipping_cost)
  if (Number.isFinite(shippingCost) && shippingCost > 0) {
    const currency = String(orderRow?.shipping_currency || 'JPY')
    return `Frete: ${currency} ${shippingCost.toFixed(2)}`
  }
  return ''
}

function buildOrderEmailCopy(fn, orderRow, orderShortId) {
  const status = String(orderRow?.status || '').trim()
  const amountLine = formatOrderAmount(orderRow)

  if (fn === 'admin_set_quote') {
    return {
      subject: `Orçamento disponível para o pedido ${orderShortId || ''}`.trim(),
      preheader: `Seu orçamento do pedido ${orderShortId || ''} já está disponível.`.trim(),
      headline: 'Seu orçamento está disponível',
      bodyLines: [
        `Seu pedido ${orderShortId || ''} recebeu um orçamento e está aguardando seu pagamento.`.trim(),
        amountLine || '',
      ],
    }
  }

  if (fn === 'admin_set_shipping_await_payment') {
    return {
      subject: `Frete definido para o pedido ${orderShortId || ''}`.trim(),
      preheader: `O frete do seu pedido ${orderShortId || ''} foi definido.`.trim(),
      headline: 'Seu frete foi definido',
      bodyLines: [
        `Seu pedido ${orderShortId || ''} já possui valor de frete e está aguardando pagamento.`.trim(),
        amountLine || '',
      ],
    }
  }

  if (status === 'shipped') {
    return {
      subject: `Pedido ${orderShortId || ''} enviado`.trim(),
      preheader: `Seu pedido ${orderShortId || ''} foi enviado.`.trim(),
      headline: 'Seu pedido foi enviado',
      bodyLines: [
        `Seu pedido ${orderShortId || ''} foi enviado com sucesso.`,
      ],
    }
  }

  if (status === 'completed') {
    return {
      subject: `Pedido ${orderShortId || ''} finalizado`.trim(),
      preheader: `Seu pedido ${orderShortId || ''} foi finalizado.`.trim(),
      headline: 'Pedido finalizado',
      bodyLines: [
        `Seu pedido ${orderShortId || ''} foi concluído.`,
      ],
    }
  }

  if (status === 'rejected') {
    return {
      subject: `Atualização importante do pedido ${orderShortId || ''}`.trim(),
      preheader: `Seu pedido ${orderShortId || ''} foi atualizado para rejeitado.`.trim(),
      headline: 'Seu pedido foi rejeitado',
      bodyLines: [
        `Seu pedido ${orderShortId || ''} foi rejeitado. Verifique os detalhes na plataforma.`,
      ],
    }
  }

  const statusLabel = getOrderStatusLabel(status)
  return {
    subject: `Atualização do pedido ${orderShortId || ''}`.trim(),
    preheader: `Pedido ${orderShortId || ''} atualizado para ${statusLabel}`.trim(),
    headline: 'Seu pedido foi atualizado',
    bodyLines: [
      `Seu pedido ${orderShortId || ''} foi atualizado e agora está em: ${statusLabel}.`
        .replace(/\s+/g, ' ')
        .trim(),
      amountLine || '',
    ],
  }
}

async function notifyOrderCustomerByEmail(supabase, req, fn, orderRow) {
  const userId = String(orderRow?.user_id || '').trim()
  if (!userId) return { ok: false, reason: 'missing_user_id' }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('email,name')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('admin-rpc:order-email:profile_lookup_failed', { user_id: userId, error: error.message })
    return { ok: false, reason: 'profile_lookup_failed' }
  }

  const to = String(profile?.email || '').trim().toLowerCase()
  if (!to) return { ok: false, reason: 'missing_recipient_email', user_id: userId }

  const orderId = String(orderRow?.id || '')
  const orderShortId = orderId ? orderId.slice(0, 8) : ''
  const customerName = String(profile?.name || '').trim()
  const greeting = customerName ? `Olá, ${customerName}!` : 'Olá!'
  const ordersUrl = getOrdersUrl(req)
  const copy = buildOrderEmailCopy(fn, orderRow, orderShortId)

  const baseText = [
    greeting,
    '',
    ...copy.bodyLines.filter(Boolean),
    '',
    `Acompanhe em: ${ordersUrl}`,
    '',
    'Equipe D-Delivery',
  ]
    .filter(Boolean)
    .join('\n')

  const template = buildProfessionalEmailTemplate({
    subject: copy.subject,
    bodyText: baseText,
    preheader: copy.preheader,
    headline: copy.headline,
    ctaLabel: 'Ver meus pedidos',
    ctaUrl: ordersUrl,
    signatureName: 'Equipe D-Delivery',
  })

  try {
    await sendResendEmail({
      to: [to],
      subject: copy.subject,
      text: template.text,
      html: template.html,
    })
    return { ok: true, to, subject: copy.subject, order_id: orderId }
  } catch (mailError) {
    console.warn('admin-rpc:order-email:send_failed', {
      order_id: orderId,
      user_id: userId,
      email: to,
      error: mailError?.message || String(mailError),
    })
    return {
      ok: false,
      reason: 'send_failed',
      to,
      order_id: orderId,
      error: mailError?.message || String(mailError),
    }
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
  const isAdmin = await isAdminUser(supabase, user.id)
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const body = parseBody(req)
  if (!body) {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const fn = String(body.fn || '').trim()
  const params = body.params && typeof body.params === 'object' ? body.params : {}
  if (!fn) {
    return res.status(400).json({ error: 'fn is required' })
  }
  if (!ALLOWED_RPCS.has(fn)) {
    return res.status(400).json({ error: 'RPC not allowed' })
  }

  /**
   * As funções admin usam `public.is_admin()` → `auth.uid()` no JWT da requisição.
   * O cliente `service_role` não envia o usuário final, então `auth.uid()` fica NULL
   * e o Postgres levanta "Acesso negado". Chamamos o RPC com anon + Bearer do admin.
   */
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }
  const authHeader = String(req.headers.authorization || '')
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userSupabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data, error } = await userSupabase.rpc(fn, params)
  if (error) {
    return res.status(400).json({ error: error.message || 'RPC failed' })
  }

  if (shouldSendOrderEmail(fn, data)) {
    const emailResult = await notifyOrderCustomerByEmail(supabase, req, fn, data)
    if (!emailResult?.ok) {
      console.warn('admin-rpc:order-email:not_sent', {
        fn,
        result: emailResult,
      })
    } else {
      console.info('admin-rpc:order-email:sent', {
        fn,
        to: emailResult.to,
        order_id: emailResult.order_id,
      })
    }
  }

  return res.status(200).json({ ok: true, data: data ?? null })
}

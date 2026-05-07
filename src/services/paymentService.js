/**
 * Payment service - Frontend calls to API for Stripe e histórico de pagamentos.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

/**
 * Base das rotas serverless (/api/*) no browser.
 * Sempre usa caminho relativo `/api` no mesmo host da página — evita CORS quando o build
 * embute VITE_API_URL apontando para outro domínio (ex.: *.vercel.app vs eiko-dls.com).
 * Split deploy: defina VITE_PAYMENTS_API_ORIGIN=https://seu-api.com (sem barra final).
 */
export function getPaymentsApiBase() {
  const override = String(import.meta.env.VITE_PAYMENTS_API_ORIGIN || '').trim().replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    if (override && /^https?:\/\//i.test(override)) {
      return override
    }
    return '/api'
  }
  return String(import.meta.env.VITE_API_URL || '/api').trim().replace(/\/$/, '') || '/api'
}

export function isGlinSdkEnabled() {
  return String(import.meta.env.VITE_GLIN_SDK_ENABLED || '')
    .trim()
    .toLowerCase() === 'true'
}

async function parseApiPayload(res) {
  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  const rawText = await res.text()

  if (!rawText) return {}

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawText)
    } catch {
      return { error: 'Resposta inválida do servidor (JSON malformado).' }
    }
  }

  try {
    return JSON.parse(rawText)
  } catch {
    return { error: rawText }
  }
}

/**
 * Lista pagamentos do usuário (vinculados aos seus pedidos via RLS).
 * Inclui dados do pedido e do serviço.
 */
export async function getMyPayments() {
  try {
    const { data, error } = await withDbTimeout(
      supabase
        .from('payments')
        .select(`
          id,
          amount,
          currency,
          status,
          stripe_payment_id,
          created_at,
          order_id,
          orders (
            id,
            created_at,
            status,
            order_source,
            quote_amount,
            total_amount,
            total_amount_usd,
            shipping_cost,
            shipping_currency,
            service:services (name)
          )
        `)
        .order('created_at', { ascending: false })
    )
    return { data: data ?? [], error }
  } catch (e) {
    return { data: [], error: toServiceError(e) }
  }
}

/**
 * Create Stripe Checkout session for an order (pagamento do frete).
 * Requer accessToken da sessão Supabase para autenticar.
 */
export async function createCheckoutSession(orderId, accessToken) {
  const options = arguments.length > 2 ? arguments[2] : null
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  let res
  try {
    res = await fetch(`${getPaymentsApiBase()}/create-checkout-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId: orderId || null,
        cartCheckout: !!options?.cartCheckout,
        cartParams: options?.cartParams && typeof options.cartParams === 'object' ? options.cartParams : null,
        useWallet: !!options?.useWallet,
        walletAmountJpy: options?.walletAmountJpy != null ? Number(options.walletAmountJpy) : null,
        provider: options?.provider || null,
        glinMode:
          isGlinSdkEnabled() && options?.provider === 'glin' && options?.glinMode === 'sdk'
            ? 'sdk'
            : null,
      }),
      credentials: 'same-origin',
    })
  } catch (err) {
    if (err?.message === 'Failed to fetch' || err?.name === 'TypeError') {
      throw new Error(
        'Não foi possível conectar à API de pagamento. Em produção, defina VITE_API_URL=/api no build '
        + '(mesmo domínio do site) para evitar CORS. Em dev, use npm run dev:full.'
      )
    }
    throw err
  }

  const data = await parseApiPayload(res)

  if (!res.ok) {
    throw new Error(data?.error || `Erro ao criar sessão de pagamento (HTTP ${res.status})`)
  }

  // Após sucesso o app redireciona para Parcelow; a aba Network pode “sumir” a linha do POST.
  // Marque Preserve log e filtre por create-checkout-session, ou veja o objeto aqui no Console.
  if (data?.debug) {
    console.info('[create-checkout-session] debug (Parcelow):', data.debug)
    try {
      console.info('[create-checkout-session] debug JSON:', JSON.stringify(data.debug))
    } catch {
      // noop
    }
  } else if (data?.url && /parcelow/i.test(String(data.url))) {
    console.warn(
      '[create-checkout-session] Resposta Parcelow sem campo `debug`. '
      + 'Confira se o deploy de `api/create-checkout-session` está na versão que inclui debug.'
    )
  }

  return data
}

/**
 * Create Stripe Checkout session para o carrinho (produtos da loja).
 * items: array de { productId, name, price (number BRL), quantity }
 */
export async function createCartCheckoutSession(items, accessToken) {
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${getPaymentsApiBase()}/create-checkout-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'cart', items }),
    credentials: 'same-origin',
  })

  const data = await parseApiPayload(res)

  if (!res.ok) {
    throw new Error(data?.error || `Erro ao criar sessão de pagamento (HTTP ${res.status})`)
  }

  return data
}

/**
 * Create checkout session para adicionar saldo na carteira (¥ em JPY).
 * amountJpy: valor inteiro em ienes (ex.: 1000 = ¥1.000).
 * provider: 'stripe' | 'parcelow' | 'glin' (fallback no backend para stripe).
 */
export async function createTopUpCheckoutSession(amountJpy, accessToken, provider = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${getPaymentsApiBase()}/create-checkout-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'topup', amountJpy, provider: provider || null }),
    credentials: 'same-origin',
  })

  const data = await parseApiPayload(res)

  if (!res.ok) {
    throw new Error(data?.error || `Erro ao criar sessão de pagamento (HTTP ${res.status})`)
  }

  return data
}

/**
 * Cotações: jpy_usd spot, jpy_usd_charge (com markup Wise), effective_brl_per_jpy, wise_usd_jpy_withdrawal_markup_percent.
 */
export async function fetchExchangeRates() {
  const res = await fetch(`${getPaymentsApiBase()}/exchange-rates`, {
    credentials: 'same-origin',
  })
  const data = await parseApiPayload(res)
  if (!res.ok) {
    return { ...data, ok: false }
  }
  return { ...data, ok: true }
}

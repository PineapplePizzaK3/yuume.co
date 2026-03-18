/**
 * Payment service - Frontend calls to API for Stripe e histórico de pagamentos.
 */
import { supabase } from '../lib/supabase'
import { withDbTimeout, toServiceError } from '../lib/dbGuard'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

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
          status,
          stripe_payment_id,
          created_at,
          order_id,
          orders (
            id,
            created_at,
            status,
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
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${API_BASE}/create-checkout-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ orderId }),
    credentials: 'include',
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'Erro ao criar sessão de pagamento')
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

  const res = await fetch(`${API_BASE}/create-checkout-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'cart', items }),
    credentials: 'include',
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'Erro ao criar sessão de pagamento')
  }

  return data
}

/**
 * Create Stripe Checkout session para adicionar saldo na carteira (R$ em centavos).
 * amountCents: valor em centavos (ex.: 10000 = R$ 100,00).
 */
export async function createTopUpCheckoutSession(amountCents, accessToken) {
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${API_BASE}/create-checkout-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'topup', amountCents }),
    credentials: 'include',
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'Erro ao criar sessão de pagamento')
  }

  return data
}

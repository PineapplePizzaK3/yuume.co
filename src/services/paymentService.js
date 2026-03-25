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
  const options = arguments.length > 2 ? arguments[2] : null
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  let res
  try {
    res = await fetch(`${API_BASE}/create-checkout-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderId, useWallet: !!options?.useWallet }),
      credentials: 'include',
    })
  } catch (err) {
    if (err?.message === 'Failed to fetch' || err?.name === 'TypeError') {
      throw new Error('Não foi possível conectar à API. Use "npm run dev" para rodar o ambiente completo.')
    }
    throw err
  }

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
 * Envia comprovante PIX para um pedido (pagamento manual).
 */
export async function submitPixComprovante(orderId, comprovanteUrl) {
  try {
    const { data, error } = await supabase.rpc('submit_pix_comprovante', {
      p_order_id: orderId,
      p_comprovante_url: comprovanteUrl,
    })
    if (error) throw error
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e }
  }
}

/**
 * Create Stripe Checkout session para adicionar saldo na carteira (¥ em JPY).
 * amountJpy: valor inteiro em ienes (ex.: 1000 = ¥1.000).
 */
export async function createTopUpCheckoutSession(amountJpy, accessToken) {
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${API_BASE}/create-checkout-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'topup', amountJpy }),
    credentials: 'include',
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'Erro ao criar sessão de pagamento')
  }

  return data
}

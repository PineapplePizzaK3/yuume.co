import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, getSupabaseAdmin, isAdminUser } from '../../server-lib/antiFraud.js'

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
  return res.status(200).json({ ok: true, data: data ?? null })
}

/**
 * Re-export Supabase client for api/ usage.
 * API routes (serverless) may need a different client with service_role
 * for admin operations - that stays server-side only.
 */
export { supabase } from '../lib/supabase'

/**
 * Service service - Fetch available services.
 * Services are read-only for users.
 */
import { supabase } from '../lib/supabase'

/**
 * Get all available services.
 */
export async function getServices() {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('name')

  return { data, error }
}

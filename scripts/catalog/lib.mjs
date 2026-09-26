import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const MANIFEST_DIR = path.join(__dirname, 'manifests')

export function createServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY são obrigatórios. Rode com --env-file=.env.')
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function readManifest(fileOrCode) {
  const file = fileOrCode.endsWith('.json') ? fileOrCode : path.join(MANIFEST_DIR, `${fileOrCode.toLowerCase()}.json`)
  return JSON.parse(await readFile(file, 'utf8'))
}

export function parseArgs(argv) {
  const flags = new Set()
  const positional = []
  for (const arg of argv) {
    if (arg.startsWith('--')) flags.add(arg.slice(2))
    else positional.push(arg)
  }
  return { flags, positional }
}

export async function fetchSetByCode(client, franchise, setCode) {
  const { data, error } = await client
    .from('catalog_sets')
    .select('*')
    .eq('franchise', franchise)
    .eq('set_code', setCode)
    .maybeSingle()
  if (error) throw new Error(`Erro ao ler catalog_sets: ${error.message}`)
  return data
}

export async function fetchSetItems(client, setId) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('catalog_items')
      .select('id, number, number_int, name_ja, name_en, rarity, in_checklist')
      .eq('set_id', setId)
      .order('number_int', { ascending: true, nullsFirst: false })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`Erro ao ler catalog_items: ${error.message}`)
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
}

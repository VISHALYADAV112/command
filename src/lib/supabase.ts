import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

export type Database = Record<string, never>

let cached: SupabaseClient | null | undefined

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  if (cached !== undefined) return cached
  cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return cached
}

export function resetSupabase(): void {
  cached = undefined
}
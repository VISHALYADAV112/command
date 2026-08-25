import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from './config'
import type { Database } from './database.types'

export type CommandClient = SupabaseClient<Database>

let cached: CommandClient | null | undefined

export function getSupabase(): CommandClient | null {
  if (!isSupabaseConfigured) return null
  if (cached !== undefined) return cached
  cached = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  return cached
}

export function resetSupabase(): void {
  cached = undefined
}

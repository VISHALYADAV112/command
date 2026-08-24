import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from './supabase'
import { isSupabaseConfigured } from './config'

export async function signInWithGoogle(client: SupabaseClient): Promise<void> {
  await client.auth.signInWithOAuth({ provider: 'google' })
}

export async function signOut(client: SupabaseClient): Promise<void> {
  await client.auth.signOut()
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  if (!isSupabaseConfigured) return () => undefined
  const client = getSupabase()
  if (!client) return () => undefined
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null
  const client = getSupabase()
  if (!client) return null
  const { data } = await client.auth.getSession()
  return data.session
}
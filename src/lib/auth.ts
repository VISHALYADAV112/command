import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from './supabase'
import { isSupabaseConfigured } from './config'

export async function signInWithGoogle(client: SupabaseClient): Promise<void> {
  // GitHub Pages project sites live under a subpath (/command/), but OAuth
  // origins carry no path — without an explicit redirectTo, Supabase returns
  // the browser to the bare origin and Pages 404s.
  const { origin, pathname } = window.location
  await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}${pathname}` },
  })
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
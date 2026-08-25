import type { Session } from '@supabase/supabase-js'
import { getSupabase, type CommandClient } from './supabase'
import { isSupabaseConfigured } from './config'

export async function signInWithGoogle(): Promise<void> {
  const client = getSupabase()
  if (!client) throw new Error('Supabase is not configured.')
  // GitHub Pages project sites live under a subpath (/command/), but OAuth
  // origins carry no path — without an explicit redirectTo, Supabase returns
  // the browser to the bare origin and Pages 404s.
  const authorizationId = new URLSearchParams(window.location.search).get('authorization_id')
  if (authorizationId) sessionStorage.setItem('command:oauth-authorization-id', authorizationId)
  const { origin, pathname } = window.location
  const result = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}${pathname}` },
  })
  if (result.error) throw new Error(result.error.message)
}

export async function signOut(client: CommandClient): Promise<void> {
  const result = await client.auth.signOut()
  if (result.error) throw new Error(result.error.message)
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
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(error.message)
  return data.session
}

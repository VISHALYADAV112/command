// Command — Google Calendar integration edge function.
//
// Env:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   Google Cloud OAuth client
//   APP_ORIGIN        deployed app origin (default https://localhost:5173)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  server-side Supabase client
//
// PKCE OAuth: the browser asks this function for a connect URL, then Google
// redirects back to ?action=callback where the code is exchanged. Refresh
// tokens are stored in Supabase Vault; browser code never sees them.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const CID = Deno.env.get('GOOGLE_CLIENT_ID')!
const CSECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const APP = Deno.env.get('APP_ORIGIN') ?? 'https://localhost:5173'
const DBURL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_API = 'https://www.googleapis.com'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

// Google requires an exact redirect_uri match against the registered HTTPS
// URL. Deriving it from req.url yields the edge runtime's internal http://
// origin, which always mismatches — so anchor it to the public project URL.
const CALLBACK_URI = `${new URL(DBURL).origin}/functions/v1/google-calendar?action=callback`

// CORS follows the calling app's origin when it is on the allow-list.
// Origins are scheme+host+port only — APP may carry a path (Pages project
// sites), so derive the bare origin for comparison.
const SITE_ORIGIN = (() => {
  try {
    return new URL(APP).origin
  } catch {
    return APP
  }
})()
const ALLOWED_ORIGINS = new Set([SITE_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'])
let REQUEST_ORIGIN = APP

function cors(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(REQUEST_ORIGIN) ? REQUEST_ORIGIN : APP,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
  })
}

function redirect(ok: boolean): Response {
  return new Response(null, {
    status: 302,
    headers: { ...cors(), Location: `${APP}/#/settings?calendar=${ok ? 'connected' : 'error'}` },
  })
}

function makeClient(): SupabaseClient {
  return createClient(DBURL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function sha256b64(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  let raw = ''
  for (const byte of new Uint8Array(d)) raw += String.fromCharCode(byte)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function verifier(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let out = ''
  for (let i = 0; i < 64; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

async function userId(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization')
  if (!header) return null
  const client = makeClient()
  const { data, error } = await client.auth.getUser(header.replace(/^Bearer /i, ''))
  return error || !data.user ? null : data.user.id
}

async function postForm(url: string, params: Record<string, string>) {
  const res = await fetch(url, { method: 'POST', body: new URLSearchParams(params) })
  return { ok: res.ok, status: res.status, data: await res.json() }
}

function cal(accessToken: string, path: string, init?: RequestInit) {
  return fetch(`${CAL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  }).then(async (res) => {
    const text = await res.text()
    return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null }
  })
}

async function accessToken(c: SupabaseClient, userId: string) {
  const { data, error } = await c.from('integration_accounts')
    .select('refresh_secret_id').eq('user_id', userId).maybeSingle()
  if (error || !data?.refresh_secret_id) return null
  const vault = await c.vault.read({ select: 'id,secret' })
  if (vault.error) return null
  const secret = (vault.data ?? []).find((r) => r.id === data.refresh_secret_id)?.secret
  if (!secret) return null
  const refreshed = await postForm(TOKEN_URL, {
    client_id: CID, client_secret: CSECRET, refresh_token: secret, grant_type: 'refresh_token',
  })
  if (!refreshed.ok || !refreshed.data?.access_token) {
    await c.from('integration_accounts')
      .update({ status: refreshed.status === 400 ? 'expired' : 'error' }).eq('user_id', userId)
    return null
  }
  return refreshed.data.access_token
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
function todayWindow(): { timeMin: string; timeMax: string } {
  const now = new Date()
  const offset = 5.5 * 60 * 60 * 1000 // Asia/Kolkata
  const localMidnight = new Date(now.getTime() + offset)
  localMidnight.setUTCHours(0, 0, 0, 0)
  const start = new Date(localMidnight.getTime() - offset)
  return { timeMin: start.toISOString(), timeMax: new Date(start.getTime() + 86_400_000).toISOString() }
}

async function handler(req: Request, action: string): Promise<Response> {
  const url = new URL(req.url)

  // Google redirects here with no Authorization header.
  if (action === 'callback') {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return redirect(false)
    const c = makeClient()
    const { data: row } = await c.from('oauth_states').select('state,code_verifier,user_id')
      .eq('state', state).single()
    if (!row) return redirect(false)

    let ok = false
    try {
      const ex = await postForm(TOKEN_URL, {
        client_id: CID, client_secret: CSECRET, code,
        code_verifier: String(row.code_verifier),
        redirect_uri: CALLBACK_URI,
        grant_type: 'authorization_code',
      })
      if (!ex.ok || !ex.data?.refresh_token) {
        console.error(`calendar callback: token exchange failed (${ex.status})`, ex.data)
      } else {
        const secret = await c.vault.createSecret({
          name: `google_calendar_refresh_${row.user_id}`, secret: ex.data.refresh_token,
        })
        if (secret.error) {
          console.error('calendar callback: vault store failed', secret.error)
        } else {
          const { error: upsertError } = await c.from('integration_accounts').upsert({
            user_id: row.user_id, provider: 'google',
            provider_account_id: ex.data.sub ?? '',
            scopes: [SCOPE], refresh_secret_id: String(secret.data.id),
            status: 'connected', last_verified_at: new Date().toISOString(),
          }, { onConflict: 'user_id,provider' })
          if (upsertError) console.error('calendar callback: account upsert failed', upsertError)
          else ok = true
        }
      }
    } finally {
      // Consume the state no matter which path ran — one attempt per code.
      await c.from('oauth_states').delete().eq('state', state)
      // Sweep abandoned attempts older than 30 minutes.
      await c.from('oauth_states').delete().lt('created_at', new Date(Date.now() - 1_800_000).toISOString())
    }
    return redirect(ok)
  }

  const uid = await userId(req)
  if (!uid) return json({ error: 'Unauthorized' }, 401)
  const c = makeClient()

  switch (action) {
    case 'connect': {
      const v = verifier()
      const challenge = await sha256b64(v)
      const state = `${uid}.${Math.random().toString(36).slice(2)}`
      const { error } = await c.from('oauth_states').insert({ state, code_verifier: v, user_id: uid }).single()
      if (error) return json({ error: error.message }, 500)
      const link = new URL(AUTH_URL)
      link.searchParams.set('client_id', CID)
      link.searchParams.set('redirect_uri', CALLBACK_URI)
      link.searchParams.set('response_type', 'code')
      link.searchParams.set('scope', SCOPE)
      link.searchParams.set('state', state)
      link.searchParams.set('access_type', 'offline')
      link.searchParams.set('prompt', 'consent')
      link.searchParams.set('code_challenge', challenge)
      link.searchParams.set('code_challenge_method', 'S256')
      return json({ url: link.toString() })
    }

    case 'status': {
      const { data, error } = await c.from('integration_accounts')
        .select('provider,status,last_verified_at,scopes').eq('user_id', uid).maybeSingle()
      if (error) return json({ error: error.message }, 500)
      return json({ connected: Boolean(data), account: data })
    }

    case 'disconnect': {
      const { data } = await c.from('integration_accounts')
        .select('refresh_secret_id').eq('user_id', uid).maybeSingle()
      if (data?.refresh_secret_id) await c.vault.deleteSecret(String(data.refresh_secret_id))
      await c.from('integration_accounts').delete().eq('user_id', uid)
      return json({ ok: true })
    }

    case 'events': {
      const token = await accessToken(c, uid)
      if (!token) return json({ error: 'Calendar not connected or expired' }, 401)
      const w = todayWindow()
      const res = await cal(token,
        `/calendar/v3/calendars/primary/events?timeMin=${w.timeMin}&timeMax=${w.timeMax}&orderBy=startTime&singleEvents=true`)
      if (!res.ok) return json({ error: 'Calendar request failed', status: res.status }, 502)
      const events = ((res.data?.items ?? []) as any[]).map((item: any) => ({
        id: item.id, title: item.summary ?? '',
        start: item.start?.dateTime ?? item.start?.date ?? null,
        end: item.end?.dateTime ?? item.end?.date ?? null,
        url: item.htmlLink ?? null,
      }))
      return json({ events })
    }

    case 'event': {
      const body = await req.json().catch(() => null)
      if (!body) return json({ error: 'Invalid body' }, 400)
      const token = await accessToken(c, uid)
      if (!token) return json({ error: 'Calendar not connected or expired' }, 401)
      const { data: existing } = await c.from('integration_links')
        .select('external_id').eq('user_id', uid).eq('provider', 'google')
        .eq('entity_type', body.entity_type).eq('entity_id', body.entity_id)
        .eq('external_type', 'calendar_event').maybeSingle()
      const date = String(body.start).slice(0, 10)
      const event = { summary: body.summary, description: body.description, start: { date }, end: { date } }
      const res = existing?.external_id
        ? await cal(token, `/calendar/v3/calendars/primary/events/${existing.external_id}`,
          { method: 'PUT', body: JSON.stringify(event) })
        : await cal(token, '/calendar/v3/calendars/primary/events',
          { method: 'POST', body: JSON.stringify(event) })
      if (!res.ok || !res.data?.id) return json({ error: 'Event create failed', status: res.status }, 502)
      await c.from('integration_links').upsert({
        user_id: uid, provider: 'google', entity_type: body.entity_type, entity_id: body.entity_id,
        external_type: 'calendar_event', external_id: res.data.id, external_url: res.data.htmlLink ?? null,
        idempotency_key: body.idempotency_key, fingerprint: body.idempotency_key,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider,entity_type,entity_id,external_type' })
      return json({ ok: true, event: { id: res.data.id, url: res.data.htmlLink ?? null } })
    }

    default:
      return json({ error: 'Unknown action' }, 400)
  }
}

Deno.serve(async (req) => {
  REQUEST_ORIGIN = req.headers.get('origin') ?? APP
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? 'status'
  return handler(req, action)
})

// Command — Google Calendar integration edge function.
//
// Env:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   Google Cloud OAuth client
//   APP_ORIGIN        deployed app origin (default https://localhost:5173)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  server-side Supabase client
//
// PKCE OAuth: the browser asks this function for a connect URL, then Google
// redirects back to ?action=callback where the code is exchanged. Refresh
// tokens are encrypted with an edge-only key; browser code never sees them.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { allDayEvent, calendarCommitmentEvent, oauthState, pkceVerifier, todayWindow } from '../_shared/calendar.ts'
import { decryptCalendarToken, encryptCalendarToken } from '../_shared/calendar-token.ts'
import { oauthClientIdFromToken } from '../_shared/oauth-token.ts'

const CID = Deno.env.get('GOOGLE_CLIENT_ID')!
const CSECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const APP = Deno.env.get('APP_ORIGIN') ?? 'https://localhost:5173'
const DBURL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_API = 'https://www.googleapis.com'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned'

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
function cors(requestOrigin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : SITE_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function responses(req: Request) {
  const requestOrigin = req.headers.get('origin') ?? SITE_ORIGIN
  return {
    cors: () => cors(requestOrigin),
    json: (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { ...cors(requestOrigin), 'Content-Type': 'application/json' },
    }),
    redirect: (ok: boolean) => new Response(null, {
      status: 302,
      headers: { ...cors(requestOrigin), Location: `${APP}/#/settings?calendar=${ok ? 'connected' : 'error'}` },
    }),
  }
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

async function userId(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization')
  if (!header) return null
  const token = header.replace(/^Bearer /i, '')
  const client = makeClient()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user || oauthClientIdFromToken(token)) return null
  return data.user.id
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

// Hosted PostgREST does not expose the vault schema, so supabase-js
// `c.vault.*` cannot run here. The Google refresh token is instead stored
// AES-256-GCM encrypted in integration_accounts; the key lives only in the
// GOOGLE_TOKEN_KEY edge secret — never in the database or browser.
const TOKEN_KEY_B64 = Deno.env.get('GOOGLE_TOKEN_KEY')!

async function accessToken(c: SupabaseClient, userId: string) {
  const { data, error } = await c.from('integration_accounts')
    .select('refresh_token_enc').eq('user_id', userId).eq('provider', 'google').maybeSingle()
  if (error || !data?.refresh_token_enc) return null
  const secret = await decryptCalendarToken(data.refresh_token_enc, TOKEN_KEY_B64)
  if (!secret) return null
  const refreshed = await postForm(TOKEN_URL, {
    client_id: CID, client_secret: CSECRET, refresh_token: secret, grant_type: 'refresh_token',
  })
  if (!refreshed.ok || !refreshed.data?.access_token) {
    await c.from('integration_accounts')
      .update({ status: refreshed.status === 400 ? 'expired' : 'error' })
      .eq('user_id', userId).eq('provider', 'google')
    return null
  }
  const { error: verifiedError } = await c.from('integration_accounts')
    .update({ status: 'connected', last_verified_at: new Date().toISOString() })
    .eq('user_id', userId).eq('provider', 'google')
  if (verifiedError) console.error('calendar token verification timestamp failed', verifiedError)
  return refreshed.data.access_token
}

async function recordCalendarActivity(
  c: SupabaseClient,
  userId: string,
  entityId: string,
  commitmentId: string,
  eventType: 'calendar.exported' | 'calendar.unlinked',
  externalId: string,
) {
  const fingerprint = await sha256b64(`${eventType}:${commitmentId}:${externalId}`)
  const { error } = await c.from('activity_events').insert({
    user_id: userId,
    entity_id: entityId,
    commitment_id: commitmentId,
    event_type: eventType,
    payload: { provider: 'google', external_id: externalId },
    source: 'calendar',
    idempotency_key: `calendar-${fingerprint}`,
  })
  if (error && error.code !== '23505') console.error('calendar activity write failed', error)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function handler(req: Request, action: string): Promise<Response> {
  const url = new URL(req.url)
  const { json, redirect } = responses(req)

  // Google redirects here with no Authorization header.
  if (action === 'callback') {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return redirect(false)
    const c = makeClient()
    const { data: row, error: stateError } = await c.from('oauth_states').select('state,code_verifier,user_id,created_at')
      .eq('state', state).single()
    if (stateError || !row) return redirect(false)
    if (new Date(row.created_at).getTime() < Date.now() - 1_800_000) {
      await c.from('oauth_states').delete().eq('state', state)
      return redirect(false)
    }

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
        const enc = await encryptCalendarToken(ex.data.refresh_token, TOKEN_KEY_B64)
        const { error: upsertError } = await c.from('integration_accounts').upsert({
          user_id: row.user_id, provider: 'google',
          provider_account_id: row.user_id,
          scopes: [SCOPE], refresh_token_enc: enc,
          status: 'connected', last_verified_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' })
        if (upsertError) console.error('calendar callback: account upsert failed', upsertError)
        else ok = true
      }
    } finally {
      // Consume the state no matter which path ran — one attempt per code.
      const { error: consumeError } = await c.from('oauth_states').delete().eq('state', state)
      if (consumeError) console.error('calendar callback: state cleanup failed', consumeError)
      // Sweep abandoned attempts older than 30 minutes.
      await c.from('oauth_states').delete().lt('created_at', new Date(Date.now() - 1_800_000).toISOString())
    }
    return redirect(ok)
  }

  const uid = await userId(req)
  if (!uid) return json({ error: 'Unauthorized' }, 401)
  const c = makeClient()
  const limit = action === 'event' || action === 'event_delete' || action === 'connect' ? 20 : 120
  const { data: allowed, error: rateError } = await c.rpc('consume_edge_rate_limit', {
    p_user_id: uid,
    p_bucket: action,
    p_limit: limit,
    p_window_seconds: 60,
  })
  if (rateError) return json({ error: 'Rate limiter unavailable' }, 503)
  if (!allowed) return json({ error: 'Too many requests. Try again shortly.' }, 429)

  switch (action) {
    case 'connect': {
      await c.from('oauth_states').delete().lt('created_at', new Date(Date.now() - 1_800_000).toISOString())
      const v = pkceVerifier()
      const challenge = await sha256b64(v)
      const state = oauthState(uid)
      const { error } = await c.from('oauth_states').insert({ state, code_verifier: v, user_id: uid })
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
      const [{ data, error }, { data: links, error: linkError }] = await Promise.all([
        c.from('integration_accounts').select('provider,status,last_verified_at,scopes')
          .eq('user_id', uid).eq('provider', 'google').maybeSingle(),
        c.from('integration_links').select('last_synced_at').eq('user_id', uid).eq('provider', 'google')
          .eq('entity_type', 'commitment').eq('external_type', 'calendar_event')
          .order('last_synced_at', { ascending: false }).limit(1),
      ])
      if (error || linkError) return json({ error: error?.message ?? linkError?.message }, 500)
      return json({ connected: data?.status === 'connected', account: data, last_synced_at: links?.[0]?.last_synced_at ?? null })
    }

    case 'disconnect': {
      const { data: account } = await c.from('integration_accounts')
        .select('refresh_token_enc').eq('user_id', uid).eq('provider', 'google').maybeSingle()
      if (account?.refresh_token_enc) {
        const token = await decryptCalendarToken(account.refresh_token_enc, TOKEN_KEY_B64)
        if (token) {
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token }),
          }).catch(() => null)
        }
      }
      const { error: linkError } = await c.from('integration_links').delete()
        .eq('user_id', uid).eq('provider', 'google')
      if (linkError) return json({ error: linkError.message }, 500)
      const { error } = await c.from('integration_accounts').delete()
        .eq('user_id', uid).eq('provider', 'google')
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    case 'events': {
      const token = await accessToken(c, uid)
      if (!token) return json({ error: 'Calendar not connected or expired' }, 401)
      const w = todayWindow()
      const res = await cal(token,
        `/calendar/v3/calendars/primary/events?timeMin=${w.timeMin}&timeMax=${w.timeMax}&orderBy=startTime&singleEvents=true`)
      if (!res.ok) {
        console.error('calendar events read failed', res.status, res.data)
        return json({ error: 'Calendar request failed', status: res.status, detail: res.data }, 502)
      }
      const events = ((res.data?.items ?? []) as Array<{
        id: string
        summary?: string
        start?: { dateTime?: string; date?: string }
        end?: { dateTime?: string; date?: string }
        htmlLink?: string
      }>).map((item) => ({
        id: item.id, title: item.summary ?? '',
        start: item.start?.dateTime ?? item.start?.date ?? null,
        end: item.end?.dateTime ?? item.end?.date ?? null,
        url: item.htmlLink ?? null,
      }))
      return json({ events })
    }

    case 'event': {
      const body = await req.json().catch(() => null)
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (
        !body
        || body.entity_type !== 'commitment'
        || !uuid.test(String(body.entity_id ?? ''))
        || body.idempotency_key !== `commitment-${body.entity_id}`
        || (body.update_only !== undefined && typeof body.update_only !== 'boolean')
      ) return json({ error: 'Invalid event body' }, 400)

      const { data: commitment, error: commitmentError } = await c.from('commitments')
        .select('id,entity_id,kind,action,due_on,state').eq('user_id', uid).eq('id', body.entity_id).maybeSingle()
      if (commitmentError) return json({ error: commitmentError.message }, 500)
      if (!commitment) return json({ error: 'Commitment not found' }, 404)
      const { data: entity, error: entityError } = await c.from('entities')
        .select('title,entity_type_id,archived_at').eq('user_id', uid).eq('id', commitment.entity_id).maybeSingle()
      if (entityError) return json({ error: entityError.message }, 500)
      if (!entity) return json({ error: 'Commitment record not found' }, 404)
      if (entity.archived_at) return json({ error: 'This commitment is not approved for Calendar export' }, 400)
      const { data: entityType, error: typeError } = await c.from('entity_types')
        .select('singular_name').eq('user_id', uid).eq('id', entity.entity_type_id).maybeSingle()
      if (typeError) return json({ error: typeError.message }, 500)
      if (!entityType) return json({ error: 'Commitment type not found' }, 404)
      const mapped = calendarCommitmentEvent({
        id: commitment.id,
        kind: commitment.kind,
        action: commitment.action,
        dueOn: commitment.due_on,
        state: commitment.state,
        entityTitle: entity.title,
        typeName: entityType.singular_name,
      })
      if (!mapped) return json({ error: 'This commitment is not approved for Calendar export' }, 400)

      const { data: existing, error: linkReadError } = await c.from('integration_links')
        .select('external_id').eq('user_id', uid).eq('provider', 'google')
        .eq('entity_type', 'commitment').eq('entity_id', commitment.id)
        .eq('external_type', 'calendar_event').maybeSingle()
      if (linkReadError) return json({ error: linkReadError.message }, 500)
      // update_only keeps Calendar opt-in: resyncs touch only commitments the
      // user already pushed, never creates events for ones they did not.
      if (!existing?.external_id && body.update_only) return json({ ok: true, skipped: true })
      const token = await accessToken(c, uid)
      if (!token) return json({ error: 'Calendar not connected or expired' }, 401)
      const event = allDayEvent(mapped.start, mapped.summary, mapped.description)
      const deterministicId = `command${commitment.id.replaceAll('-', '')}`
      let res = existing?.external_id
        ? await cal(token, `/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.external_id)}`,
          { method: 'PUT', body: JSON.stringify(event) })
        : await cal(token, '/calendar/v3/calendars/primary/events',
          { method: 'POST', body: JSON.stringify({ id: deterministicId, ...event }) })
      if (!existing?.external_id && res.status === 409) {
        res = await cal(token, `/calendar/v3/calendars/primary/events/${deterministicId}`,
          { method: 'PUT', body: JSON.stringify(event) })
      }
      if (!res.ok || !res.data?.id) {
        console.error('calendar event write failed', res.status, res.data)
        return json({ error: 'Event create failed', status: res.status, detail: res.data }, 502)
      }
      const fingerprint = await sha256b64(`${commitment.due_on}:${commitment.action}`)
      const { error: linkWriteError } = await c.from('integration_links').upsert({
        user_id: uid, provider: 'google', entity_type: 'commitment', entity_id: commitment.id,
        external_type: 'calendar_event', external_id: res.data.id, external_url: res.data.htmlLink ?? null,
        idempotency_key: mapped.idempotency_key, fingerprint,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider,entity_type,entity_id,external_type' })
      if (linkWriteError) {
        if (!existing?.external_id) {
          await cal(token, `/calendar/v3/calendars/primary/events/${encodeURIComponent(res.data.id)}`, { method: 'DELETE' })
        }
        return json({ error: 'Event link could not be saved' }, 500)
      }
      await recordCalendarActivity(c, uid, commitment.entity_id, commitment.id, 'calendar.exported', res.data.id)
      return json({ ok: true, event: { id: res.data.id, url: res.data.htmlLink ?? null } })
    }

    // Remove the event linked to a commitment when it closes or stops being
    // eligible. Google deletion is best-effort; the local link always goes.
    case 'event_delete': {
      const body = await req.json().catch(() => null)
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!body || body.entity_type !== 'commitment' || !uuid.test(String(body.entity_id ?? ''))) {
        return json({ error: 'Invalid body' }, 400)
      }
      const { data: commitment, error: commitmentError } = await c.from('commitments')
        .select('id,entity_id').eq('user_id', uid).eq('id', body.entity_id).maybeSingle()
      if (commitmentError) return json({ error: commitmentError.message }, 500)
      if (!commitment) return json({ error: 'Commitment not found' }, 404)
      const { data: link, error: linkReadError } = await c.from('integration_links')
        .select('external_id').eq('user_id', uid).eq('provider', 'google')
        .eq('external_type', 'calendar_event')
        .eq('entity_type', 'commitment').eq('entity_id', commitment.id)
        .maybeSingle()
      if (linkReadError) return json({ error: linkReadError.message }, 500)
      if (link?.external_id) {
        const token = await accessToken(c, uid)
        if (token) {
          const del = await cal(token,
            `/calendar/v3/calendars/primary/events/${encodeURIComponent(link.external_id)}`,
            { method: 'DELETE' })
          if (!del.ok && del.status !== 404 && del.status !== 410) {
            console.error('calendar event delete failed', del.status, del.data)
          }
        }
      }
      const { error: unlinkError } = await c.from('integration_links')
        .delete().eq('user_id', uid).eq('provider', 'google')
        .eq('external_type', 'calendar_event')
        .eq('entity_type', 'commitment').eq('entity_id', commitment.id)
      if (unlinkError) return json({ error: unlinkError.message }, 500)
      if (link?.external_id) await recordCalendarActivity(c, uid, commitment.entity_id, commitment.id, 'calendar.unlinked', link.external_id)
      return json({ ok: true })
    }

    default:
      return json({ error: 'Unknown action' }, 400)
  }
}

Deno.serve(async (req) => {
  const response = responses(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: response.cors() })
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') ?? 'status'
    return await handler(req, action)
  } catch (error) {
    console.error('calendar function crashed', error)
    return response.json({ error: 'Internal error' }, 500)
  }
})

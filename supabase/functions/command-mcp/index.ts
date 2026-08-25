import { createClient } from '@supabase/supabase-js'
import { createMcpHandler, requireBearerAuth } from '@modelcontextprotocol/server'
import { tokenVerifier } from './auth.ts'
import { createCommandRepository } from './repository.ts'
import { createCommandServer } from './server.ts'

const DB_URL = Deno.env.get('SUPABASE_URL')!
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_ORIGIN = new URL(Deno.env.get('APP_ORIGIN') ?? 'http://localhost:5173').origin
const PROJECT_ORIGIN = new URL(DB_URL).origin
const MCP_URL = `${PROJECT_ORIGIN}/functions/v1/command-mcp`
const RESOURCE_METADATA_URL = `${MCP_URL}?metadata=resource`
const AUTHORIZATION_SERVER = `${PROJECT_ORIGIN}/auth/v1`
const service = createClient(DB_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const authenticate = requireBearerAuth({ verifier: tokenVerifier(DB_URL, PUBLISHABLE_KEY), resourceMetadataUrl: RESOURCE_METADATA_URL })

const handler = createMcpHandler((context) => {
  const auth = context.authInfo
  const userId = String(auth?.extra?.userId ?? '')
  if (!auth || !userId) throw new Error('Authenticated user context is required.')
  return createCommandServer(createCommandRepository({
    url: DB_URL, publishableKey: PUBLISHABLE_KEY, service,
    token: auth.token, userId, clientId: auth.clientId,
  }))
}, { responseMode: 'json' })

const allowedOrigins = new Set([APP_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), request)
  const origin = request.headers.get('origin')
  if (origin && !allowedOrigins.has(origin)) return withCors(json({ error: 'Origin not allowed.' }, 403), request)

  const url = new URL(request.url)
  if (request.method === 'GET' && url.searchParams.get('metadata') === 'resource') {
    return withCors(json({
      resource: MCP_URL,
      resource_name: 'Command',
      authorization_servers: [AUTHORIZATION_SERVER],
      bearer_methods_supported: ['header'],
      scopes_supported: ['email'],
    }), request)
  }

  try {
    const auth = await authenticate(request)
    if (auth instanceof Response) return withCors(auth, request)
    const userId = String(auth.extra?.userId ?? '')
    const { data: allowed, error } = await service.rpc('consume_edge_rate_limit', {
      p_user_id: userId,
      p_bucket: `mcp:${auth.clientId}`.slice(0, 250),
      p_limit: 120,
      p_window_seconds: 60,
    })
    if (error) return withCors(json({ error: 'Rate limiter unavailable.' }, 503), request)
    if (!allowed) return withCors(json({ error: 'Too many MCP requests. Try again shortly.' }, 429), request)
    return withCors(await handler.fetch(request, { authInfo: auth }), request)
  } catch (error) {
    console.error('Command MCP failed', error)
    return withCors(json({ error: 'Command MCP failed.' }, 500), request)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers)
  const origin = request.headers.get('origin')
  if (origin && allowedOrigins.has(origin)) headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Headers', 'authorization, content-type, mcp-protocol-version, mcp-method, mcp-name')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Vary', 'Origin')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

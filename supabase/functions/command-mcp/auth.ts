import { createClient } from '@supabase/supabase-js'
import { OAuthError, OAuthErrorCode, type AuthInfo, type OAuthTokenVerifier } from '@modelcontextprotocol/server'

export function tokenVerifier(url: string, publishableKey: string): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data, error } = await client.auth.getUser(token)
      if (error || !data.user) throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid or expired access token.')
      const claims = jwtClaims(token)
      if (typeof claims.exp !== 'number') throw new OAuthError(OAuthErrorCode.InvalidToken, 'Access token has no expiry.')
      const scope = typeof claims.scope === 'string' ? claims.scope.split(' ') : []
      return {
        token,
        clientId: typeof claims.client_id === 'string' ? claims.client_id : 'command-web',
        scopes: scope,
        expiresAt: claims.exp,
        extra: { userId: data.user.id },
      }
    },
  }
}

function jwtClaims(token: string): Record<string, unknown> {
  try {
    const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')
    return JSON.parse(atob(padded)) as Record<string, unknown>
  } catch {
    throw new OAuthError(OAuthErrorCode.InvalidToken, 'Malformed access token.')
  }
}

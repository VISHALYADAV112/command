import { describe, expect, it } from 'vitest'
import { tokenAuthInfo } from '../supabase/functions/command-mcp/auth'

describe('MCP bearer authorization', () => {
  it('carries the OAuth client and standard identity scopes into request context', () => {
    const token = jwt({
      exp: 2_000_000_000,
      client_id: 'client-123',
      scope: 'openid email',
    })
    expect(tokenAuthInfo(token, 'user-123')).toMatchObject({
      clientId: 'client-123',
      scopes: ['openid', 'email'],
      expiresAt: 2_000_000_000,
      extra: { userId: 'user-123' },
    })
  })

  it('rejects malformed tokens and tokens missing required OAuth claims', () => {
    expect(() => tokenAuthInfo('not-a-token', 'user-123')).toThrow(/malformed/i)
    expect(() => tokenAuthInfo(jwt({ client_id: 'client-123', scope: 'email' }), 'user-123')).toThrow(/expiry/i)
    expect(() => tokenAuthInfo(jwt({ exp: 2_000_000_000, scope: 'email' }), 'user-123')).toThrow(/OAuth client/i)
  })
})

function jwt(claims: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `header.${encoded}.signature`
}

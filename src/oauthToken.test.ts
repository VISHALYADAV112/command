import { describe, expect, it } from 'vitest'
import { oauthClientIdFromToken } from '../supabase/functions/_shared/oauth-token'

describe('Supabase OAuth token classification', () => {
  it('detects connected-client tokens and leaves first-party sessions alone', () => {
    expect(oauthClientIdFromToken(jwt({ client_id: 'agent-client' }))).toBe('agent-client')
    expect(oauthClientIdFromToken(jwt({ app_metadata: { provider: 'google' } }))).toBeNull()
    expect(oauthClientIdFromToken('not-a-token')).toBeNull()
  })
})

function jwt(claims: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `header.${encoded}.signature`
}

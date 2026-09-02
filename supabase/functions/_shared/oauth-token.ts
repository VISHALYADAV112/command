export function oauthClientIdFromToken(token: string): string | null {
  try {
    const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')
    const claims = JSON.parse(atob(padded)) as Record<string, unknown>
    return typeof claims.client_id === 'string' && claims.client_id.trim()
      ? claims.client_id : null
  } catch {
    return null
  }
}

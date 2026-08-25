import { useEffect, useState } from 'react'
import { getSupabase } from './lib/supabase'

interface Details {
  authorization_id: string
  client: { name: string; uri: string }
  scope: string
  user: { email: string }
}

export function OAuthConsentScreen({ authorizationId }: { authorizationId: string }) {
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const client = getSupabase()
    if (!client) return setError('Supabase is not configured.')
    void client.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: failure }) => {
      if (failure || !data) return setError(failure?.message ?? 'Authorization request was not found.')
      if ('redirect_url' in data) return window.location.assign(data.redirect_url)
      setDetails(data as Details)
    })
  }, [authorizationId])

  async function decide(approve: boolean) {
    const client = getSupabase()
    if (!client) return
    setBusy(true)
    setError(null)
    const result = approve
      ? await client.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await client.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
    if (result.error || !result.data) {
      setBusy(false)
      setError(result.error?.message ?? 'Authorization could not be completed.')
      return
    }
    window.location.assign(result.data.redirect_url)
  }

  return <div className="auth-screen"><div className="auth-card oauth-consent-card">
    <img className="auth-mark" src="./assets/command-mark.svg" alt="" />
    <p className="eyebrow">Command · MCP</p>
    <h1>{details ? `Connect ${details.client.name || 'AI client'}?` : 'Checking request…'}</h1>
    {details && <>
      <p className="auth-copy">This client will be able to read your Command context and use the capture tool as <strong>{details.user.email}</strong>.</p>
      <p className="settings-status">Requested access · {details.scope || 'email'}</p>
      <p className="settings-hint">You can revoke this connection from Command settings at any time.</p>
      <div className="form-actions form-actions-split">
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void decide(false)}>Deny</button>
        <button className="primary-button" type="button" disabled={busy} onClick={() => void decide(true)}><span>{busy ? 'Connecting…' : 'Allow connection'}</span></button>
      </div>
    </>}
    {error && <p className="auth-error" role="status">{error}</p>}
  </div></div>
}

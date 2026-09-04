import { useEffect, useState } from 'react'
import { getSupabase } from './lib/supabase'
import {
  DEFAULT_MCP_PERMISSIONS, MCP_PERMISSION_LABELS, MCP_PERMISSIONS, type McpPermission,
} from '../supabase/functions/_shared/mcp-permissions'
import { saveMcpClientPermissions } from './lib/api'

interface Details {
  authorization_id: string
  client: { id: string; name: string; uri: string }
  scope: string
  user: { id: string; email: string }
}

export function OAuthConsentScreen({ authorizationId }: { authorizationId: string }) {
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [permissions, setPermissions] = useState<McpPermission[]>(DEFAULT_MCP_PERMISSIONS)

  useEffect(() => {
    const client = getSupabase()
    if (!client) return setError('Supabase is not configured.')
    void client.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: failure }) => {
      if (failure || !data) return setError(failure?.message ?? 'Authorization request was not found.')
      if ('redirect_url' in data) return finish(data.redirect_url)
      setDetails(data as Details)
    })
  }, [authorizationId])

  async function decide(approve: boolean) {
    const client = getSupabase()
    if (!client) return
    setBusy(true)
    setError(null)
    if (approve && details) {
      try {
        await saveMcpClientPermissions(client, details.user.id, details.client.id, permissions)
      } catch {
        setBusy(false)
        setError('Command permissions could not be saved. No access was granted.')
        return
      }
    }
    const result = approve
      ? await client.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await client.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
    if (result.error || !result.data) {
      setBusy(false)
      setError(result.error?.message ?? 'Authorization could not be completed.')
      return
    }
    finish(result.data.redirect_url)
  }

  function finish(redirectUrl: string) {
    sessionStorage.removeItem('command:oauth-authorization-id')
    window.location.assign(redirectUrl)
  }

  return <div className="auth-screen"><div className="auth-card oauth-consent-card">
    <img className="auth-mark" src="./assets/gazette-mark.svg" alt="" />
    <p className="eyebrow">Command · MCP</p>
    <h1>{details ? `Connect ${details.client.name || 'AI client'}?` : 'Checking request…'}</h1>
    {details && <>
      <p className="auth-copy">This client is asking to work with Command as <strong>{details.user.email}</strong>. Proposed changes still require your approval in the Agent inbox.</p>
      <p className="settings-status">Identity access · {details.scope || 'email'}</p>
      <fieldset className="oauth-permission-list"><legend>Command permissions</legend>{MCP_PERMISSIONS.map((permission) => <label className="check-row" key={permission}><input
        type="checkbox"
        checked={permissions.includes(permission)}
        onChange={(event) => setPermissions((current) => event.target.checked
          ? [...current, permission] : current.filter((item) => item !== permission))}
      />{MCP_PERMISSION_LABELS[permission]}</label>)}</fieldset>
      <p className="settings-hint">You can revoke this connection from Command settings at any time.</p>
      <div className="form-actions form-actions-split">
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void decide(false)}>Deny</button>
        <button className="primary-button" type="button" disabled={busy} onClick={() => void decide(true)}><span>{busy ? 'Connecting…' : 'Allow connection'}</span></button>
      </div>
    </>}
    {error && <p className="auth-error" role="status">{error}</p>}
  </div></div>
}

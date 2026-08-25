import { useEffect, useState } from 'react'
import { mcpEndpoint } from './lib/config'
import { getSupabase } from './lib/supabase'
import { ConfirmSheet } from './ui'

interface Grant {
  client: { id: string; name: string }
  scopes: string[]
  granted_at: string
}

export function McpConnections({ enabled }: { enabled: boolean }) {
  const [grants, setGrants] = useState<Grant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<Grant | null>(null)
  const [copied, setCopied] = useState(false)

  function load() {
    const client = getSupabase()
    if (!enabled || !client) return
    void client.auth.oauth.listGrants().then(({ data, error: failure }) => {
      if (failure) setError(failure.message)
      else setGrants((data ?? []) as Grant[])
    })
  }

  useEffect(load, [enabled])

  async function revoke() {
    const client = getSupabase()
    if (!client || !revoking) return
    const { error: failure } = await client.auth.oauth.revokeGrant({ clientId: revoking.client.id })
    if (failure) setError(failure.message)
    else setGrants((current) => current.filter((grant) => grant.client.id !== revoking.client.id))
    setRevoking(null)
  }

  function copyEndpoint() {
    void navigator.clipboard.writeText(mcpEndpoint()).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }).catch(() => setError('Copy failed. Select the endpoint manually.'))
  }

  return <>
    <div className="settings-group">
      <h3>AI connections · MCP</h3>
      {enabled ? <>
        <p className="settings-hint">Use this remote MCP endpoint in a compatible AI client.</p>
        <div className="mcp-endpoint"><code>{mcpEndpoint()}</code><button className="secondary-button" type="button" onClick={copyEndpoint}>{copied ? 'Copied' : 'Copy'}</button></div>
        {error && <p className="settings-error" role="status">{error}</p>}
        {grants.length === 0 ? <p className="settings-status">No AI clients connected.</p> : <div className="mcp-grants">{grants.map((grant) => <div key={grant.client.id}>
          <span><strong>{grant.client.name || 'AI client'}</strong><small>{grant.scopes.join(' · ') || 'email'}</small></span>
          <button className="secondary-button" type="button" onClick={() => setRevoking(grant)}>Revoke</button>
        </div>)}</div>}
      </> : <p className="settings-status">Available after signing in.</p>}
    </div>
    {revoking && <ConfirmSheet title={`Revoke ${revoking.client.name || 'AI client'}?`} detail="Its current Command access and refresh tokens will stop working." confirmLabel="Revoke access" onClose={() => setRevoking(null)} onConfirm={() => void revoke()} />}
  </>
}

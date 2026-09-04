import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { mcpEndpoint } from './lib/config'
import { getSupabase } from './lib/supabase'
import { ConfirmSheet } from './ui'
import { MCP_PERMISSION_LABELS, MCP_PERMISSIONS, type McpPermission } from '../supabase/functions/_shared/mcp-permissions'
import {
  loadMcpAudit, loadMcpClientPermissions, removeMcpClientPermissions, saveMcpClientPermissions,
  type McpAuditEntry, type McpClientPermissionGrant,
} from './lib/api'

interface Grant {
  client: { id: string; name: string }
  scopes: string[]
  granted_at: string
}

export function McpConnections({ session }: { session: Session | null }) {
  const [grants, setGrants] = useState<Grant[]>([])
  const [permissions, setPermissions] = useState<McpClientPermissionGrant[]>([])
  const [audit, setAudit] = useState<McpAuditEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<Grant | null>(null)
  const [copied, setCopied] = useState(false)

  function load() {
    const client = getSupabase()
    if (!session || !client) return
    void Promise.all([client.auth.oauth.listGrants(), loadMcpClientPermissions(client), loadMcpAudit(client)])
      .then(([grantResult, permissionRows, auditRows]) => {
        if (grantResult.error) setError(grantResult.error.message)
        else {
          setGrants((grantResult.data ?? []) as Grant[])
          setPermissions(permissionRows)
          setAudit(auditRows)
        }
      }).catch(() => setError('Could not load AI client permissions.'))
  }

  useEffect(load, [session])

  function togglePermission(clientId: string, permission: McpPermission, checked: boolean) {
    setPermissions((current) => {
      const existing = current.find((grant) => grant.clientId === clientId)
      const next = checked
        ? [...(existing?.permissions ?? []), permission]
        : (existing?.permissions ?? []).filter((item) => item !== permission)
      return [...current.filter((grant) => grant.clientId !== clientId), { clientId, permissions: [...new Set(next)] }]
    })
  }

  async function savePermissions(clientId: string) {
    const client = getSupabase()
    if (!client || !session) return
    setError(null)
    try {
      await saveMcpClientPermissions(client, session.user.id, clientId, permissionsFor(permissions, clientId))
    } catch { setError('Could not update this client’s Command permissions.') }
  }

  async function revoke() {
    const client = getSupabase()
    if (!client || !revoking) return
    const { error: failure } = await client.auth.oauth.revokeGrant({ clientId: revoking.client.id })
    if (failure) setError(failure.message)
    else {
      try { await removeMcpClientPermissions(client, revoking.client.id) } catch { setError('Access was revoked, but its saved permission row could not be removed.') }
      setGrants((current) => current.filter((grant) => grant.client.id !== revoking.client.id))
      setPermissions((current) => current.filter((grant) => grant.clientId !== revoking.client.id))
    }
    setRevoking(null)
  }

  function copyEndpoint() {
    void navigator.clipboard.writeText(mcpEndpoint()).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }).catch(() => setError('Copy failed. Select the endpoint manually.'))
  }

  return <>
    <div className="prefs-record">
      <div className="prefs-record-head"><span>AI connections · MCP</span><em>{session ? `${grants.length} connected` : 'Sign in required'}</em></div>
      {session ? <>
        <div className="prefs-record-line">OAuth scopes identify you. The Command permissions below separately control registry reads, data reads, and reviewable proposals; they never grant direct database or Calendar writes.</div>
        <div className="mcp-endpoint"><code>{mcpEndpoint()}</code><button className="secondary-button" type="button" onClick={copyEndpoint}>{copied ? 'Copied' : 'Copy'}</button></div>
        {error && <p className="settings-error" role="status">{error}</p>}
        {grants.length === 0 ? <div className="prefs-record-line">No AI clients connected.</div> : <div className="mcp-grants">{grants.map((grant) => <div className="mcp-grant" key={grant.client.id}>
          <span><strong>{grant.client.name || 'AI client'}</strong><small>Identity grant · {grant.scopes.join(' · ') || 'identity only'}</small><small>{lastActivity(audit, grant.client.id)}</small></span>
          <fieldset className="mcp-permission-editor"><legend>Command application permissions</legend>{MCP_PERMISSIONS.map((permission) => <label className="check-row" key={permission}><input type="checkbox" checked={permissionsFor(permissions, grant.client.id).includes(permission)} onChange={(event) => togglePermission(grant.client.id, permission, event.target.checked)} />{MCP_PERMISSION_LABELS[permission]}</label>)}</fieldset>
          <span className="inline-actions"><button className="secondary-button" type="button" onClick={() => void savePermissions(grant.client.id)}>Save permissions</button><button className="secondary-button" type="button" onClick={() => setRevoking(grant)}>Revoke</button></span>
        </div>)}</div>}
      </> : <div className="prefs-record-line">Available after signing in.</div>}
    </div>
    <div className="prefs-record">
      <div className="prefs-record-head"><span>Agent audit</span><em>{session ? `${audit.length} entries` : 'Sign in required'}</em></div>
      {!session ? <div className="prefs-record-line">Available after signing in.</div> : audit.length === 0 ? <div className="prefs-record-line">No MCP activity recorded.</div> : <ol className="audit-list">{audit.slice(0, 20).map((entry) => <li key={entry.id}><strong>{entry.toolName}</strong><span>{entry.success ? 'Succeeded' : 'Failed'} · {entry.durationMs}ms · {entry.clientId}</span><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</time><code>{JSON.stringify(entry.inputSummary)}</code>{entry.errorMessage && <small>{entry.errorMessage}</small>}</li>)}</ol>}
    </div>
    {revoking && <ConfirmSheet title={`Revoke ${revoking.client.name || 'AI client'}?`} detail="Its current Command access and refresh tokens will stop working." confirmLabel="Revoke access" onClose={() => setRevoking(null)} onConfirm={() => void revoke()} />}
  </>
}

function permissionsFor(grants: McpClientPermissionGrant[], clientId: string): McpPermission[] {
  return grants.find((grant) => grant.clientId === clientId)?.permissions ?? []
}

function lastActivity(audit: McpAuditEntry[], clientId: string): string {
  const entry = audit.find((item) => item.clientId === clientId)
  return entry
    ? `Last activity · ${new Date(entry.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}`
    : 'No recorded tool activity'
}

import { createMcpHandler } from '@modelcontextprotocol/server'
import { describe, expect, it, vi } from 'vitest'
import { createCommandServer } from '../supabase/functions/command-mcp/server'
import type { CommandRepository } from '../supabase/functions/command-mcp/types'
import {
  DEFAULT_MCP_PERMISSIONS, MCP_PERMISSION, type McpPermission,
} from '../supabase/functions/_shared/mcp-permissions'
import { commandError } from '../supabase/functions/command-mcp/errors'

function repository(permissions: readonly McpPermission[] = DEFAULT_MCP_PERMISSIONS): CommandRepository {
  return {
    authorize: vi.fn(async (permission: string) => {
      if (!permissions.includes(permission as McpPermission)) throw commandError('forbidden')
    }),
    describeTypes: vi.fn().mockResolvedValue({ types: [{ type_key: 'note' }] }),
    capture: vi.fn().mockResolvedValue({ proposal: { state: 'pending' } }),
    complete: vi.fn().mockResolvedValue({ proposal: { state: 'pending' } }),
    schedule: vi.fn().mockResolvedValue({ proposal: { state: 'pending' } }),
    query: vi.fn().mockResolvedValue({ entities: [] }),
    audit: vi.fn().mockResolvedValue(undefined),
  }
}

async function callMcp(
  repo: CommandRepository,
  method: string,
  params: Record<string, unknown> = {},
) {
  const handler = createMcpHandler(() => createCommandServer(repo), { responseMode: 'json' })
  const response = await handler.fetch(new Request('https://example.test/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), { authInfo: { token: 'test', clientId: 'test-client', scopes: ['email'] } })
  expect(response.status).toBe(200)
  const body = await response.text()
  const payload = response.headers.get('content-type')?.includes('text/event-stream')
    ? body.split('\n').find((line) => line.startsWith('data: '))?.slice(6)
    : body
  return JSON.parse(payload ?? '')
}

describe('Command MCP contract', () => {
  it('advertises only the approved generic tool set', async () => {
    const result = await callMcp(repository(), 'tools/list') as { result: { tools: { name: string }[] } }
    expect(result.result.tools.map((tool) => tool.name)).toEqual([
      'command_describe_types', 'command_capture', 'command_complete', 'command_schedule', 'command_query',
    ])
  })

  it('returns registry discovery and audits the call', async () => {
    const repo = repository()
    const result = await callMcp(repo, 'tools/call', { name: 'command_describe_types', arguments: {} }) as {
      result: { structuredContent: { types: { type_key: string }[] } }
    }
    expect(result.result.structuredContent.types[0].type_key).toBe('note')
    expect(repo.describeTypes).toHaveBeenCalledOnce()
    expect(repo.audit).toHaveBeenCalledWith(expect.objectContaining({ tool: 'command_describe_types', success: true }))
  })

  it('rejects an unfiltered query before it reaches the repository', async () => {
    const repo = repository()
    await callMcp(repo, 'tools/call', { name: 'command_query', arguments: {} })
    expect(repo.query).not.toHaveBeenCalled()
  })

  it('keeps OAuth identity and Command application permissions separate', async () => {
    const identityOnly = repository([])
    const denied = await callMcp(identityOnly, 'tools/call', {
      name: 'command_describe_types', arguments: {},
    }) as { result: { isError: boolean; content: { text: string }[] } }
    expect(denied.result.isError).toBe(true)
    expect(denied.result.content[0].text).toMatch(/not authorized/i)
    expect(identityOnly.describeTypes).not.toHaveBeenCalled()

    const readOnly = repository([MCP_PERMISSION.typesRead, MCP_PERMISSION.dataRead])
    await callMcp(readOnly, 'tools/call', {
      name: 'command_capture', arguments: {
        typeKey: 'note', title: 'No write grant', fields: {}, schemaVersion: 2,
        idempotencyKey: 'proposal-denied-001',
      },
    })
    expect(readOnly.capture).not.toHaveBeenCalled()
  })

  it('rejects nested fields and conflicting query filters before repository access', async () => {
    const repo = repository()
    await callMcp(repo, 'tools/call', { name: 'command_capture', arguments: {
      typeKey: 'note', title: 'Nested payload', fields: { injected: { sql: 'select *' } },
      schemaVersion: 2, idempotencyKey: 'nested-fields-001',
    } })
    await callMcp(repo, 'tools/call', { name: 'command_query', arguments: {
      dueWindow: 'today', text: 'ignored filter', limit: 20,
    } })
    expect(repo.capture).not.toHaveBeenCalled()
    expect(repo.query).not.toHaveBeenCalled()
  })

  it('does not expose repository or database errors to clients', async () => {
    const repo = repository()
    vi.mocked(repo.query).mockRejectedValueOnce(new Error('relation public.private_table leaked a secret'))
    const response = await callMcp(repo, 'tools/call', {
      name: 'command_query', arguments: { text: 'safe search' },
    }) as { result: { isError: boolean; content: { text: string }[] } }
    expect(response.result.isError).toBe(true)
    expect(response.result.content[0].text).toBe('Command data is temporarily unavailable.')
  })
})

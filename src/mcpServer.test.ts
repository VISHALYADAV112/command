import { createMcpHandler } from '@modelcontextprotocol/server'
import { describe, expect, it, vi } from 'vitest'
import { createCommandServer } from '../supabase/functions/command-mcp/server'
import type { CommandRepository } from '../supabase/functions/command-mcp/types'

function repository(): CommandRepository {
  return {
    getToday: vi.fn().mockResolvedValue({ date: '2026-08-25', activeProjects: [] }),
    getWeek: vi.fn().mockResolvedValue({ start: '2026-08-24', end: '2026-08-30' }),
    search: vi.fn().mockResolvedValue({ results: [] }),
    listProjects: vi.fn().mockResolvedValue({ projects: [] }),
    listJobs: vi.fn().mockResolvedValue({ applications: [] }),
    getLearningDue: vi.fn().mockResolvedValue({ items: [] }),
    capture: vi.fn().mockResolvedValue({ created: { kind: 'idea', title: 'Ship it' } }),
    audit: vi.fn().mockResolvedValue(undefined),
  }
}

async function callMcp(repo: CommandRepository, method: string, params: Record<string, unknown> = {}) {
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
  it('advertises the complete initial tool set', async () => {
    const result = await callMcp(repository(), 'tools/list') as { result: { tools: { name: string }[] } }
    expect(result.result.tools.map((tool) => tool.name)).toEqual([
      'command_get_today', 'command_get_week', 'command_search', 'command_list_projects',
      'command_list_jobs', 'command_get_learning_due', 'command_capture',
    ])
  })

  it('returns structured daily context and audits the call', async () => {
    const repo = repository()
    const result = await callMcp(repo, 'tools/call', { name: 'command_get_today', arguments: {} }) as {
      result: { structuredContent: { date: string } }
    }
    expect(result.result.structuredContent.date).toBe('2026-08-25')
    expect(repo.getToday).toHaveBeenCalledOnce()
    expect(repo.audit).toHaveBeenCalledWith(expect.objectContaining({ tool: 'command_get_today', success: true }))
  })
})

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { createCommandRepository } from '../supabase/functions/command-mcp/repository'
import {
  DEFAULT_MCP_PERMISSIONS, MCP_PERMISSION, type McpPermission,
} from '../supabase/functions/_shared/mcp-permissions'

interface QueryCall {
  table: string
  method: string
  args: unknown[]
}

interface FakeClient {
  client: SupabaseClient
  service: SupabaseClient
  calls: QueryCall[]
  rows: Map<string, Map<string, Record<string, unknown>>>
  responses: Record<string, unknown>
}

function fakeClient(responses: Record<string, unknown> = {}): FakeClient {
  const calls: QueryCall[] = []
  const rows = new Map<string, Map<string, Record<string, unknown>>>()
  const client = {
    from(table: string) {
      const result = () => ({ data: responses[table] ?? [], error: null })
      const builder = {
        select(...args: unknown[]) { calls.push({ table, method: 'select', args }); return builder },
        eq(...args: unknown[]) { calls.push({ table, method: 'eq', args }); return builder },
        in(...args: unknown[]) { calls.push({ table, method: 'in', args }); return builder },
        lte(...args: unknown[]) { calls.push({ table, method: 'lte', args }); return builder },
        gte(...args: unknown[]) { calls.push({ table, method: 'gte', args }); return builder },
        is(...args: unknown[]) { calls.push({ table, method: 'is', args }); return builder },
        neq(...args: unknown[]) { calls.push({ table, method: 'neq', args }); return builder },
        ilike(...args: unknown[]) { calls.push({ table, method: 'ilike', args }); return builder },
        or(...args: unknown[]) { calls.push({ table, method: 'or', args }); return builder },
        order(...args: unknown[]) { calls.push({ table, method: 'order', args }); return builder },
        limit(...args: unknown[]) { calls.push({ table, method: 'limit', args }); return builder },
        maybeSingle() {
          calls.push({ table, method: 'maybeSingle', args: [] })
          return Promise.resolve(result())
        },
        upsert(value: Record<string, unknown>, options?: { ignoreDuplicates?: boolean }) {
          calls.push({ table, method: 'upsert', args: [value, options] })
          const tableRows = rows.get(table) ?? new Map<string, Record<string, unknown>>()
          rows.set(table, tableRows)
          const id = String(value.id)
          if (!tableRows.has(id) || !options?.ignoreDuplicates) tableRows.set(id, { ...value })
          return Promise.resolve({ data: null, error: null })
        },
        then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(result()).then(resolve, reject)
        },
      }
      return builder
    },
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ table: 'rpc', method: name, args: [args] })
      return Promise.resolve({ data: responses[`rpc:${name}`] ?? [], error: null })
    },
  } as unknown as SupabaseClient
  const proposals = new Map<string, { proposal_id: string; state: string; replayed: boolean }>()
  const service = {
    from(table: string) {
      if (table === 'mcp_audit_log') return { insert: () => Promise.resolve({ error: null }) }
      if (table !== 'agent_proposals') return (client as unknown as { from: (name: string) => unknown }).from(table)
      let idempotencyKey = ''
      const builder = {
        select(...args: unknown[]) { calls.push({ table: 'service:agent_proposals', method: 'select', args }); return builder },
        eq(column: string, value: unknown) {
          calls.push({ table: 'service:agent_proposals', method: 'eq', args: [column, value] })
          if (column === 'idempotency_key') idempotencyKey = String(value)
          return builder
        },
        maybeSingle() {
          const found = proposals.get(idempotencyKey)
          return Promise.resolve({ data: found ? { id: found.proposal_id, state: found.state } : null, error: null })
        },
      }
      return builder
    },
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ table: 'service', method: name, args: [args] })
      if (name === 'create_agent_proposal') {
        const key = String(args.p_idempotency_key)
        const existing = proposals.get(key)
        if (existing) return Promise.resolve({ data: { ...existing, replayed: true }, error: null })
        const created = { proposal_id: `proposal-${proposals.size + 1}`, state: 'pending', replayed: false }
        proposals.set(key, created)
        return Promise.resolve({ data: created, error: null })
      }
      return (client as unknown as { rpc: (rpcName: string, payload: Record<string, unknown>) => Promise<unknown> }).rpc(name, args)
    },
  } as unknown as SupabaseClient
  return { client, service, calls, rows, responses }
}

function repository(fake: FakeClient, permissions: readonly McpPermission[] = DEFAULT_MCP_PERMISSIONS) {
  fake.responses.mcp_client_permissions = permissionRow(permissions)
  return createCommandRepository({
    url: 'https://example.supabase.co',
    publishableKey: 'publishable',
    service: fake.service,
    token: 'token',
    userId: '11111111-1111-4111-8111-111111111111',
    clientId: 'test-client',
    client: fake.client,
  })
}

describe('MCP v3 repository', () => {
  it('discovers active registry schemas without hardcoded types', async () => {
    const fake = fakeClient({ entity_types: [{ id: 'type-1', type_key: 'custom' }] })
    const result = await repository(fake).describeTypes()
    expect(result.types).toEqual([{ id: 'type-1', type_key: 'custom' }])
    expect(fake.calls).toContainEqual({ table: 'entity_types', method: 'eq', args: ['is_active', true] })
  })

  it('creates an idempotent pending capture proposal through the canonical RPC', async () => {
    const fake = fakeClient({ entity_types: registryType() })
    const repo = repository(fake)
    const input = {
      typeKey: 'custom', title: 'A custom item', fields: { priority: 'high' }, schemaVersion: 3,
      idempotencyKey: 'custom-capture-123',
    }
    const first = await repo.capture(input)
    const retry = await repo.capture({ ...input, title: 'A stale retry' })
    expect(first).toEqual({ proposal: { proposal_id: 'proposal-1', state: 'pending', replayed: false } })
    expect(retry).toEqual({ proposal: { proposal_id: 'proposal-1', state: 'pending', replayed: true } })
    expect(fake.calls).toContainEqual(expect.objectContaining({
      table: 'service', method: 'create_agent_proposal', args: [expect.objectContaining({
        p_operation: 'capture', p_entity_type_id: 'type-1', p_idempotency_key: 'custom-capture-123',
      })],
    }))
  })

  it('returns an existing proposal before changed registry state can reject a retry', async () => {
    const fake = fakeClient({ entity_types: registryType() })
    const repo = repository(fake)
    const input = {
      typeKey: 'custom', title: 'Original item', fields: { priority: 'high' }, schemaVersion: 3,
      idempotencyKey: 'schema-change-retry-001',
    }
    const first = await repo.capture(input)
    fake.responses.entity_types = { ...registryType(), schema_version: 4, field_schema: [] }
    await expect(repo.capture(input)).resolves.toEqual({
      proposal: {
        proposal_id: (first.proposal as { proposal_id: string }).proposal_id,
        state: 'pending', replayed: true,
      },
    })
  })

  it('rejects fields that do not match the current dynamic schema before proposal storage', async () => {
    const fake = fakeClient({ entity_types: registryType() })
    await expect(repository(fake).capture({
      typeKey: 'custom', title: 'Invalid item', fields: { priority: { nested: true } },
      schemaVersion: 3, idempotencyKey: 'custom-invalid-123',
    })).rejects.toThrow(/current type schema/i)
    await expect(repository(fake).capture({
      typeKey: 'custom', title: 'Empty required item', fields: { priority: '' },
      schemaVersion: 3, idempotencyKey: 'custom-empty-124',
    })).rejects.toThrow(/current type schema/i)
    expect(fake.calls.some((call) => call.table === 'service')).toBe(false)
  })

  it('enforces active commitment rules for schedule and complete proposals', async () => {
    const scheduleFake = fakeClient({
      entities: { entity_type_id: 'type-1', archived_at: null }, entity_types: registryType(),
    })
    await expect(repository(scheduleFake).schedule({
      entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'deadline', action: 'Not allowed',
      dueOn: '2026-09-10', idempotencyKey: 'schedule-invalid-001',
    })).rejects.toThrow(/not valid/i)

    const completeFake = fakeClient({
      entities: { entity_type_id: 'type-1', archived_at: null }, entity_types: registryType(),
      commitments: { entity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', state: 'completed' },
    })
    await expect(repository(completeFake).complete({
      entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      commitmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', outcome: 'Again',
      idempotencyKey: 'complete-invalid-001',
    })).rejects.toThrow(/outcome is not valid/i)
    expect(completeFake.calls.some((call) => call.table === 'service')).toBe(false)
  })

  it('keeps proposal creation independent from broad read permissions', async () => {
    const fake = fakeClient({ entity_types: registryType() })
    await expect(repository(fake, [MCP_PERMISSION.proposalsWrite]).capture({
      typeKey: 'custom', title: 'Write-only proposal', fields: { priority: 'high' }, schemaVersion: 3,
      idempotencyKey: 'write-only-capture-001',
    })).resolves.toMatchObject({ proposal: { state: 'pending', replayed: false } })
  })

  it('replays schedule and completion proposals without creating duplicates', async () => {
    const scheduleFake = fakeClient({
      entities: { entity_type_id: 'type-1', archived_at: null }, entity_types: registryType(),
    })
    const scheduleRepo = repository(scheduleFake)
    const schedule = {
      entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'follow-up', action: 'Follow up',
      dueOn: '2026-09-10', idempotencyKey: 'schedule-replay-001',
    }
    const firstSchedule = await scheduleRepo.schedule(schedule)
    const secondSchedule = await scheduleRepo.schedule(schedule)
    expect(secondSchedule).toMatchObject({ proposal: { proposal_id: (firstSchedule.proposal as { proposal_id: string }).proposal_id, replayed: true } })

    const completeFake = fakeClient({
      entities: { entity_type_id: 'type-1', archived_at: null }, entity_types: registryType(),
      commitments: { entity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', state: 'open' },
    })
    const completeRepo = repository(completeFake)
    const complete = {
      entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      commitmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', outcome: 'Answered',
      idempotencyKey: 'complete-replay-001',
    }
    const firstComplete = await completeRepo.complete(complete)
    const secondComplete = await completeRepo.complete(complete)
    expect(secondComplete).toMatchObject({ proposal: { proposal_id: (firstComplete.proposal as { proposal_id: string }).proposal_id, replayed: true } })
  })

  it('requires the people-data permission and excludes people from broad reads without it', async () => {
    const permissions = [...DEFAULT_MCP_PERMISSIONS]
    const denied = fakeClient({ entity_types: { ...registryType(), type_key: 'person' } })
    await expect(repository(denied, permissions).capture({
      typeKey: 'person', title: 'Private person', fields: { priority: 'high' }, schemaVersion: 3,
      idempotencyKey: 'person-denied-001',
    })).rejects.toThrow(/not authorized/i)

    const broad = fakeClient({ entity_types: { id: 'person-type' }, entities: [] })
    await repository(broad, permissions).query({ text: '100%_match', limit: 20 })
    expect(broad.calls).toContainEqual({ table: 'entities', method: 'neq', args: ['entity_type_id', 'person-type'] })
    expect(broad.calls).toContainEqual({ table: 'entities', method: 'ilike', args: ['title', '%100\\%\\_match%'] })
    expect(broad.calls).toContainEqual({ table: 'entities', method: 'limit', args: [20] })
  })

  it('bounds due reads and filters people rows from broad results', async () => {
    const permissions = [MCP_PERMISSION.dataRead, MCP_PERMISSION.typesRead]
    const fake = fakeClient({ 'rpc:get_v3_due_for_mcp': [
      { commitment_id: 'person-item', type_key: 'person' },
      { commitment_id: 'project-item', type_key: 'project' },
    ] })
    await expect(repository(fake, permissions).query({ dueWindow: 'all', limit: 20 })).resolves.toEqual({
      commitments: [{ commitment_id: 'project-item', type_key: 'project' }], limit: 20,
    })
    expect(fake.calls).toContainEqual({ table: 'rpc', method: 'get_v3_due_for_mcp', args: [expect.objectContaining({
      p_user_id: '11111111-1111-4111-8111-111111111111', p_limit: 100, p_offset: 0,
    })] })
  })
})

function registryType() {
  return {
    id: 'type-1', type_key: 'custom', schema_version: 3, is_active: true,
    field_schema: [{ key: 'priority', kind: 'single_select', required: true, options: ['high', 'low'] }],
    allowed_commitment_kinds: ['follow-up'],
  }
}

function permissionRow(permissions: readonly McpPermission[]) {
  return {
    can_read_types: permissions.includes(MCP_PERMISSION.typesRead),
    can_read_data: permissions.includes(MCP_PERMISSION.dataRead),
    can_write_proposals: permissions.includes(MCP_PERMISSION.proposalsWrite),
    can_access_people: permissions.includes(MCP_PERMISSION.peopleData),
  }
}

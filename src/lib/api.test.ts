import { describe, expect, it, vi } from 'vitest'
import type { Commitment, Entity, LearningItem } from '../types'
import { createBuiltInEntityTypes } from '../v3Registry'
import {
  decideAgentProposal, loadMcpAudit, loadMcpClientPermissions, loadRemoteData, loadV3Browse, loadV3BrowsePage, loadV3Due, loadV3DuePage, loadV3Item, loadV3Registry, loadV3Run, loadV3Today, loadV3Week,
  removeMcpClientPermissions, saveMcpClientPermissions,
  REMOTE_READ_LIMIT, upsertLearning, V3_PAGE_SIZE, V3_SCREEN_READ_LIMIT, writeV3Capture, writeV3EntityType, writeV3PluginOutcome,
} from './api'
import type { CommandClient } from './supabase'
import { DEFAULT_MCP_PERMISSIONS, MCP_PERMISSION } from '../../supabase/functions/_shared/mcp-permissions'

const item: LearningItem = {
  id: '00000000-0000-4000-8000-000000000999',
  concept: 'Invariant', stack: 'brain', track: 'dsa', itemType: 'concept',
  confidence: 2, difficulty: 'medium', nextReviewOn: '2026-08-26',
  lastReviewedOn: null, masteryHits: 0, sourceUrl: '', content: 'Keep it true.',
}

describe('remote persistence', () => {
  it('includes ownership and all required learning fields', async () => {
    let payload: Record<string, unknown> | null = null
    const client = {
      from: () => ({
        upsert: (value: Record<string, unknown>) => {
          payload = value
          return Promise.resolve({ error: null })
        },
      }),
    } as unknown as CommandClient

    await upsertLearning(client, item, '11111111-1111-4111-8111-111111111111')
    expect(payload).toMatchObject({
      user_id: '11111111-1111-4111-8111-111111111111',
      id: item.id,
      stack: 'brain',
      difficulty: 'medium',
      item_type: 'concept',
    })
  })

  it('rejects Supabase errors instead of reporting a false save', async () => {
    const client = {
      from: () => ({ upsert: () => Promise.resolve({ error: { message: 'RLS denied the write' } }) }),
    } as unknown as CommandClient

    await expect(upsertLearning(client, item, crypto.randomUUID())).rejects.toThrow('RLS denied the write')
  })
})

describe('remote reads', () => {
  it('orders and bounds every current table read', async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = []
    const client = {
      from(table: string) {
        const builder = {
          select(...args: unknown[]) { calls.push({ table, method: 'select', args }); return builder },
          order(...args: unknown[]) { calls.push({ table, method: 'order', args }); return builder },
          limit(...args: unknown[]) { calls.push({ table, method: 'limit', args }); return builder },
          then(resolve: (value: { data: unknown[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject)
          },
        }
        return builder
      },
    } as unknown as CommandClient

    const data = await loadRemoteData(client)

    const tables = [
      'entity_types', 'entities', 'commitments', 'activity_events',
      'agent_proposals', 'daily_logs', 'learning_items', 'people', 'job_applications', 'projects', 'ideas',
    ]
    for (const table of tables) {
      expect(calls.some((call) => call.table === table && call.method === 'order')).toBe(true)
      expect(calls).toContainEqual({ table, method: 'limit', args: [REMOTE_READ_LIMIT] })
    }
    expect(data).toMatchObject({
      version: 3,
      entityTypes: [],
      entities: [],
      commitments: [],
      activityEvents: [],
      agentProposals: [],
      legacy: { logs: [], learning: [], people: [], applications: [], projects: [], ideas: [] },
    })
  })

  it('uses the bounded derived Due RPC with explicit filters', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    const client = { rpc } as unknown as CommandClient

    await expect(loadV3Due(client, '2026-08-25', 'week', 'learning', 20)).resolves.toEqual([])
    expect(rpc).toHaveBeenCalledWith('get_v3_due', {
      p_day: '2026-08-25',
      p_window: 'week',
      p_type_key: 'learning',
      p_limit: V3_SCREEN_READ_LIMIT,
      p_offset: 20,
    })
  })

  it('loads and maps the bounded Week contract', async () => {
    const weekDays = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']
    const days = weekDays.map((day, index) => ({
      day,
      is_future: index > 2,
      node_minutes: index === 0 ? 40 : null,
      dsa_minutes: index === 0 ? 70 : null,
      math_minutes: index === 0 ? 20 : null,
      meditation: index === 0 ? true : null,
      gym: index === 0 ? false : null,
      diet: index === 0 ? 'on_track' : null,
    }))
    const rpc = vi.fn().mockResolvedValue({ data: {
      week_start: '2026-08-31', week_end: '2026-09-06', days,
      practice: {
        node: { minutes: 40, target: 210 }, dsa: { minutes: 70, target: 420 }, math: { minutes: 20, target: 210 },
      },
      applications_submitted: 1, application_target: 15,
      people_contacted: 1, people_target: 2,
      commitments: { completed: 1, cancelled: 1, missed: 1 },
      proposals: { proposed: 3, approved: 1, rejected: 1 },
    }, error: null })
    const client = { rpc } as unknown as CommandClient

    await expect(loadV3Week(client, '2026-09-02')).resolves.toMatchObject({
      weekStart: '2026-08-31', weekEnd: '2026-09-06',
      applicationsSubmitted: 1, peopleContacted: 1,
      commitments: { completed: 1, cancelled: 1, missed: 1 },
      proposals: { proposed: 3, approved: 1, rejected: 1 },
    })
    expect(rpc).toHaveBeenCalledWith('get_v3_week', { p_week_start: '2026-09-02' })
  })

  it('loads and maps the fixed-size Run contract', async () => {
    const history = [
      { month: '2026-06', value: 1 }, { month: '2026-07', value: 1 }, { month: '2026-08', value: 2 },
    ]
    const rpc = vi.fn().mockResolvedValue({ data: {
      as_of_day: '2026-09-02', history_start: '2026-06-01', history_end: '2026-08-31',
      markers: {
        public_portfolio: { current: 2, target: 3, history_ready: true, history },
        dsa_patterns: { current: 2, covered: 3, target: 24, history_ready: true, history },
        mock_interviews: { current: 2, target: 10, history_ready: true, history },
        application_conversion: {
          current: 66.7, numerator: 2, denominator: 3, target: 25,
          history_ready: true, history: history.map((point) => ({ ...point, value: point.value * 10 })),
        },
        referral_conversations: { current: 2, target: 12, history_ready: true, history },
      },
    }, error: null })
    const client = { rpc } as unknown as CommandClient

    await expect(loadV3Run(client, '2026-09-02')).resolves.toMatchObject({
      asOfDay: '2026-09-02', historyStart: '2026-06-01', historyEnd: '2026-08-31',
      publicPortfolio: { current: 2, target: 3, historyReady: true },
      dsaPatterns: { current: 2, covered: 3, target: 24 },
      applicationConversion: { current: 66.7, numerator: 2, denominator: 3, target: 25 },
    })
    expect(rpc).toHaveBeenCalledWith('get_v3_run', { p_day: '2026-09-02' })
  })

  it('requests one extra Due row to expose bounded page availability', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    const client = { rpc } as unknown as CommandClient

    await expect(loadV3DuePage(client, '2026-08-25', 'all', null, 25)).resolves.toEqual({ items: [], hasMore: false })
    expect(rpc).toHaveBeenCalledWith('get_v3_due', {
      p_day: '2026-08-25', p_window: 'all', p_type_key: undefined,
      p_limit: V3_PAGE_SIZE + 1, p_offset: 25,
    })
  })

  it('bounds every registry, Today, Browse, and Item loader', async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = []
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null })
    const client = {
      rpc,
      from(table: string) {
        const builder = {
          select(...args: unknown[]) { calls.push({ table, method: 'select', args }); return builder },
          order(...args: unknown[]) { calls.push({ table, method: 'order', args }); return builder },
          limit(...args: unknown[]) { calls.push({ table, method: 'limit', args }); return builder },
          eq(...args: unknown[]) { calls.push({ table, method: 'eq', args }); return builder },
          is(...args: unknown[]) { calls.push({ table, method: 'is', args }); return builder },
          range(...args: unknown[]) { calls.push({ table, method: 'range', args }); return builder },
          maybeSingle() { calls.push({ table, method: 'maybeSingle', args: [] }); return Promise.resolve({ data: null, error: null }) },
          then(resolve: (value: { data: unknown[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject)
          },
        }
        return builder
      },
    } as unknown as CommandClient

    await loadV3Registry(client)
    await loadV3Today(client, '2026-08-25')
    await loadV3Browse(client, crypto.randomUUID(), 10)
    await loadV3Item(client, crypto.randomUUID())

    expect(calls).toContainEqual({ table: 'entity_types', method: 'limit', args: [V3_SCREEN_READ_LIMIT] })
    expect(calls).toContainEqual({ table: 'entities', method: 'range', args: [10, 10 + V3_SCREEN_READ_LIMIT - 1] })
    expect(calls).toContainEqual({ table: 'commitments', method: 'limit', args: [V3_SCREEN_READ_LIMIT] })
    expect(calls).toContainEqual({ table: 'activity_events', method: 'limit', args: [V3_SCREEN_READ_LIMIT] })
    expect(rpc).toHaveBeenCalledWith('get_v3_today', { p_day: '2026-08-25', p_limit: V3_SCREEN_READ_LIMIT })
  })

  it('pages Browse using the registry default sort', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = []
    const client = {
      from() {
        const builder = {
          select(...args: unknown[]) { calls.push({ method: 'select', args }); return builder },
          eq(...args: unknown[]) { calls.push({ method: 'eq', args }); return builder },
          is(...args: unknown[]) { calls.push({ method: 'is', args }); return builder },
          order(...args: unknown[]) { calls.push({ method: 'order', args }); return builder },
          range(...args: unknown[]) { calls.push({ method: 'range', args }); return Promise.resolve({ data: [], error: null }) },
        }
        return builder
      },
    } as unknown as CommandClient

    const type = createBuiltInEntityTypes().find((item) => item.typeKey === 'application')!
    await expect(loadV3BrowsePage(client, type, 50)).resolves.toEqual({ items: [], hasMore: false })
    expect(calls).toContainEqual({ method: 'order', args: ['updated_at', { ascending: false }] })
    expect(calls).toContainEqual({ method: 'range', args: [50, 50 + V3_PAGE_SIZE] })
  })
})

describe('agent proposal decisions', () => {
  it('uses the transactional decision RPC with reviewed payloads', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { state: 'approved' }, error: null })
    const client = { rpc } as unknown as CommandClient
    await decideAgentProposal(client, {
      proposalId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', decision: 'approve',
      entityPayload: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Reviewed' },
      decisionNote: 'Edited and approved in Command',
    })
    expect(rpc).toHaveBeenCalledWith('decide_agent_proposal', {
      p_proposal_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_decision: 'approve',
      p_entity_payload: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Reviewed' },
      p_decision_note: 'Edited and approved in Command',
    })
  })
})

describe('MCP client permissions', () => {
  it('persists the selected owner/client grants explicitly', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: () => ({ upsert }) } as unknown as CommandClient
    await saveMcpClientPermissions(client, 'user-123', 'client-123', [
      ...DEFAULT_MCP_PERMISSIONS, MCP_PERMISSION.peopleData,
    ])
    expect(upsert).toHaveBeenCalledWith({
      user_id: 'user-123', client_id: 'client-123',
      can_read_types: true, can_read_data: true, can_write_proposals: true, can_access_people: true,
    })
  })

  it('maps and removes application permissions independently of OAuth identity scopes', async () => {
    const rows = [{
      client_id: 'client-123', can_read_types: true, can_read_data: true,
      can_write_proposals: false, can_access_people: false,
    }]
    const limit = vi.fn().mockResolvedValue({ data: rows, error: null })
    const removeEq = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = {
      from: () => ({
        select: () => ({ order: () => ({ limit }) }),
        delete: () => ({ eq: removeEq }),
      }),
    } as unknown as CommandClient
    await expect(loadMcpClientPermissions(client)).resolves.toEqual([{
      clientId: 'client-123', permissions: [MCP_PERMISSION.typesRead, MCP_PERMISSION.dataRead],
    }])
    await removeMcpClientPermissions(client, 'client-123')
    expect(removeEq).toHaveBeenCalledWith('client_id', 'client-123')
  })

  it('loads bounded private audit history for client activity display', async () => {
    const rows = [{
      id: crypto.randomUUID(), client_id: 'client-123', tool_name: 'command_query', success: true,
      error_message: null, duration_ms: 12, input_summary: { type: 'project' }, created_at: '2026-09-02T06:00:00.000Z',
    }]
    const limit = vi.fn().mockResolvedValue({ data: rows, error: null })
    const client = { from: () => ({ select: () => ({ order: () => ({ limit }) }) }) } as unknown as CommandClient
    await expect(loadMcpAudit(client)).resolves.toEqual([{
      id: rows[0].id, clientId: 'client-123', toolName: 'command_query', success: true,
      errorMessage: null, durationMs: 12, inputSummary: { type: 'project' }, createdAt: '2026-09-02T06:00:00.000Z',
    }])
    expect(limit).toHaveBeenCalledWith(50)
  })
})

describe('v3 transactional capture', () => {
  it('sends the entity and first commitment through one RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null })
    const client = { rpc } as unknown as CommandClient
    const type = createBuiltInEntityTypes()[0]
    const entity: Entity = {
      id: crypto.randomUUID(), entityTypeId: type.id, title: 'Acme — Engineer', fields: {},
      schemaVersion: type.schemaVersion, archivedAt: null,
      createdAt: '2026-08-25T06:30:00.000Z', updatedAt: '2026-08-25T06:30:00.000Z',
    }
    const commitment: Commitment = {
      id: crypto.randomUUID(), entityId: entity.id, kind: 'follow-up', action: 'Follow up', dueOn: '2026-08-26',
      state: 'open', outcome: null, completedAt: null, originSource: 'ui',
    }

    await writeV3Capture(client, entity, commitment, 'capture-request-001')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('write_v3_capture', expect.objectContaining({
      p_entity_id: entity.id, p_commitment_id: commitment.id, p_idempotency_key: 'capture-request-001',
    }))
  })

  it('sends a plugin outcome and follow-on through one atomic RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null })
    const client = { rpc } as unknown as CommandClient
    const commitment: Commitment = {
      id: crypto.randomUUID(), entityId: crypto.randomUUID(), kind: 'review', action: 'Review invariant',
      dueOn: '2026-09-02', state: 'completed', outcome: 'Instant recall',
      completedAt: '2026-09-02T06:00:00.000Z', originSource: 'ui',
    }
    const next = { ...commitment, id: crypto.randomUUID(), dueOn: '2026-09-23', state: 'open' as const, outcome: null, completedAt: null }
    await writeV3PluginOutcome(client, commitment, 'instant', next, 'plugin-outcome-001')
    expect(rpc).toHaveBeenCalledWith('write_v3_plugin_outcome', {
      p_commitment_id: commitment.id, p_outcome: 'Instant recall', p_completed_at: commitment.completedAt,
      p_recall: 'instant', p_next_commitment_id: next.id, p_next_due_on: next.dueOn,
      p_idempotency_key: 'plugin-outcome-001',
    })

    await writeV3PluginOutcome(client, commitment, 'instant', null, 'plugin-mastery-001')
    expect(rpc).toHaveBeenLastCalledWith('write_v3_plugin_outcome', expect.objectContaining({
      p_next_commitment_id: null, p_next_due_on: null, p_idempotency_key: 'plugin-mastery-001',
    }))
  })

  it('writes registry field flags in the database schema shape', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null })
    const client = { rpc } as unknown as CommandClient
    const type = createBuiltInEntityTypes()[4]
    await writeV3EntityType(client, type)
    expect(rpc).toHaveBeenCalledWith('write_v3_entity_type', expect.objectContaining({
      p_id: type.id, p_type_key: 'note', p_schema_version: 2,
      p_field_schema: expect.arrayContaining([expect.objectContaining({ key: 'tag', list_visible: true, filterable: true })]),
    }))
  })
})

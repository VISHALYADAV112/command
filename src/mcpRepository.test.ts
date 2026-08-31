import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { createCommandRepository } from '../supabase/functions/command-mcp/repository'

interface QueryCall {
  table: string
  method: string
  args: unknown[]
}

interface FakeClient {
  client: SupabaseClient
  calls: QueryCall[]
  rows: Map<string, Map<string, Record<string, unknown>>>
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
  } as unknown as SupabaseClient
  return { client, calls, rows }
}

function repository(client: SupabaseClient) {
  const service = { from: () => ({ insert: () => Promise.resolve({ error: null }) }) } as unknown as SupabaseClient
  return createCommandRepository({
    url: 'https://example.supabase.co',
    publishableKey: 'publishable',
    service,
    token: 'token',
    userId: '11111111-1111-4111-8111-111111111111',
    clientId: 'test-client',
    client,
  })
}

describe('MCP repository capture', () => {
  it('preserves a later UI edit when the same idempotency key is retried', async () => {
    const fake = fakeClient()
    const repo = repository(fake.client)
    const input = {
      kind: 'project' as const,
      title: 'Original MCP title',
      nextAction: 'Original MCP action',
      idempotencyKey: 'project-capture-123',
    }

    const first = await repo.capture(input) as { created: { id: string } }
    const saved = fake.rows.get('projects')?.get(first.created.id)
    expect(saved).toBeDefined()
    Object.assign(saved!, { name: 'Edited in the UI', next_action: 'New UI action' })

    await repo.capture(input)

    expect(fake.rows.get('projects')?.get(first.created.id)).toMatchObject({
      name: 'Edited in the UI',
      next_action: 'New UI action',
    })
    expect(fake.calls.filter((call) => call.method === 'upsert').map((call) => call.args[1])).toEqual([
      { onConflict: 'id', ignoreDuplicates: true },
      { onConflict: 'id', ignoreDuplicates: true },
    ])
  })
})

describe('MCP repository Today', () => {
  it('returns settings-aware status for the three practice floors', async () => {
    const fake = fakeClient({
      daily_logs: { node_minutes: 44, dsa_minutes: 70, math_minutes: 0, job_hunt_minutes: 999 },
      user_settings: { node_floor_minutes: 45, dsa_floor_minutes: 60, math_floor_minutes: 0 },
      projects: [],
      job_applications: [],
      people: [],
      learning_items: [],
    })

    const today = await repository(fake.client).getToday()

    expect(today.floorStatus).toEqual({
      node: { minutes: 44, targetMinutes: 45, met: false },
      dsa: { minutes: 70, targetMinutes: 60, met: true },
      math: { minutes: 0, targetMinutes: 0, met: true },
    })
    expect(fake.calls).toContainEqual({
      table: 'user_settings',
      method: 'select',
      args: ['node_floor_minutes,dsa_floor_minutes,math_floor_minutes'],
    })
    expect(fake.calls.filter((call) => call.method === 'limit').map((call) => call.args[0])).toEqual([50, 50, 50, 50])
  })
})

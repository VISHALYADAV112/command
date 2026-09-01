import { describe, expect, it, vi } from 'vitest'
import type { LearningItem } from '../types'
import {
  loadRemoteData, loadV3Browse, loadV3Due, loadV3Item, loadV3Registry, loadV3Today,
  REMOTE_READ_LIMIT, upsertLearning, V3_SCREEN_READ_LIMIT,
} from './api'
import type { CommandClient } from './supabase'

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
      'daily_logs', 'learning_items', 'people', 'job_applications', 'projects', 'ideas',
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
})

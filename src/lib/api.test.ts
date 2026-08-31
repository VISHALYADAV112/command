import { describe, expect, it } from 'vitest'
import type { LearningItem } from '../types'
import { loadRemoteData, REMOTE_READ_LIMIT, upsertLearning } from './api'
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

    await loadRemoteData(client)

    const tables = ['daily_logs', 'learning_items', 'people', 'job_applications', 'projects', 'ideas']
    for (const table of tables) {
      expect(calls.some((call) => call.table === table && call.method === 'order')).toBe(true)
      expect(calls).toContainEqual({ table, method: 'limit', args: [REMOTE_READ_LIMIT] })
    }
  })
})

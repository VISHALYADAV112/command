import { describe, expect, it } from 'vitest'
import type { LearningItem } from '../types'
import { upsertLearning } from './api'
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

import { describe, expect, it, vi } from 'vitest'
import { createDemoData } from './data'
import { createV3Mutations } from './v3Mutations'
import type { CommandData, Commitment, Entity } from './types'

function harness(data: CommandData) {
  const dataRef = { current: data as CommandData | null }
  const setData = vi.fn((next: CommandData) => { dataRef.current = next })
  const sync = { canWrite: () => true, fail: vi.fn(), run: vi.fn() }
  return {
    dataRef,
    setData,
    mutations: createV3Mutations({ mode: 'demo', session: null, dataRef, setData, sync: sync as never }),
  }
}

describe('v3 optimistic mutations', () => {
  it('creates canonical records with local provenance before remote persistence', () => {
    const data = createDemoData(new Date('2026-08-25T06:00:00Z'))
    const { dataRef, mutations } = harness(data)
    const type = data.entityTypes.find((item) => item.typeKey === 'note')!
    const entity: Entity = {
      id: crypto.randomUUID(), entityTypeId: type.id, title: 'A durable note',
      fields: { tag: 'idea', status: 'captured', problem: null, target_market: null, monetization: null, next_action: null },
      schemaVersion: type.schemaVersion, archivedAt: null,
    }

    expect(mutations.saveEntity(entity)).toBe(true)
    expect(dataRef.current?.entities).toContainEqual(entity)
    expect(dataRef.current?.activityEvents[0]).toMatchObject({ entityId: entity.id, eventType: 'entity.created', source: 'ui' })
  })

  it('updates commitment state and archives without hard deletion', () => {
    const data = createDemoData(new Date('2026-08-25T06:00:00Z'))
    const { dataRef, mutations } = harness(data)
    const commitment = data.commitments[0]
    const completed: Commitment = { ...commitment, state: 'completed', outcome: 'Done', completedAt: '2026-08-25T10:00:00.000Z' }

    expect(mutations.saveCommitment(completed)).toBe(true)
    expect(dataRef.current?.commitments.find((item) => item.id === commitment.id)).toEqual(completed)
    expect(dataRef.current?.activityEvents[0]?.eventType).toBe('commitment.completed')

    const entity = dataRef.current!.entities.find((item) => item.id === commitment.entityId)!
    expect(mutations.archiveEntity(entity)).toBe(true)
    expect(dataRef.current?.entities.find((item) => item.id === entity.id)?.archivedAt).not.toBeNull()
    expect(dataRef.current?.entities.some((item) => item.id === entity.id)).toBe(true)
  })
})

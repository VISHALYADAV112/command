import { describe, expect, it, vi } from 'vitest'
import { createDemoData } from './data'
import { createV3Mutations } from './v3Mutations'
import type { CommandData, Commitment, Entity } from './types'
import { spacedRepetitionPlan } from './v3Plugins'

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
      createdAt: '2026-08-25T06:30:00.000Z', updatedAt: '2026-08-25T06:30:00.000Z',
    }

    expect(mutations.saveEntity(entity)).toBe(true)
    expect(dataRef.current?.entities.find((item) => item.id === entity.id)).toMatchObject({
      ...entity, updatedAt: expect.any(String),
    })
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

  it('captures an entity and first commitment in one optimistic mutation', () => {
    const data = createDemoData(new Date('2026-08-25T06:00:00Z'))
    const { dataRef, setData, mutations } = harness(data)
    const type = data.entityTypes.find((item) => item.typeKey === 'application')!
    const entity: Entity = {
      id: crypto.randomUUID(), entityTypeId: type.id, title: 'Acme — Engineer',
      fields: { applied_on: '2026-08-25' }, schemaVersion: type.schemaVersion, archivedAt: null,
      createdAt: '2026-08-25T06:30:00.000Z', updatedAt: '2026-08-25T06:30:00.000Z',
    }
    const commitment: Commitment = {
      id: crypto.randomUUID(), entityId: entity.id, kind: 'follow-up', action: 'Send follow-up', dueOn: '2026-08-26',
      state: 'open', outcome: null, completedAt: null, originSource: 'ui',
    }

    expect(mutations.saveCapture(entity, commitment)).toBe(true)
    expect(setData).toHaveBeenCalledTimes(1)
    expect(dataRef.current?.entities.some((item) => item.id === entity.id)).toBe(true)
    expect(dataRef.current?.commitments).toContainEqual(commitment)
    expect(dataRef.current?.activityEvents.some((event) => event.entityId === entity.id && event.eventType === 'application.submitted')).toBe(true)
  })

  it('applies a plugin outcome and follow-on as one optimistic mutation', () => {
    const data = createDemoData(new Date('2026-09-02T06:00:00.000Z'))
    const { dataRef, setData, mutations } = harness(data)
    const type = data.entityTypes.find((item) => item.typeKey === 'learning')!
    const entity = data.entities.find((item) => item.entityTypeId === type.id)!
    const commitment = data.commitments.find((item) => item.entityId === entity.id && item.kind === 'review')!
    const plan = spacedRepetitionPlan(entity, 'blank', new Date('2026-09-02T06:00:00.000Z'))
    const completed = { ...commitment, state: 'completed' as const, outcome: 'Could not recall', completedAt: '2026-09-02T06:00:00.000Z' }
    const next = { ...commitment, id: crypto.randomUUID(), dueOn: '2026-09-03' }

    expect(mutations.saveOutcome({ commitment: completed, recall: 'blank', entity: plan.entity, nextCommitment: next })).toBe(true)
    expect(setData).toHaveBeenCalledTimes(1)
    expect(dataRef.current?.entities.find((item) => item.id === entity.id)?.fields).toMatchObject({ last_reviewed_on: '2026-09-02' })
    expect(dataRef.current?.commitments).toEqual(expect.arrayContaining([completed, next]))
    expect(dataRef.current?.activityEvents.slice(0, 3).map((event) => event.eventType)).toEqual([
      'commitment.created', 'entity.updated', 'commitment.completed',
    ])
  })
})

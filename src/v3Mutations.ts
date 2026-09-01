import type { Session } from '@supabase/supabase-js'
import type { ActivityEvent, CommandData, Commitment, Entity, EntityType, Settings } from './types'
import type { CommandMode } from './useCommandData'
import type { RemoteSync } from './useRemoteSync'
import { getSupabase } from './lib/supabase'
import { writeV3Capture, writeV3Commitment, writeV3Entity } from './lib/api'
import { uid } from './ui'

interface Options {
  mode: CommandMode
  session: Session | null
  dataRef: { current: CommandData | null }
  setData: (data: CommandData) => void
  sync: RemoteSync
}

export function createV3Mutations({ mode, session, dataRef, setData, sync }: Options) {
  function update(fn: (current: CommandData) => CommandData): void {
    if (!dataRef.current) return
    const next = fn(dataRef.current)
    dataRef.current = next
    setData(next)
  }

  function canMutate(): boolean {
    if (!sync.canWrite()) return false
    if (mode === 'live' && !session?.user.id) {
      sync.fail(new Error('Your session has expired. Sign in again.'), 'Your session has expired.')
      return false
    }
    return true
  }

  function remote(task: (client: NonNullable<ReturnType<typeof getSupabase>>) => Promise<unknown>) {
    if (mode !== 'live') return
    const client = getSupabase()
    if (client) sync.run(() => task(client))
  }

  function saveEntity(entity: Entity): boolean {
    if (!canMutate()) return false
    const idempotencyKey = `ui-entity-${uid()}`
    const nextEntity = { ...entity, updatedAt: new Date().toISOString() }
    update((data) => {
      const existing = data.entities.find((item) => item.id === nextEntity.id)
      const eventType = !existing ? 'entity.created'
        : !existing.archivedAt && nextEntity.archivedAt ? 'entity.archived'
          : existing.archivedAt && !nextEntity.archivedAt ? 'entity.restored' : 'entity.updated'
      const outcome = outcomeForEntity(data.entityTypes, existing, nextEntity, idempotencyKey)
      return {
        ...data,
        entities: replace(data.entities, nextEntity),
        activityEvents: outcome
          ? prependEvent(prependEvent(data.activityEvents, event(eventType, nextEntity.id, null, idempotencyKey)), outcome)
          : prependEvent(data.activityEvents, event(eventType, nextEntity.id, null, idempotencyKey)),
      }
    })
    remote((client) => writeV3Entity(client, nextEntity, idempotencyKey))
    return true
  }

  function saveCommitment(commitment: Commitment): boolean {
    if (!canMutate()) return false
    const idempotencyKey = `ui-commitment-${uid()}`
    update((data) => {
      const existing = data.commitments.find((item) => item.id === commitment.id)
      const eventType = !existing ? 'commitment.created'
        : existing.state === 'open' && commitment.state === 'completed' ? 'commitment.completed'
          : existing.state === 'open' && commitment.state === 'cancelled' ? 'commitment.cancelled'
            : 'commitment.updated'
      return {
        ...data,
        commitments: replace(data.commitments, commitment),
        activityEvents: prependEvent(data.activityEvents, event(eventType, commitment.entityId, commitment.id, idempotencyKey)),
      }
    })
    remote((client) => writeV3Commitment(client, commitment, idempotencyKey))
    return true
  }

  function saveCapture(entity: Entity, commitment: Commitment | null): boolean {
    if (!commitment) return saveEntity(entity)
    if (!canMutate()) return false
    const idempotencyKey = `ui-capture-${uid()}`
    const entityKey = `${idempotencyKey}:entity`
    const commitmentKey = `${idempotencyKey}:commitment`
    const nextEntity = { ...entity, updatedAt: new Date().toISOString() }
    update((data) => {
      const outcome = outcomeForEntity(data.entityTypes, undefined, nextEntity, entityKey)
      let events = prependEvent(data.activityEvents, event('entity.created', nextEntity.id, null, entityKey))
      if (outcome) events = prependEvent(events, outcome)
      events = prependEvent(events, event('commitment.created', commitment.entityId, commitment.id, commitmentKey))
      return {
        ...data,
        entities: replace(data.entities, nextEntity),
        commitments: replace(data.commitments, commitment),
        activityEvents: events,
      }
    })
    remote((client) => writeV3Capture(client, nextEntity, commitment, idempotencyKey))
    return true
  }

  function archiveEntity(entity: Entity): boolean {
    return saveEntity({ ...entity, archivedAt: new Date().toISOString() })
  }

  function restoreEntity(entity: Entity): boolean {
    return saveEntity({ ...entity, archivedAt: null })
  }

  return { saveEntity, saveCommitment, saveCapture, archiveEntity, restoreEntity }
}

function replace<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((existing) => existing.id === item.id)
    ? items.map((existing) => existing.id === item.id ? item : existing)
    : [item, ...items]
}

function prependEvent(events: ActivityEvent[], next: ActivityEvent): ActivityEvent[] {
  return [next, ...events.filter((item) => item.id !== next.id)]
}

function event(eventType: string, entityId: string, commitmentId: string | null, idempotencyKey: string): ActivityEvent {
  const now = new Date().toISOString()
  return {
    id: uid(),
    entityId,
    commitmentId,
    eventType,
    payload: { mutation: eventType },
    source: 'ui',
    clientId: null,
    idempotencyKey,
    occurredAt: now,
    createdAt: now,
  }
}

function outcomeForEntity(types: EntityType[], existing: Entity | undefined, entity: Entity, idempotencyKey: string): ActivityEvent | null {
  const typeKey = types.find((type) => type.id === entity.entityTypeId)?.typeKey
  const field = typeKey === 'application' ? 'applied_on' : typeKey === 'person' ? 'last_contacted_on' : null
  const eventType = typeKey === 'application' ? 'application.submitted' : typeKey === 'person' ? 'person.contacted' : null
  const day = field ? entity.fields[field] : null
  if (!field || !eventType || typeof day !== 'string' || day === existing?.fields[field]) return null
  const next = event(eventType, entity.id, null, `${idempotencyKey}:outcome`)
  return { ...next, payload: { day }, occurredAt: `${day}T06:30:00.000Z` }
}

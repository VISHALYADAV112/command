import type { Session } from '@supabase/supabase-js'
import type { ActivityEvent, CommandData, Commitment, Entity, Settings } from './types'
import type { CommandMode } from './useCommandData'
import type { RemoteSync } from './useRemoteSync'
import { getSupabase } from './lib/supabase'
import { writeV3Commitment, writeV3Entity } from './lib/api'
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
    update((data) => {
      const existing = data.entities.find((item) => item.id === entity.id)
      const eventType = !existing ? 'entity.created'
        : !existing.archivedAt && entity.archivedAt ? 'entity.archived'
          : existing.archivedAt && !entity.archivedAt ? 'entity.restored' : 'entity.updated'
      return {
        ...data,
        entities: replace(data.entities, entity),
        activityEvents: prependEvent(data.activityEvents, event(eventType, entity.id, null, idempotencyKey)),
      }
    })
    remote((client) => writeV3Entity(client, entity, idempotencyKey))
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

  function archiveEntity(entity: Entity): boolean {
    return saveEntity({ ...entity, archivedAt: new Date().toISOString() })
  }

  function restoreEntity(entity: Entity): boolean {
    return saveEntity({ ...entity, archivedAt: null })
  }

  return { saveEntity, saveCommitment, archiveEntity, restoreEntity }
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

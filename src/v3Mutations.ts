import type { Session } from '@supabase/supabase-js'
import type { ActivityEvent, CommandData, Commitment, Entity, EntityType, OutcomeSubmission, Settings } from './types'
import type { CommandMode } from './useCommandData'
import type { RemoteSync } from './useRemoteSync'
import { getSupabase } from './lib/supabase'
import { writeV3Capture, writeV3Commitment, writeV3Entity, writeV3EntityType, writeV3PluginOutcome } from './lib/api'
import { canExportCommitment, commitmentEventPayload, createCalendarEvent, deleteCalendarEvent } from './lib/calendar'
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
    const previousEntity = dataRef.current?.entities.find((item) => item.id === entity.id)
    const entityType = dataRef.current?.entityTypes.find((item) => item.id === entity.entityTypeId)
    const calendarCommitments = dataRef.current?.commitments.filter((item) => item.entityId === entity.id && canExportCommitment(item)) ?? []
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
    remote(async (client) => {
      await writeV3Entity(client, nextEntity, idempotencyKey)
      if (!session || !previousEntity || !entityType) return
      if (!previousEntity.archivedAt && nextEntity.archivedAt) {
        await Promise.all(calendarCommitments.map((commitment) => deleteCalendarEvent(session, {
          entity_type: 'commitment', entity_id: commitment.id,
        })))
      } else if (previousEntity.title !== nextEntity.title) {
        await Promise.all(calendarCommitments.map((commitment) => {
          const payload = commitmentEventPayload(commitment, nextEntity, entityType, true)
          return payload ? createCalendarEvent(session, payload) : Promise.resolve()
        }))
      }
    })
    return true
  }

  function saveCommitment(commitment: Commitment): boolean {
    if (!canMutate()) return false
    const idempotencyKey = `ui-commitment-${uid()}`
    const existingCommitment = dataRef.current?.commitments.find((item) => item.id === commitment.id)
    const entity = dataRef.current?.entities.find((item) => item.id === commitment.entityId)
    const type = entity ? dataRef.current?.entityTypes.find((item) => item.id === entity.entityTypeId) : null
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
    remote(async (client) => {
      await writeV3Commitment(client, commitment, idempotencyKey)
      if (!session || !existingCommitment || !entity || !type) return
      if (canExportCommitment(existingCommitment) && !canExportCommitment(commitment)) {
        await deleteCalendarEvent(session, { entity_type: 'commitment', entity_id: commitment.id })
      } else if (canExportCommitment(commitment)
        && (commitment.dueOn !== existingCommitment.dueOn || commitment.action !== existingCommitment.action)) {
        const payload = commitmentEventPayload(commitment, entity, type, true)
        if (payload) await createCalendarEvent(session, payload)
      }
    })
    return true
  }

  function saveOutcome(submission: OutcomeSubmission): boolean {
    if (!submission.recall || !submission.entity) return saveCommitment(submission.commitment)
    if (!canMutate()) return false
    const idempotencyKey = `ui-plugin-${uid()}`
    update((data) => {
      let events = prependEvent(data.activityEvents, event(
        'commitment.completed', submission.commitment.entityId, submission.commitment.id, idempotencyKey,
      ))
      events = prependEvent(events, event(
        'entity.updated', submission.entity!.id, null, `${idempotencyKey}:entity`,
      ))
      if (submission.nextCommitment) events = prependEvent(events, event(
        'commitment.created', submission.nextCommitment.entityId,
        submission.nextCommitment.id, `${idempotencyKey}:follow-up`,
      ))
      return {
        ...data,
        entities: replace(data.entities, submission.entity!),
        commitments: submission.nextCommitment
          ? replace(replace(data.commitments, submission.commitment), submission.nextCommitment)
          : replace(data.commitments, submission.commitment),
        activityEvents: events,
      }
    })
    remote((client) => writeV3PluginOutcome(
      client, submission.commitment, submission.recall!, submission.nextCommitment, idempotencyKey,
    ))
    return true
  }

  function saveEntityType(type: EntityType): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, entityTypes: replace(data.entityTypes, type) }))
    remote((client) => writeV3EntityType(client, type))
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

  return { saveEntity, saveCommitment, saveOutcome, saveEntityType, saveCapture, archiveEntity, restoreEntity }
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

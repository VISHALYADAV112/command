import { useState } from 'react'
import type { ActivityEvent, CommandData, Commitment, Entity, EntityType } from '../types'
import { displayFieldValue, findEntity } from '../v3Selectors'
import { EmptyState, ViewShell } from '../ui'
import { canExportCommitment } from '../lib/calendar'

export function ItemView({ data, entityId, onEdit, onSchedule, onOutcome, onArchive, onRestore, onCalendar }: {
  data: CommandData
  entityId: string
  onEdit: (entity: Entity) => void
  onSchedule: (entity: Entity, commitment?: Commitment | null) => void
  onOutcome: (commitment: Commitment) => void
  onArchive: (entity: Entity) => void
  onRestore: (entity: Entity) => void
  onCalendar?: (commitment: Commitment, entity: Entity, type: EntityType) => Promise<void>
}) {
  const entity = findEntity(data, entityId)
  const type = entity ? data.entityTypes.find((item) => item.id === entity.entityTypeId) : undefined
  if (!entity || !type) return <main><ViewShell eyebrow="Item" title="Not found"><EmptyState message="This item is unavailable." /></ViewShell></main>
  const commitments = data.commitments.filter((item) => item.entityId === entity.id).sort((left, right) => left.dueOn.localeCompare(right.dueOn))
  const open = commitments.filter((item) => item.state === 'open')
  const closed = commitments.filter((item) => item.state !== 'open')
  const events = data.activityEvents.filter((item) => item.entityId === entity.id).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
  const creation = events.find((event) => event.eventType === 'entity.created' || event.eventType === 'entity.migrated')

  return <main><ViewShell eyebrow={type.singularName} title={entity.title} aside={entity.archivedAt ? 'Archived' : 'Active'}>
    <div className="item-actions">{entity.archivedAt ? <button className="secondary-button" type="button" onClick={() => onRestore(entity)}>Restore</button> : <><button className="secondary-button" type="button" onClick={() => onEdit(entity)}>Edit</button>{type.allowedCommitmentKinds.length > 0 && <button className="secondary-button" type="button" onClick={() => onSchedule(entity)}>Schedule</button>}<button className="danger-button danger-quiet" type="button" onClick={() => onArchive(entity)}>Archive</button></>}</div>
    {entity.archivedAt && <p className="archived-note">Archived records are read-only until restored.</p>}
    <section className="item-section item-reference"><h3>Record</h3><p>{type.singularName} · <code>{entity.id}</code> · created {new Date(entity.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })}{creation?.eventType === 'entity.migrated' ? ' · migrated' : ''}</p></section>
    <section className="item-section"><h3>Fields</h3><dl className="field-list">{type.fields.map((field) => <div key={field.key}><dt>{field.label}{field.deprecated ? ' · deprecated' : ''}</dt><dd>{displayFieldValue(entity.fields[field.key])}</dd></div>)}</dl></section>
    <CommitmentHistory title="Open commitments" items={open} empty="No open commitments." archived={Boolean(entity.archivedAt)} onSchedule={(commitment) => onSchedule(entity, commitment)} onOutcome={onOutcome} onCalendar={onCalendar ? (commitment) => onCalendar(commitment, entity, type) : undefined} />
    <CommitmentHistory title="History" items={closed} empty="No closed commitments yet." archived onSchedule={() => undefined} onOutcome={() => undefined} />
    <section className="item-section"><h3>Provenance</h3>{events.length === 0 ? <p className="view-hint">No recorded activity yet.</p> : <ol className="timeline">{events.map((event) => <EventRow key={event.id} event={event} />)}</ol>}</section>
  </ViewShell></main>
}

function CommitmentHistory({ title, items, empty, archived, onSchedule, onOutcome, onCalendar }: {
  title: string
  items: Commitment[]
  empty: string
  archived: boolean
  onSchedule: (commitment: Commitment) => void
  onOutcome: (commitment: Commitment) => void
  onCalendar?: (commitment: Commitment) => Promise<void>
}) {
  return <section className="item-section"><h3>{title}</h3>{items.length === 0 ? <p className="view-hint">{empty}</p> : <div className="item-commitments">{items.map((item) => <CommitmentRow key={item.id} item={item} archived={archived} onSchedule={onSchedule} onOutcome={onOutcome} onCalendar={onCalendar} />)}</div>}</section>
}

function CommitmentRow({ item, archived, onSchedule, onOutcome, onCalendar }: {
  item: Commitment
  archived: boolean
  onSchedule: (commitment: Commitment) => void
  onOutcome: (commitment: Commitment) => void
  onCalendar?: (commitment: Commitment) => Promise<void>
}) {
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [calendarError, setCalendarError] = useState('')
  async function push() {
    if (!onCalendar) return
    setCalendarBusy(true)
    setCalendarError('')
    try { await onCalendar(item) } catch { setCalendarError('Calendar export failed. Check the connection in Settings.') } finally { setCalendarBusy(false) }
  }
  return <div><span className="status-pill">{item.kind}</span><strong>{item.action}</strong><small>{item.dueOn} · {item.state}{item.outcome ? ` · ${item.outcome}` : ''}</small>{item.state === 'open' && !archived && <span className="inline-actions"><button className="secondary-button" type="button" onClick={() => onSchedule(item)}>Reschedule</button><button className="secondary-button" type="button" onClick={() => onOutcome(item)}>Outcome</button>{onCalendar && canExportCommitment(item) && <button className="secondary-button" type="button" disabled={calendarBusy} onClick={() => void push()}>{calendarBusy ? 'Adding…' : 'Add to Calendar'}</button>}</span>}{calendarError && <small className="settings-error" role="status">{calendarError}</small>}</div>
}

function EventRow({ event }: { event: ActivityEvent }) {
  return <li><strong>{event.eventType.replace('.', ' ')}</strong><span>{event.source}{event.clientId ? ` · ${event.clientId}` : ''}</span><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</time></li>
}

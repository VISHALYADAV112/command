import { useState } from 'react'
import type { ActivityEvent, CommandData, Commitment, Entity, EntityType } from '../types'
import { displayFieldValue, findEntity } from '../v3Selectors'
import { EmptyState, ViewShell } from '../ui'
import { canExportCommitment } from '../lib/calendar'
import { dayDistance } from '../domain'
import { kindLabel } from './TodayView'

export function ItemView({ data, entityId, today, onEdit, onSchedule, onOutcome, onArchive, onRestore, onCalendar }: {
  data: CommandData
  entityId: string
  today: Date
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
  const events = data.activityEvents.filter((item) => item.entityId === entity.id).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
  const fields = type.fields.filter((field) => !field.deprecated || entity.fields[field.key] !== undefined)
  const eyebrow = `${type.singularName} · ${shortRef(entity.id)} · Filed ${shortDate(entity.createdAt)}`

  return <main><section className="zone view-zone item-view" aria-labelledby="view-title">
    <div className="item-masthead">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id="view-title">{entity.title}</h2>
      <div className="item-actions">
        {entity.archivedAt
          ? <button className="capture-button" type="button" onClick={() => onRestore(entity)}>Restore record</button>
          : <>
            {type.allowedCommitmentKinds.length > 0 && <button className="capture-button" type="button" onClick={() => onSchedule(entity)}>+ Commitment</button>}
            <button className="secondary-button" type="button" onClick={() => onEdit(entity)}>Edit record</button>
            <button className="secondary-button" type="button" onClick={() => onArchive(entity)}>Archive record</button>
          </>}
      </div>
    </div>
    {entity.archivedAt && <p className="archived-note">Archived records are read-only until restored.</p>}

    <div className="item-fields">{fields.map((field) => <div className="item-field" key={field.key}>
      <div className="item-field-label">{field.label}{field.deprecated ? ' · deprecated' : ''}</div>
      <div className="item-field-value">{displayFieldValue(entity.fields[field.key])}</div>
    </div>)}</div>

    <section className="item-section">
      <h3>Commitments against this record</h3>
      {commitments.length === 0
        ? <p className="item-empty">No commitments stand against this record.</p>
        : <div className="item-commitments">{commitments.map((item) => <CommitmentRow
          key={item.id} item={item} today={today} archived={Boolean(entity.archivedAt)}
          kind={kindLabel(item.kind)}
          onSchedule={() => onSchedule(entity, item)} onOutcome={() => onOutcome(item)}
          onCalendar={onCalendar ? () => onCalendar(item, entity, type) : undefined} />)}</div>}
    </section>

    <section className="item-section">
      <h3>Event ledger</h3>
      {events.length === 0
        ? <p className="item-empty">No recorded activity yet.</p>
        : <div className="item-events">{events.map((event) => <EventRow key={event.id} event={event} />)}</div>}
    </section>
  </section></main>
}

function CommitmentRow({ item, today, archived, kind, onSchedule, onOutcome, onCalendar }: {
  item: Commitment
  today: Date
  archived: boolean
  kind: string
  onSchedule: () => void
  onOutcome: () => void
  onCalendar?: () => Promise<void>
}) {
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [calendarError, setCalendarError] = useState('')
  async function push() {
    if (!onCalendar) return
    setCalendarBusy(true)
    setCalendarError('')
    try { await onCalendar() } catch { setCalendarError('Calendar export failed. Check the connection in Settings.') } finally { setCalendarBusy(false) }
  }
  const open = item.state === 'open'
  const distance = dayDistance(today, item.dueOn)
  const when = !open ? 'Discharged' : distance < 0 ? `${Math.abs(distance)} ${Math.abs(distance) === 1 ? 'day' : 'days'} overdue`
    : distance === 0 ? 'Due today' : distance === 1 ? 'Due tomorrow' : `In ${distance} days`
  const tone = !open ? 'is-closed' : distance < 0 ? 'is-overdue' : distance === 0 ? 'is-today' : 'is-upcoming'
  return <article className="item-commitment">
    <span className={`item-commitment-when ${tone}`}>{when}</span>
    <span className="item-commitment-title">{item.action}{item.outcome ? <small>{item.outcome}</small> : null}</span>
    <span className="item-commitment-kind">{kind}</span>
    {open && !archived
      ? <span className="inline-actions">
        <button className="secondary-button" type="button" onClick={onSchedule}>Reschedule</button>
        <button className="secondary-button" type="button" onClick={onOutcome}>Record</button>
        {onCalendar && canExportCommitment(item) && <button className="secondary-button" type="button" disabled={calendarBusy} onClick={() => void push()}>{calendarBusy ? 'Adding…' : 'Add to Calendar'}</button>}
      </span>
      : <span />}
    {calendarError && <small className="settings-error" role="status">{calendarError}</small>}
  </article>
}

function EventRow({ event }: { event: ActivityEvent }) {
  const detail = typeof event.payload?.detail === 'string' ? event.payload.detail : event.clientId ?? ''
  return <article className="item-event">
    <time dateTime={event.occurredAt}>{shortDate(event.occurredAt)}</time>
    <span className={`item-event-source is-${event.source}`}>{event.source}</span>
    <span className="item-event-detail"><strong>{titleCase(event.eventType.replaceAll('.', ' '))}</strong>{detail ? ` — ${detail}` : ''}</span>
  </article>
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })
}

function titleCase(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1) }
function shortRef(id: string): string {
  if (id.startsWith('00000000-0000-4000-8000-000000000')) return `I-${Number(id.slice(-3))}`
  return id.includes('-') ? `…${id.slice(-6)}` : id
}

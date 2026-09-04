import { useMemo, useState } from 'react'
import { dateKey } from '../domain'
import type { CommandData, Commitment } from '../types'
import { EmptyState } from '../ui'
import { kindLabel } from './TodayView'

export function CalendarView({ data, today, onOpenItem, onOutcome }: {
  data: CommandData
  today: Date
  onOpenItem: (id: string) => void
  onOutcome: (commitment: Commitment) => void
}) {
  const todayKey = dateKey(today)
  const [cursor, setCursor] = useState(todayKey.slice(0, 7))
  const [selected, setSelected] = useState(todayKey)
  const entities = useMemo(() => new Map(data.entities.map((entity) => [entity.id, entity])), [data.entities])
  const types = useMemo(() => new Map(data.entityTypes.map((type) => [type.id, type])), [data.entityTypes])
  const byDate = useMemo(() => {
    const groups = new Map<string, Commitment[]>()
    for (const commitment of data.commitments) {
      const entity = entities.get(commitment.entityId)
      if (!entity || entity.archivedAt) continue
      groups.set(commitment.dueOn, [...(groups.get(commitment.dueOn) ?? []), commitment])
    }
    return groups
  }, [data.commitments, entities])
  const days = monthGrid(cursor)
  const agenda = (byDate.get(selected) ?? []).sort(sortCommitments)
  const monthAgenda = [...byDate.entries()]
    .filter(([day]) => day.startsWith(cursor))
    .sort(([left], [right]) => left.localeCompare(right))
  const monthCount = monthAgenda.reduce((total, [, commitments]) => total + commitments.length, 0)

  function moveMonth(amount: number) {
    const [year, month] = cursor.split('-').map(Number)
    const next = new Date(Date.UTC(year, month - 1 + amount, 1))
    const nextCursor = next.toISOString().slice(0, 7)
    setCursor(nextCursor)
    setSelected(`${nextCursor}-01`)
  }

  function goToday() { setCursor(todayKey.slice(0, 7)); setSelected(todayKey) }

  return <main className="calendar-view">
    <div className="gazette-page-heading">
      <div><p>Section 03 · Operational calendar</p><h2>{monthLabel(cursor)}</h2></div>
      <div className="calendar-controls"><button type="button" onClick={() => moveMonth(-1)}>← Prev</button><button type="button" onClick={goToday}>Today</button><button type="button" onClick={() => moveMonth(1)}>Next →</button><span className="calendar-summary">{monthCount} commitments this month</span></div>
    </div>

    <div className="calendar-grid-frame">
      <div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-month-grid">{days.map((day) => {
        const entries = byDate.get(day) ?? []
        return <button className={`${day.startsWith(cursor) ? '' : 'is-outside'}${day === selected ? ' is-selected' : ''}${day === todayKey ? ' is-today' : ''}`} type="button" key={day} onClick={() => setSelected(day)} aria-label={`${longDate(day)}, ${entries.length} commitments`}>
          <b><span>{Number(day.slice(-2))}</span><i>{entries.length || ''}</i></b>
          {entries.slice(0, 3).map((item) => <small className={item.state === 'open' && item.dueOn < todayKey ? 'is-overdue' : ''} key={item.id}><em>{kindLabel(item.kind)}</em>{item.action}</small>)}
        </button>
      })}</div>
    </div>

    <section className="calendar-day-agenda">
      <div className="gazette-agenda-heading"><h3>{longDate(selected)}</h3><p>{agenda.length ? `${agenda.length} filed` : 'Nothing filed'}</p></div>
      {agenda.length === 0 ? <p className="calendar-empty">Nothing filed for this date.</p> : agenda.map((commitment) => <AgendaRow commitment={commitment} data={data} key={commitment.id} onOpenItem={onOpenItem} onOutcome={onOutcome} />)}
    </section>

    <section className="calendar-mobile-agenda" aria-label={`${monthLabel(cursor)} agenda`}>
      {monthAgenda.length === 0 ? <EmptyState message="No commitments stand against this month." /> : monthAgenda.map(([day, commitments]) => <section key={day}><div className="gazette-section-heading"><h3>{shortDate(day)}</h3><p>{commitments.length} filed</p></div>{commitments.sort(sortCommitments).map((commitment) => <AgendaRow commitment={commitment} data={data} key={commitment.id} onOpenItem={onOpenItem} onOutcome={onOutcome} />)}</section>)}
    </section>
  </main>
}

function AgendaRow({ commitment, data, onOpenItem, onOutcome }: {
  commitment: Commitment
  data: CommandData
  onOpenItem: (id: string) => void
  onOutcome: (commitment: Commitment) => void
}) {
  const entity = data.entities.find((item) => item.id === commitment.entityId)
  const type = entity ? data.entityTypes.find((item) => item.id === entity.entityTypeId) : null
  if (!entity) return null
  return <article className="calendar-agenda-row">
    <span>{kindLabel(commitment.kind)}</span>
    <button type="button" onClick={() => onOpenItem(entity.id)}><strong>{commitment.action}</strong></button>
    <em>{type?.singularName ?? 'Record'}</em>
    {commitment.state === 'open' ? <button className="secondary-button" type="button" onClick={() => onOutcome(commitment)}>Record</button> : <span className="agenda-state">{commitment.state}</span>}
  </article>
}

function monthGrid(cursor: string): string[] {
  const [year, month] = cursor.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const start = new Date(Date.UTC(year, month - 1, 1 - offset))
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + index)
    return day.toISOString().slice(0, 10)
  })
}

function sortCommitments(left: Commitment, right: Commitment): number { return left.state.localeCompare(right.state) || left.id.localeCompare(right.id) }
function monthLabel(cursor: string): string { return new Date(`${cursor}-01T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }) }
function longDate(day: string): string { return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
function shortDate(day: string): string { return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }) }

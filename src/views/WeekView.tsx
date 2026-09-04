import { useEffect, useMemo, useState } from 'react'
import { dateFromKey, dateKey } from '../domain'
import type { CommandData, Settings, WeekDaySummary, WeekSummary } from '../types'
import { ViewShell } from '../ui'
import { deriveWeekSummary, weekHasActivity } from '../v3Week'

export function WeekView({ data, settings, today, loadSummary }: {
  data: CommandData
  settings: Settings
  today: Date
  loadSummary?: (day: string) => Promise<WeekSummary>
}) {
  const local = useMemo(() => deriveWeekSummary(data, settings, today), [data, settings, today])
  const [remote, setRemote] = useState<WeekSummary | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setRemote(null)
    if (!loadSummary) {
      setLoadError(false)
      return
    }
    let active = true
    setLoadError(false)
    void loadSummary(dateKey(today))
      .then((summary) => { if (active) setRemote(summary) })
      .catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [loadSummary, today])

  const summary = remote ?? local
  const filed = summary.days.filter(filedDay).length
  const lastFiled = summary.days.reduce((last, day, index) => filedDay(day) ? index : last, -1)
  const filedDays = summary.days.filter(filedDay)
  const totals = {
    node: sum(filedDays.map((day) => day.nodeMinutes)),
    dsa: sum(filedDays.map((day) => day.dsaMinutes)),
    math: sum(filedDays.map((day) => day.mathMinutes)),
  }
  const applicationPct = summary.applicationTarget ? Math.round(summary.applicationsSubmitted / summary.applicationTarget * 100) : 100
  const dsaAboveFloor = totals.dsa >= settings.floors.dsa * filed
  const stats = [
    { key: 'node', label: 'Systems minutes', value: totals.node, unit: 'min', note: `${filed} days filed`, tone: '' },
    { key: 'dsa', label: 'Algorithm minutes', value: totals.dsa, unit: 'min', note: dsaAboveFloor ? 'Above floor' : 'Below floor', tone: dsaAboveFloor ? 'is-good' : 'is-short' },
    { key: 'math', label: 'Theory minutes', value: totals.math, unit: 'min', note: 'Steady', tone: '' },
    { key: 'job', label: 'Applications filed', value: summary.applicationsSubmitted, unit: `of ${summary.applicationTarget}`, note: `${applicationPct}% of budget`, tone: applicationPct >= 100 ? 'is-good' : '' },
    { key: 'people', label: 'People contacted', value: summary.peopleContacted, unit: `of ${summary.peopleTarget}`, note: summary.peopleContacted >= summary.peopleTarget ? 'Target protected' : 'Current week', tone: summary.peopleContacted >= summary.peopleTarget ? 'is-good' : '' },
    { key: 'commitments', label: 'Commitments discharged', value: summary.commitments.completed, unit: `${summary.commitments.cancelled} cancelled`, note: summary.commitments.missed > 0 ? `${summary.commitments.missed} missed` : 'Nothing missed', tone: summary.commitments.missed > 0 ? 'is-short' : 'is-good' },
    { key: 'proposals', label: 'Agent drafts filed', value: summary.proposals.proposed, unit: `${summary.proposals.approved} accepted`, note: `${summary.proposals.rejected} spiked`, tone: '' },
  ]

  return <main><ViewShell eyebrow="Section 05 · Sunday retrospective" title="The week in review">
    {loadError && <p className="view-hint" role="status">Could not refresh Week. Showing the latest cached summary.</p>}
    {!weekHasActivity(summary) && <p className="week-empty">No activity recorded yet. The Monday–Sunday structure stays ready.</p>}

    <div className="week-summary-grid">{stats.map((stat) => <article className="week-summary" key={stat.key}>
      <div className="week-summary-label">{stat.label}</div>
      <div className="week-summary-value"><strong>{stat.value}</strong><span>{stat.unit}</span></div>
      <div className={`week-summary-note ${stat.tone}`}>{stat.note}</div>
    </article>)}</div>

    <section className="week-section" aria-labelledby="week-days-title">
      <h3 id="week-days-title">Day by day</h3>
      <div className="week-table">
        <div className="week-table-row week-table-head"><span>Day</span><span>Sys</span><span>Alg</span><span>Thy</span><span>Out</span><span>State</span></div>
        {summary.days.map((day, index) => <DayRow day={day} floors={settings.floors} outreach={outreachFor(data, day.day)} state={!filedDay(day) ? 'pending' : index === lastFiled ? 'logged' : 'complete'} key={day.day} />)}
      </div>
    </section>
  </ViewShell></main>
}

function DayRow({ day, floors, outreach, state }: { day: WeekDaySummary; floors: Settings['floors']; outreach: number | null; state: string }) {
  const label = dateFromKey(day.day).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'long' })
  const open = filedDay(day)
  const cells = [
    { key: 'node', value: open ? day.nodeMinutes : null, target: floors.node },
    { key: 'dsa', value: open ? day.dsaMinutes : null, target: floors.dsa },
    { key: 'math', value: open ? day.mathMinutes : null, target: floors.math },
    { key: 'out', value: open ? outreach : null, target: null },
  ]
  return <div className="week-table-row">
    <span className="week-table-day">{label}</span>
    {cells.map((cell) => <span className={cell.value === null ? 'is-pending' : cell.target && cell.value >= cell.target ? 'is-met' : ''} key={cell.key}>{cell.value === null ? '·' : cell.value}</span>)}
    <span className={`week-table-state is-${state}`}>{state}</span>
  </div>
}

// A day is only filed once it has happened and carries a log.
function filedDay(day: WeekDaySummary): boolean { return day.hasLog && !day.isFuture }

function outreachFor(data: CommandData, day: string): number | null {
  const events = data.activityEvents.filter((event) => event.eventType === 'application.submitted' && dateKey(new Date(event.occurredAt)) === day)
  return events.length
}

function sum(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0)
}

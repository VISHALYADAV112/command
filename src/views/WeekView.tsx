import { useEffect, useMemo, useState } from 'react'
import { compactDuration, dateFromKey, dateKey } from '../domain'
import type { CommandData, Settings, WeekDaySummary, WeekPracticeKey, WeekSummary } from '../types'
import { ViewShell } from '../ui'
import { deriveWeekSummary, weekHasActivity } from '../v3Week'

const practices: Array<{ key: WeekPracticeKey; label: string }> = [
  { key: 'node', label: 'Node' },
  { key: 'dsa', label: 'DSA' },
  { key: 'math', label: 'Math' },
]

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
  return <main><ViewShell eyebrow="Weekly review" title="This week" aside={rangeLabel(summary)}>
    {loadError && <p className="view-hint" role="status">Could not refresh Week. Showing the latest cached summary.</p>}
    {!weekHasActivity(summary) && <p className="week-empty">No activity recorded yet. The Monday–Sunday structure stays ready.</p>}

    <section className="week-section" aria-labelledby="week-practice-title">
      <h3 id="week-practice-title">Practice totals</h3>
      <div className="week-practice-grid">{practices.map(({ key, label }) => {
        const progress = summary.practice[key]
        return <article className="week-stat" key={key}><span>{label}</span><strong>{compactDuration(progress.minutes)}</strong><small>of {compactDuration(progress.target)}</small></article>
      })}</div>
    </section>

    <section className="week-section" aria-labelledby="week-movement-title">
      <h3 id="week-movement-title">Outcome movement</h3>
      <div className="week-movement-grid">
        <ProgressStat label="Applications submitted" value={summary.applicationsSubmitted} target={summary.applicationTarget} />
        <ProgressStat label="New people contacted" value={summary.peopleContacted} target={summary.peopleTarget} />
      </div>
    </section>

    <section className="week-section" aria-labelledby="week-days-title">
      <h3 id="week-days-title">Monday–Sunday execution</h3>
      <div className="week-day-list">{summary.days.map((day) => <DayRow day={day} todayKey={dateKey(today)} key={day.day} />)}</div>
    </section>

    <div className="week-outcome-columns">
      <CountGroup title="Commitment outcomes" values={summary.commitments} labels={{ completed: 'Completed', cancelled: 'Cancelled', missed: 'Missed' }} />
      <CountGroup title="Agent proposals" values={summary.proposals} labels={{ proposed: 'Proposed', approved: 'Approved', rejected: 'Rejected' }} />
    </div>
  </ViewShell></main>
}

function ProgressStat({ label, value, target }: { label: string; value: number; target: number }) {
  return <article className="week-progress"><span>{label}</span><strong>{value} / {target}</strong><small>{target > 0 && value >= target ? 'Target protected' : 'Current week'}</small></article>
}

function DayRow({ day, todayKey }: { day: WeekDaySummary; todayKey: string }) {
  const label = dateFromKey(day.day).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short' })
  return <article className={`week-day-row${day.day === todayKey ? ' is-today' : ''}${day.isFuture ? ' is-future' : ''}`}>
    <div className="week-day-name"><strong>{label}</strong>{day.day === todayKey && <small>Today</small>}</div>
    {day.isFuture ? <p className="week-pending">Pending</p> : day.hasLog ? <>
      <DayValue label="Node" value={duration(day.nodeMinutes)} />
      <DayValue label="DSA" value={duration(day.dsaMinutes)} />
      <DayValue label="Math" value={duration(day.mathMinutes)} />
      <DayValue label="Meditation" value={yesNo(day.meditation)} />
      <DayValue label="Gym" value={yesNo(day.gym)} />
      <DayValue label="Diet" value={day.diet?.replace('_', ' ') ?? '—'} />
    </> : <p className="week-unlogged">Not logged</p>}
  </article>
}

function DayValue({ label, value }: { label: string; value: string }) {
  return <div className="week-day-value"><span>{label}</span><strong>{value}</strong></div>
}

function CountGroup<T extends string>({ title, values, labels }: {
  title: string
  values: Record<T, number>
  labels: Record<T, string>
}) {
  return <section className="week-count-group"><h3>{title}</h3><dl>{(Object.keys(labels) as T[]).map((key) => <div key={key}><dt>{labels[key]}</dt><dd>{values[key]}</dd></div>)}</dl></section>
}

function duration(value: number | null): string { return value === null ? '—' : compactDuration(value) }
function yesNo(value: boolean | null): string { return value === null ? '—' : value ? 'Yes' : 'No' }
function rangeLabel(summary: WeekSummary): string { return `${shortDate(summary.weekStart)} — ${shortDate(summary.weekEnd)} · Asia/Kolkata` }
function shortDate(value: string): string { return dateFromKey(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }) }

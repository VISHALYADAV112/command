import type { CommandData, Commitment, Settings } from '../types'
import { currentWeek, dateKey, dayDistance } from '../domain'
import { EmptyState } from '../ui'
import { dueItems, threeFloorStatus, weeklyOutcomeProgress } from '../v3Selectors'
import { pendingProposalCount } from './AgentInboxSheet'

const floorDesks: Record<string, string> = { node: 'Systems', dsa: 'Algorithms', math: 'Theory' }

export function TodayView({ data, settings, today, onLog, onCapture, onOutcome, onOpenItem, onOpenAgentInbox, onOpenDue, onOpenWeek }: {
  data: CommandData
  settings: Settings
  today: Date
  onLog: () => void
  onCapture: () => void
  onOutcome: (commitment: Commitment) => void
  onOpenItem: (id: string) => void
  onOpenAgentInbox?: () => void
  onOpenDue?: () => void
  onOpenWeek?: () => void
}) {
  const floors = threeFloorStatus(data, settings, today)
  const overdue = dueItems(data, today, 'overdue')
  const dueToday = dueItems(data, today, 'today')
  const queue = dueItems(data, today).slice(0, 5)
  const weekly = weeklyOutcomeProgress(data, today)
  const floorsMet = floors.filter((floor) => floor.met).length
  const allFloorsMet = floorsMet === floors.length
  const pendingAgents = pendingProposalCount(data)
  const leadItem = overdue[0] ?? dueToday[0] ?? null
  const shortMinutes = floors.reduce((total, floor) => total + Math.max(0, floor.target - floor.minutes), 0)
  const lead = leadItem ? {
    kicker: leadItem.dueStatus === 'overdue' ? 'Overdue' : 'Due today',
    severity: leadItem.dueStatus === 'overdue' ? verboseDue(today, leadItem.commitment.dueOn) : `${dueToday.length} ${dueToday.length === 1 ? 'commitment' : 'commitments'} close today`,
    title: leadItem.commitment.action,
    standfirst: `${titleCase(leadItem.commitment.kind)} against “${leadItem.entity.title}” ${leadItem.dueStatus === 'overdue' ? `was owed on ${longDate(leadItem.commitment.dueOn)}` : 'closes today'}. Record the outcome, not merely the completion.`,
  } : allFloorsMet ? {
    kicker: 'All clear', severity: 'An unencumbered desk', title: 'Every floor met, nothing owed',
    standfirst: 'Bank the margin and file the evening practice log while the work is still clear.',
  } : {
    kicker: 'Floors', severity: `${shortMinutes} minutes short`,
    title: floors.filter((floor) => !floor.met).map((floor) => floor.label).join(' · '),
    standfirst: 'No commitment falls due. What remains is the ordinary work against the standing floors.',
  }

  return <main>
    <section className="today-zone v3-today">
      {pendingAgents > 0 && onOpenAgentInbox && <button className="stop-press" type="button" aria-label={`Agent inbox · ${pendingAgents}`} onClick={onOpenAgentInbox}><b>Stop press</b><span><strong>{pendingAgents} agent {pendingAgents === 1 ? 'draft' : 'drafts'} on the wire</strong> awaiting an editor.</span><u>Review →</u></button>}

      <article className={`gazette-lede urgent-lead${leadItem?.dueStatus === 'overdue' ? ' is-overdue' : ''}`}>
        <p className="gazette-kicker"><span aria-hidden="true">𑀢</span>{lead.kicker}</p>
        <h2>{lead.severity}</h2>
        <h3>{lead.title}</h3>
        <p className="gazette-standfirst">{lead.standfirst}</p>
        <div className="gazette-lede-actions">
          <span>{leadItem ? `Ref ${shortRef(leadItem.entity.id)} · ${titleCase(leadItem.commitment.kind)}` : `${floorsMet} of 3 floors met`}</span>
          {leadItem ? <><button className="danger-button" type="button" onClick={() => onOutcome(leadItem.commitment)}>Record the outcome</button><button className="text-link" type="button" onClick={() => onOpenItem(leadItem.entity.id)}>Open record →</button></> : <button className="capture-button" type="button" onClick={onLog}>File the practice log</button>}
        </div>
      </article>

      <section className="floor-field is-after-exception" aria-labelledby="floor-title">
        <div className="gazette-section-heading"><h3 id="floor-title"><span aria-hidden="true">𑀫</span>The day's floors</h3><p>{floorsMet} of 3 met · {floors.reduce((sum, floor) => sum + floor.minutes, 0)} of {floors.reduce((sum, floor) => sum + floor.target, 0)} min</p></div>
        <div className="floor-grid three-floors">{floors.map((floor) => {
          const pct = floor.target ? Math.min(100, Math.round(floor.minutes / floor.target * 100)) : 100
          return <article className="floor" key={floor.key}>
            <div><span>{floorDesks[floor.key]}</span><small className={floor.met ? 'is-met' : ''}>{floor.met ? 'Met' : `${floor.target - floor.minutes} min short`}</small></div>
            <p>{floor.label === 'Node' ? 'Node.js engineering floor' : floor.label === 'DSA' ? 'DSA & algorithmic drills' : 'Math theory & computation'}</p>
            <strong>{floor.minutes}<small>of {floor.target} min</small></strong>
            <i><b className={floor.met ? 'is-met' : ''} style={{ width: `${pct}%` }} /></i>
          </article>
        })}
          <article className="floor outreach-floor">
            <div><span>Outreach</span><small className={weekly.applications >= settings.weeklyTargets.applications ? 'is-met' : ''}>{weekly.applications >= settings.weeklyTargets.applications ? 'Met' : `${Math.max(0, settings.weeklyTargets.applications - weekly.applications)} to file`}</small></div>
            <p>Weekly application cadence</p>
            <strong>{weekly.applications}<small>of {settings.weeklyTargets.applications} filed</small></strong>
            <i><b className={weekly.applications >= settings.weeklyTargets.applications ? 'is-met' : ''} style={{ width: `${settings.weeklyTargets.applications ? Math.min(100, weekly.applications / settings.weeklyTargets.applications * 100) : 100}%` }} /></i>
          </article>
        </div>
        <div className="weekly-targets" role="group" aria-label="Weekly outcome progress"><span>Applications submitted <strong>{weekly.applications} / {settings.weeklyTargets.applications}</strong></span><span>New people contacted <strong>{weekly.peopleContacted} / {settings.weeklyTargets.peopleContacted}</strong></span></div>
      </section>
    </section>

    <section className="zone view-zone compact-queue">
      <div className="gazette-section-heading"><h3><span aria-hidden="true">𑀤</span>The standing queue</h3>{onOpenDue && <button className="text-link" type="button" onClick={onOpenDue}>Full queue →</button>}</div>
      {queue.length === 0 ? <EmptyState message="No open commitments. Capture work only when it earns a clear next date." /> : <CommitmentQueue items={queue} today={today} onOutcome={onOutcome} onOpenItem={onOpenItem} />}
    </section>

    <ExecutionStrip data={data} settings={settings} today={today} onOpenWeek={onOpenWeek} />
    <div className="today-mobile-log"><button className="log-button" type="button" aria-label={allFloorsMet ? 'Review today' : 'Log today'} onClick={onLog}>{allFloorsMet ? 'Review today' : 'File daily log'}</button><button className="capture-button" type="button" onClick={onCapture}>+ Capture</button></div>
  </main>
}

export function CommitmentQueue({ items, today, onOutcome, onOpenItem }: {
  items: ReturnType<typeof dueItems>
  today: Date
  onOutcome: (commitment: Commitment) => void
  onOpenItem: (id: string) => void
}) {
  return <div className="commitment-list">{items.map((item) => <article className={`commitment-row is-${item.dueStatus}`} key={item.commitment.id}>
    <span className="commitment-when">{verboseDue(today, item.commitment.dueOn)}</span>
    <button type="button" className="item-button commitment-main" onClick={() => onOpenItem(item.entity.id)}><strong>{item.commitment.action}</strong><small>{item.entity.title}</small></button>
    <span className="commitment-kind">{titleCase(item.commitment.kind)}</span>
    <span className="commitment-ref">{shortRef(item.entity.id)}</span>
    <button className="secondary-button commitment-outcome" type="button" aria-label="Outcome" onClick={() => onOutcome(item.commitment)}>Record</button>
  </article>)}</div>
}

function ExecutionStrip({ data, settings, today, onOpenWeek }: { data: CommandData; settings: Settings; today: Date; onOpenWeek?: () => void }) {
  const week = currentWeek(today).map(dateKey)
  const logs = new Map(data.legacy.logs.map((log) => [log.day, log]))
  const submitted = new Map<string, number>()
  for (const event of data.activityEvents.filter((item) => item.eventType === 'application.submitted')) {
    const day = dateKey(new Date(event.occurredAt))
    submitted.set(day, (submitted.get(day) ?? 0) + 1)
  }
  const rows = [
    { key: 'node', label: 'Sys', unit: 'min', target: settings.floors.node, value: (day: string) => logs.get(day)?.nodeMinutes },
    { key: 'dsa', label: 'Alg', unit: 'min', target: settings.floors.dsa, value: (day: string) => logs.get(day)?.dsaMinutes },
    { key: 'math', label: 'Thy', unit: 'min', target: settings.floors.math, value: (day: string) => logs.get(day)?.mathMinutes },
    { key: 'out', label: 'Out', unit: 'count', target: null, value: (day: string) => submitted.get(day) },
  ]
  const todayKey = dateKey(today)
  return <section className="execution-strip">
    <div className="gazette-section-heading"><h3><span aria-hidden="true">𑀭</span>Seven-day execution strip</h3>{onOpenWeek && <button className="text-link" type="button" onClick={onOpenWeek}>Retrospective →</button>}</div>
    <div className="execution-table" role="table" aria-label="Seven-day execution strip">
      <div className="execution-row execution-head" role="row"><span>Desk</span><span>Unit</span>{week.map((day) => <span key={day}>{new Date(`${day}T06:30:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Kolkata' })}</span>)}<span>Total</span></div>
      {rows.map((row) => {
        const values = week.map((day) => day > todayKey ? null : row.value(day))
        return <div className="execution-row" role="row" key={row.key}><strong>{row.label}</strong><small>{row.unit}</small>{values.map((value, index) => <span className={row.target && value !== undefined && value !== null && value >= row.target ? 'met' : ''} key={week[index]}>{value ?? '·'}</span>)}<strong>{values.reduce<number>((sum, value) => sum + (value ?? 0), 0)}</strong></div>
      })}
    </div>
    <div className="execution-mobile-list" aria-label="Seven-day execution strip">
      {week.map((day) => <article className={day === todayKey ? 'is-today' : ''} key={day}>
        <header><strong>{new Date(`${day}T06:30:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })}</strong><span>{day > todayKey ? 'Pending' : logs.has(day) ? 'Filed' : 'Unlogged'}</span></header>
        <div>{rows.map((row) => { const value = day > todayKey ? null : row.value(day); return <span key={row.key}><small>{row.label}</small><strong className={row.target && value !== undefined && value !== null && value >= row.target ? 'met' : ''}>{value ?? '·'}</strong></span> })}</div>
      </article>)}
    </div>
    <p className="execution-note">Bold figures met the standing floor.</p>
  </section>
}

function verboseDue(today: Date, dueOn: string): string {
  const distance = dayDistance(today, dueOn)
  if (distance < 0) return `${Math.abs(distance)} ${Math.abs(distance) === 1 ? 'day' : 'days'} overdue`
  if (distance === 0) return 'Due today'
  if (distance === 1) return 'Due tomorrow'
  return `In ${distance} days`
}

function longDate(day: string): string {
  return new Date(`${day}T06:30:00.000Z`).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function titleCase(value: string): string { return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function shortRef(id: string): string { return id.includes('-') ? `…${id.slice(-6)}` : id }

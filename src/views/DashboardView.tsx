import { useMemo, type CSSProperties, type ReactNode } from 'react'
import {
  compactDuration, currentWeek, dateKey, dayDistance, floorStatus,
  hoursValue, minutesFor, practices, weeklyTotals,
} from '../domain'
import type { CommandData, DailyLog, JobApplication, LearningItem, Settings } from '../types'
import { DoubleRule, GateMark, Icon, ZoneHeading } from '../ui'

const statusLabel = {
  researching: 'Researching', applied: 'Applied', oa: 'OA', phone: 'Phone',
  onsite: 'Onsite', offer: 'Offer', rejected: 'Rejected',
} as const

interface Props {
  data: CommandData
  settings: Settings
  today: Date
  onLog: () => void
  onAddApplication: () => void
  onEditApplication: (application: JobApplication) => void
  onReview: (item: LearningItem) => void
  quickActions?: ReactNode
  calendar?: ReactNode
}

export function DashboardView(props: Props) {
  return (
    <main>
      <TodayInstrument log={props.data.logs.find((log) => log.day === dateKey(props.today))} settings={props.settings} onOpen={props.onLog} />
      {props.quickActions}
      {props.calendar}
      <DoubleRule />
      <WeeklyField logs={props.data.logs} settings={props.settings} today={props.today} />
      <DoubleRule />
      <OuterField data={props.data} today={props.today} onAddApplication={props.onAddApplication} onEditApplication={props.onEditApplication} />
      <DoubleRule />
      <ReviewQueue items={props.data.learning} today={props.today} onReview={props.onReview} />
    </main>
  )
}

function TodayInstrument({ log, settings, onOpen }: { log?: DailyLog; settings: Settings; onOpen: () => void }) {
  const status = floorStatus(log, settings.floors)
  const completed = Object.values(status).filter(Boolean).length
  return (
    <section className="today-zone" aria-labelledby="today-title">
      <p className="today-kicker" id="today-title">Today</p>
      <div className="bindu" aria-label={`${completed} of 4 daily floors met`}>
        {practices.map(({ key, label }) => (
          <span key={key} className={`bindu-dot ${status[key] ? 'is-met' : ''}`} role="img"
            aria-label={`${label} floor ${status[key] ? 'met' : 'not met'}`}
            title={`${label}: ${compactDuration(minutesFor(log, key))} / ${compactDuration(settings.floors[key])}`} />
        ))}
      </div>
      <div className="floor-field">
        <div className="floor-grid">
          {practices.map(({ key, label }) => (
            <div className="floor" key={key}><GateMark /><span>{label}</span><strong>{compactDuration(settings.floors[key])}</strong></div>
          ))}
        </div>
        <p>Floors first, then follow interest.</p>
      </div>
      <div className="today-action-row">
        <button className="primary-button" type="button" onClick={onOpen}>
          <span>{completed === 0 ? 'Log today' : 'Continue today'}</span><Icon name="arrow" />
        </button>
        <span className="completion-copy">{completed === 4 ? 'All floors protected.' : `${completed} of 4 floors protected.`}</span>
      </div>
    </section>
  )
}

function WeeklyField({ logs, settings, today }: { logs: DailyLog[]; settings: Settings; today: Date }) {
  const week = useMemo(() => currentWeek(today), [today])
  const totals = useMemo(() => weeklyTotals(logs, week), [logs, week])
  const logMap = useMemo(() => new Map(logs.map((log) => [log.day, log])), [logs])
  return (
    <section className="zone weekly-zone" aria-labelledby="week-title">
      <ZoneHeading eyebrow="Inner field · Kolam" title="This week" aside={<span>{dateKey(week[0]).slice(5)} — {dateKey(week[6]).slice(5)}</span>} />
      <div className="totals-grid" aria-label="Weekly totals">
        {practices.map(({ key, label }) => (
          <div className="total" key={key}><span>{label}</span><strong>{compactDuration(totals[key])}</strong><small>of {compactDuration(settings.budgets[key])}</small></div>
        ))}
      </div>
      <div className="week-table-wrap">
        <table className="week-table">
          <thead><tr><th>Day</th>{practices.map(({ key, shortLabel }) => <th key={key}>{shortLabel}</th>)}<th>Meditate</th><th>Gym</th><th>Diet</th></tr></thead>
          <tbody>
            {week.map((day) => {
              const key = dateKey(day)
              const log = logMap.get(key)
              return (
                <tr className={key === dateKey(today) ? 'is-today' : ''} key={key}>
                  <th><span>{day.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}</span><small>{key.slice(-2)}</small></th>
                  {practices.map((practice) => <td key={practice.key}>{hoursValue(minutesFor(log, practice.key))}</td>)}
                  <td><BooleanMark value={log?.meditation} /></td><td><BooleanMark value={log?.gym} /></td>
                  <td className="diet-cell">{log?.diet ? log.diet.replace('_', ' ') : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="week-strip" aria-label="Days logged this week">
        {week.map((day) => {
          const key = dateKey(day)
          const log = logMap.get(key)
          const count = Object.values(floorStatus(log, settings.floors)).filter(Boolean).length
          return <div className={key === dateKey(today) ? 'is-today' : ''} key={key}><span>{day.toLocaleDateString('en-IN', { weekday: 'narrow', timeZone: 'Asia/Kolkata' })}</span><i className={log ? 'has-log' : ''} style={{ '--completion': count } as CSSProperties} /></div>
        })}
      </div>
      <p className="budget-note">Budget · {practices.map(({ key, label }) => `${label} ${hoursValue(settings.budgets[key])}h`).join(' · ')}</p>
    </section>
  )
}

function BooleanMark({ value }: { value?: boolean }) {
  if (value === undefined) return <span className="boolean empty">—</span>
  return value ? <span className="boolean yes" aria-label="Done"><Icon name="check" /></span> : <span className="boolean no" aria-label="Not done">·</span>
}

function OuterField({ data, today, onAddApplication, onEditApplication }: {
  data: CommandData; today: Date; onAddApplication: () => void; onEditApplication: (app: JobApplication) => void
}) {
  const closing = data.applications.filter((app) => app.status === 'researching' && app.windowClosesOn && dayDistance(today, app.windowClosesOn) >= 0 && dayDistance(today, app.windowClosesOn) <= 30).sort(byWindow)
  const active = data.applications.filter((app) => !['rejected', 'offer'].includes(app.status)).sort(byFollowUp).slice(0, 4)
  const people = data.people.filter((person) => person.status === 'to_reach_out' || person.nextFollowUpOn && dayDistance(today, person.nextFollowUpOn) <= 0).slice(0, 3)
  const work = data.projects.filter((project) => project.status === 'active' || project.status === 'blocked').sort((a, b) => (a.deadlineOn ?? '9999').localeCompare(b.deadlineOn ?? '9999'))
  return (
    <section className="zone outer-zone" aria-labelledby="outer-title">
      <ZoneHeading eyebrow="Outer field · Vairagya" title="What moves around you" />
      <div className="outer-grid">
        <div className="outer-column">
          <div className="column-title-row"><h3>Job hunt</h3><button className="icon-button" type="button" onClick={onAddApplication} aria-label="Add application"><Icon name="plus" /></button></div>
          {closing.length > 0 && <ClosingWindow items={closing} today={today} onEdit={onEditApplication} />}
          <div className="subsection-heading"><span>Active applications</span><small>{active.length}</small></div>
          <div className="item-list">{active.map((app) => <ApplicationRow key={app.id} app={app} today={today} onEdit={onEditApplication} />)}</div>
          {people.length > 0 && <><div className="subsection-heading"><span>People to contact</span><small>{people.length}</small></div><div className="people-list">{people.map((person) => <div key={person.id}><span className="person-initial">{person.name.charAt(0)}</span><div><strong>{person.name}</strong><small>{person.company}</small></div></div>)}</div></>}
        </div>
        <div className="outer-void" aria-hidden="true" />
        <div className="outer-column">
          <div className="column-title-row"><h3>Work</h3><span className="column-count">{work.length} moving</span></div>
          <div className="item-list work-list">{work.map((project) => <article className="list-item project-item" key={project.id}><div className="item-main"><div><strong>{project.name}</strong><span>{project.type}</span></div><span className={`status-pill project-${project.status}`}>{project.status}</span></div><p>{project.nextAction}</p>{project.deadlineOn && <DueDate date={project.deadlineOn} today={today} prefix="Due" />}</article>)}</div>
          <div className="portfolio-target"><span>Public portfolio</span><strong>{data.projects.filter((project) => project.status === 'done' && project.type === 'portfolio' && project.isPublic).length} / 3</strong></div>
        </div>
      </div>
    </section>
  )
}

function ClosingWindow({ items, today, onEdit }: { items: JobApplication[]; today: Date; onEdit: (app: JobApplication) => void }) {
  return <div className="closing-window"><span className="closing-label">Closing soon</span>{items.map((app) => <button className="closing-row closing-clickable" key={app.id} type="button" onClick={() => onEdit(app)}><div><strong>{app.company}</strong><span>{app.role}</span></div><time dateTime={app.windowClosesOn ?? ''}>{dayDistance(today, app.windowClosesOn!)}d</time></button>)}</div>
}

function ApplicationRow({ app, today, onEdit }: { app: JobApplication; today: Date; onEdit: (app: JobApplication) => void }) {
  return <article className="list-item"><button type="button" className="item-button" onClick={() => onEdit(app)}><div className="item-main"><div><strong>{app.company}</strong><span>{app.role}</span></div><span className={`status-pill status-${app.status}`}>{statusLabel[app.status]}</span></div><p>{app.nextAction}</p>{app.followUpOn && <DueDate date={app.followUpOn} today={today} prefix="Follow up" />}</button></article>
}

function DueDate({ date, today, prefix }: { date: string; today: Date; prefix: string }) {
  const distance = dayDistance(today, date)
  const label = distance < 0 ? `${Math.abs(distance)}d overdue` : distance === 0 ? 'today' : distance === 1 ? 'tomorrow' : `in ${distance}d`
  return <time className={distance <= 0 ? 'is-due' : ''} dateTime={date}>{prefix} {label}</time>
}

function ReviewQueue({ items, today, onReview }: { items: LearningItem[]; today: Date; onReview: (item: LearningItem) => void }) {
  const due = items.filter((item) => item.nextReviewOn && dayDistance(today, item.nextReviewOn) <= 0).sort((a, b) => a.confidence - b.confidence).slice(0, 8)
  return <section className="zone review-zone" aria-labelledby="review-title"><ZoneHeading eyebrow="Memory · Smriti" title="Review queue" aside={<span className="due-count">{due.length} due</span>} />{due.length === 0 ? <div className="empty-state"><Icon name="spark" /><p>Nothing due. Leave the space empty.</p></div> : <div className="review-list">{due.map((item, index) => <button type="button" className="review-item" onClick={() => onReview(item)} key={item.id}><span className="review-index">{String(index + 1).padStart(2, '0')}</span><span className="review-concept"><strong>{item.concept}</strong><small>{item.track} · {item.itemType}</small></span><span className="confidence">C{item.confidence}</span><Icon name="arrow" /></button>)}</div>}</section>
}

function byWindow(a: JobApplication, b: JobApplication) { return (a.windowClosesOn ?? '').localeCompare(b.windowClosesOn ?? '') }
function byFollowUp(a: JobApplication, b: JobApplication) { return (a.followUpOn ?? '9999').localeCompare(b.followUpOn ?? '9999') }

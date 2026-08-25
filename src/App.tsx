import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  addDays,
  compactDuration,
  currentWeek,
  dateFromKey,
  dateKey,
  dayDistance,
  emptyLog,
  floorStatus,
  hoursValue,
  minutesFor,
  practices,
  weeklyTotals,
} from './domain'
import type {
  ApplicationChannel,
  ApplicationStatus,
  CommandData,
  DailyLog,
  Idea,
  JobApplication,
  LearningItem,
  Person,
  PracticeKey,
  Project,
  Settings,
} from './types'
import { useCommandData } from './useCommandData'
import { AuthScreen } from './AuthScreen'
import { SettingsSheet } from './SettingsSheet'
import { CalendarStrip } from './CalendarStrip'
import { exportCsv, exportData } from './lib/api'
import { createCalendarEvent } from './lib/calendar'
import { GateMark, Icon, Sheet, uid } from './ui'
import { PeopleView } from './views/PeopleView'
import { ProjectsView } from './views/ProjectsView'
import { IdeasView } from './views/IdeasView'
import { LearningView } from './views/LearningView'

const statusLabel: Record<ApplicationStatus, string> = {
  researching: 'Researching',
  applied: 'Applied',
  oa: 'OA',
  phone: 'Phone',
  onsite: 'Onsite',
  offer: 'Offer',
  rejected: 'Rejected',
}

function DoubleRule() {
  return <div className="double-rule" aria-hidden="true" />
}

function ZoneHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return (
    <div className="zone-heading">
      <div>
        <span className="eyebrow"><GateMark />{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {aside && <div className="zone-aside">{aside}</div>}
    </div>
  )
}

function useHashRoute(): [string, (route: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('?')[0]
  const [route, setRoute] = useState(read)
  useEffect(() => {
    function onHash() { setRoute(read()) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  function navigate(next: string) {
    window.location.hash = next ? `#/${next}` : '#/'
    setRoute(next)
  }
  return [route, navigate]
}

const routes = [
  { path: '', label: 'Today' },
  { path: 'people', label: 'People' },
  { path: 'projects', label: 'Projects' },
  { path: 'ideas', label: 'Ideas' },
  { path: 'learning', label: 'Learning' },
]

function ViewNav({ route, navigate }: { route: string; navigate: (route: string) => void }) {
  return (
    <nav className="view-nav" aria-label="Sections">
      {routes.map((item) => (
        <button
          key={item.path}
          type="button"
          className={route === item.path ? 'is-active' : ''}
          onClick={() => navigate(item.path)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

function AppHeader({ today, live, onOpenSettings }: { today: Date; live: boolean; onOpenSettings: () => void }) {
  return (
    <header className="app-header">
      <a className="wordmark" href="#top" aria-label="Command dashboard home">
        <img src="./assets/command-mark.svg" alt="" />
        <span>Command</span>
      </a>
      <div className="header-meta">
        <span className={live ? 'live-label' : 'prototype-label'}>{live ? 'Live' : 'Local prototype'}</span>
        <time dateTime={dateKey(today)}>
          {today.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
        </time>
        <button className="header-action" type="button" onClick={onOpenSettings} aria-label="Open settings">
          <Icon name="settings" />
        </button>
      </div>
    </header>
  )
}

function TodayInstrument({ log, settings, onOpen }: { log: DailyLog; settings: Settings; onOpen: () => void }) {
  const status = floorStatus(log)
  const completed = Object.values(status).filter(Boolean).length

  return (
    <section className="today-zone" aria-labelledby="today-title">
      <p className="today-kicker" id="today-title">Today</p>
      <div className="bindu" aria-label={`${completed} of 4 daily floors met`}>
        {practices.map(({ key, label }) => (
          <span
            key={key}
            className={`bindu-dot ${status[key] ? 'is-met' : ''}`}
            role="img"
            aria-label={`${label} floor ${status[key] ? 'met' : 'not met'}`}
            title={`${label}: ${compactDuration(minutesFor(log, key))} / ${compactDuration(settings.floors[key])}`}
          />
        ))}
      </div>

      <div className="floor-field">
        <div className="floor-grid">
          {practices.map(({ key, label }) => (
            <div className="floor" key={key}>
              <GateMark />
              <span>{label}</span>
              <strong>{compactDuration(settings.floors[key])}</strong>
            </div>
          ))}
        </div>
        <p>Floors first, then follow interest.</p>
      </div>

      <div className="today-action-row">
        <button className="primary-button" type="button" onClick={onOpen}>
          <span>{completed === 0 ? 'Log today' : 'Continue today'}</span>
          <Icon name="arrow" />
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
      <ZoneHeading
        eyebrow="Inner field · Kolam"
        title="This week"
        aside={<span>{dateKey(week[0]).slice(5)} — {dateKey(week[6]).slice(5)}</span>}
      />

      <div className="totals-grid" aria-label="Weekly totals">
        {practices.map(({ key, label }) => (
          <div className="total" key={key}>
            <span>{label}</span>
            <strong>{compactDuration(totals[key])}</strong>
            <small>of {compactDuration(settings.budgets[key])}</small>
          </div>
        ))}
      </div>

      <div className="week-table-wrap">
        <table className="week-table">
          <thead>
            <tr>
              <th>Day</th>
              {practices.map(({ key, shortLabel }) => <th key={key}>{shortLabel}</th>)}
              <th>Meditate</th>
              <th>Gym</th>
              <th>Diet</th>
            </tr>
          </thead>
          <tbody>
            {week.map((day) => {
              const key = dateKey(day)
              const log = logMap.get(key)
              const isToday = key === dateKey(today)
              return (
                <tr className={isToday ? 'is-today' : ''} key={key}>
                  <th>
                    <span>{day.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                    <small>{day.getDate()}</small>
                  </th>
                  {practices.map((practice) => <td key={practice.key}>{hoursValue(minutesFor(log, practice.key))}</td>)}
                  <td><BooleanMark value={log?.meditation} /></td>
                  <td><BooleanMark value={log?.gym} /></td>
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
          const count = Object.values(floorStatus(log)).filter(Boolean).length
          return (
            <div className={key === dateKey(today) ? 'is-today' : ''} key={key}>
              <span>{day.toLocaleDateString('en-IN', { weekday: 'narrow' })}</span>
              <i className={log ? 'has-log' : ''} style={{ '--completion': count } as CSSProperties} />
            </div>
          )
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
  data: CommandData
  today: Date
  onAddApplication: () => void
  onEditApplication: (app: JobApplication) => void
}) {
  const closing = data.applications
    .filter((app) => app.status === 'researching' && app.windowClosesOn && dayDistance(today, app.windowClosesOn) >= 0 && dayDistance(today, app.windowClosesOn) <= 30)
    .sort((a, b) => (a.windowClosesOn ?? '').localeCompare(b.windowClosesOn ?? ''))
  const active = data.applications
    .filter((app) => app.status !== 'rejected' && app.status !== 'offer')
    .sort((a, b) => (a.followUpOn ?? '9999').localeCompare(b.followUpOn ?? '9999'))
    .slice(0, 4)
  const duePeople = data.people
    .filter((person) => person.status === 'to_reach_out' || (person.nextFollowUpOn && dayDistance(today, person.nextFollowUpOn) <= 0))
    .slice(0, 3)
  const work = data.projects
    .filter((project) => project.status === 'active' || project.status === 'blocked')
    .sort((a, b) => (a.deadlineOn ?? '9999').localeCompare(b.deadlineOn ?? '9999'))

  return (
    <section className="zone outer-zone" aria-labelledby="outer-title">
      <ZoneHeading eyebrow="Outer field · Vairagya" title="What moves around you" />
      <div className="outer-grid">
        <div className="outer-column">
          <div className="column-title-row">
            <h3>Job hunt</h3>
            <button className="icon-button" type="button" onClick={onAddApplication} aria-label="Add application"><Icon name="plus" /></button>
          </div>

          {closing.length > 0 && (
            <div className="closing-window">
              <span className="closing-label">Closing soon</span>
              {closing.map((app) => (
                <div className="closing-row closing-clickable" key={app.id} role="button" tabIndex={0} onClick={() => onEditApplication(app)} onKeyDown={(event) => event.key === 'Enter' && onEditApplication(app)}>
                  <div><strong>{app.company}</strong><span>{app.role}</span></div>
                  <time dateTime={app.windowClosesOn ?? ''}>{dayDistance(today, app.windowClosesOn!)}d</time>
                </div>
              ))}
            </div>
          )}

          <div className="subsection-heading"><span>Active applications</span><small>{active.length}</small></div>
          <div className="item-list">
            {active.map((app) => (
              <article className="list-item" key={app.id}>
                <button type="button" className="item-button" onClick={() => onEditApplication(app)}>
                  <div className="item-main">
                    <div><strong>{app.company}</strong><span>{app.role}</span></div>
                    <span className={`status-pill status-${app.status}`}>{statusLabel[app.status]}</span>
                  </div>
                  <p>{app.nextAction}</p>
                  {app.followUpOn && <DueDate date={app.followUpOn} today={today} prefix="Follow up" />}
                </button>
              </article>
            ))}
          </div>

          {duePeople.length > 0 && (
            <>
              <div className="subsection-heading"><span>People to contact</span><small>{duePeople.length}</small></div>
              <div className="people-list">
                {duePeople.map((person) => (
                  <div key={person.id}><span className="person-initial">{person.name.charAt(0)}</span><div><strong>{person.name}</strong><small>{person.company}</small></div></div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="outer-void" aria-hidden="true" />

        <div className="outer-column">
          <div className="column-title-row"><h3>Work</h3><span className="column-count">{work.length} moving</span></div>
          <div className="item-list work-list">
            {work.map((project) => (
              <article className="list-item project-item" key={project.id}>
                <div className="item-main">
                  <div><strong>{project.name}</strong><span>{project.type}</span></div>
                  <span className={`status-pill project-${project.status}`}>{project.status}</span>
                </div>
                <p>{project.nextAction}</p>
                {project.deadlineOn && <DueDate date={project.deadlineOn} today={today} prefix="Due" />}
              </article>
            ))}
          </div>
          <div className="portfolio-target">
            <span>Public portfolio</span>
            <strong>{data.projects.filter((project) => project.status === 'done' && project.type === 'portfolio').length} / 3</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

function DueDate({ date, today, prefix }: { date: string; today: Date; prefix: string }) {
  const distance = dayDistance(today, date)
  const label = distance < 0 ? `${Math.abs(distance)}d overdue` : distance === 0 ? 'today' : distance === 1 ? 'tomorrow' : `in ${distance}d`
  return <time className={distance <= 0 ? 'is-due' : ''} dateTime={date}>{prefix} {label}</time>
}

function ReviewQueue({ items, today, onReview }: { items: LearningItem[]; today: Date; onReview: (item: LearningItem) => void }) {
  const due = items
    .filter((item) => item.nextReviewOn && dayDistance(today, item.nextReviewOn) <= 0)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 8)

  return (
    <section className="zone review-zone" aria-labelledby="review-title">
      <ZoneHeading eyebrow="Memory · Smriti" title="Review queue" aside={<span className="due-count">{due.length} due</span>} />
      {due.length === 0 ? (
        <div className="empty-state"><Icon name="spark" /><p>Nothing due. Leave the space empty.</p></div>
      ) : (
        <div className="review-list">
          {due.map((item, index) => (
            <button type="button" className="review-item" onClick={() => onReview(item)} key={item.id}>
              <span className="review-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="review-concept"><strong>{item.concept}</strong><small>{item.track} · {item.itemType}</small></span>
              <span className="confidence">C{item.confidence}</span>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function DailyLogSheet({ log, settings, onSave, onClose }: { log: DailyLog; settings: Settings; onSave: (log: DailyLog) => void; onClose: () => void }) {
  const draftKey = `command.draft.${log.day}`
  const [draft, setDraft] = useState<DailyLog>(() => {
    try {
      const stored = localStorage.getItem(draftKey)
      return stored ? (JSON.parse(stored) as DailyLog) : log
    } catch {
      return log
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      /* prototype */
    }
  }, [draft, draftKey])

  function setMinutes(key: PracticeKey, value: number) {
    const field = key === 'node' ? 'nodeMinutes' : key === 'dsa' ? 'dsaMinutes' : key === 'math' ? 'mathMinutes' : 'jobMinutes'
    setDraft((current) => ({ ...current, [field]: Math.max(0, Math.round(value)) }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      localStorage.removeItem(draftKey)
    } catch {
      /* prototype */
    }
    onSave(draft)
  }

  return (
    <Sheet title="Log today" eyebrow={dateFromKey(log.day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} onClose={onClose}>
      <form className="daily-form" onSubmit={submit}>
        <fieldset className="habit-fieldset">
          <legend>Daily signals</legend>
          <label className={draft.meditation ? 'is-checked' : ''}>
            <input type="checkbox" checked={draft.meditation} onChange={(event) => setDraft({ ...draft, meditation: event.target.checked })} />
            <span><Icon name="check" /></span>Meditation
          </label>
          <label className={draft.gym ? 'is-checked' : ''}>
            <input type="checkbox" checked={draft.gym} onChange={(event) => setDraft({ ...draft, gym: event.target.checked })} />
            <span><Icon name="check" /></span>Gym
          </label>
        </fieldset>

        <fieldset className="diet-fieldset">
          <legend>Diet</legend>
          {(['on_track', 'loose', 'off'] as const).map((diet) => (
            <label className={draft.diet === diet ? 'is-selected' : ''} key={diet}>
              <input type="radio" name="diet" value={diet} checked={draft.diet === diet} onChange={() => setDraft({ ...draft, diet })} />
              {diet.replace('_', ' ')}
            </label>
          ))}
        </fieldset>

        <fieldset className="time-fieldset">
          <legend>Actual time</legend>
          {practices.map(({ key, label }) => {
            const value = minutesFor(draft, key)
            const met = value >= settings.floors[key]
            return (
              <div className={`time-row ${met ? 'is-met' : ''}`} key={key}>
                <div className="time-label"><span>{label}</span><small>{met ? 'Floor met' : `${compactDuration(settings.floors[key] - value)} to floor`}</small></div>
                <div className="time-control">
                  <button type="button" onClick={() => setMinutes(key, value - 15)} aria-label={`Remove 15 minutes from ${label}`}>−</button>
                  <label><input type="number" inputMode="numeric" min="0" step="5" value={value} onChange={(event) => setMinutes(key, Number(event.target.value))} /><span>min</span></label>
                  <button type="button" onClick={() => setMinutes(key, value + 15)} aria-label={`Add 15 minutes to ${label}`}>+</button>
                </div>
              </div>
            )
          })}
        </fieldset>

        <label className="note-field">One-line note <span>optional</span><input type="text" maxLength={140} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="What mattered today?" /></label>

        <div className="form-actions"><button className="primary-button" type="submit"><span>Save today</span><Icon name="check" /></button></div>
      </form>
    </Sheet>
  )
}

const channelLabel: Record<ApplicationChannel, string> = {
  india_product: 'India product',
  gcc: 'GCC',
  remote_intl: 'Remote intl',
  services: 'Services',
}

function ApplicationSheet({ today, people, existing, canUseCalendar, onSave, onDelete, onDeadlineToCalendar, onClose }: {
  today: Date
  people: Person[]
  existing?: JobApplication | null
  canUseCalendar: boolean
  onSave: (app: JobApplication) => void
  onDelete?: (id: string) => void
  onDeadlineToCalendar?: (app: JobApplication) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<JobApplication>(existing ?? {
    id: uid('app'),
    company: '',
    role: '',
    lane: 'sde',
    channel: 'india_product',
    status: 'researching',
    windowClosesOn: null,
    followUpOn: dateKey(today),
    ctcLpa: null,
    referrerId: null,
    jobUrl: '',
    nextAction: '',
  })
  const [calendarBusy, setCalendarBusy] = useState(false)
  const isNew = !existing

  async function addToCalendar() {
    if (!onDeadlineToCalendar || !draft.windowClosesOn) return
    setCalendarBusy(true)
    try {
      await onDeadlineToCalendar(draft)
    } finally {
      setCalendarBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.company.trim() || !draft.role.trim()) return
    onSave(draft)
  }

  return (
    <Sheet title={isNew ? 'New application' : draft.company} eyebrow={isNew ? 'Job hunt' : `${statusLabel[draft.status]} · ${draft.role}`} onClose={onClose}>
      <form className="simple-form" onSubmit={submit}>
        <div className="form-pair">
          <label>Company<input autoFocus required value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} /></label>
          <label>Role<input required value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} /></label>
        </div>
        <div className="form-pair">
          <label>Lane<select value={draft.lane} onChange={(event) => setDraft({ ...draft, lane: event.target.value as JobApplication['lane'] })}>
            <option value="sde">SDE</option>
            <option value="ai_ml">AI / ML</option>
          </select></label>
          <label>Channel<select value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value as ApplicationChannel })}>
            {Object.entries(channelLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        <div className="form-pair">
          <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ApplicationStatus })}>
            {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>CTC (LPA)<input type="number" min="0" step="0.5" inputMode="decimal" value={draft.ctcLpa ?? ''} onChange={(event) => setDraft({ ...draft, ctcLpa: event.target.value === '' ? null : Number(event.target.value) })} /></label>
        </div>
        <div className="form-pair">
          <label>Window closes<input type="date" value={draft.windowClosesOn ?? ''} onChange={(event) => setDraft({ ...draft, windowClosesOn: event.target.value || null })} /></label>
          {canUseCalendar && (
            <button type="button" className="secondary-button calendar-push" disabled={!draft.windowClosesOn || calendarBusy} onClick={addToCalendar}>
              {calendarBusy ? 'Adding…' : 'Deadline → Calendar'}
            </button>
          )}
        </div>
        <div className="form-pair">
          <label>Follow up on<input type="date" value={draft.followUpOn ?? ''} onChange={(event) => setDraft({ ...draft, followUpOn: event.target.value || null })} /></label>
          <label>Referrer<select value={draft.referrerId ?? ''} onChange={(event) => setDraft({ ...draft, referrerId: event.target.value || null })}>
            <option value="">—</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select></label>
        </div>
        <label>Job link<input type="url" value={draft.jobUrl} onChange={(event) => setDraft({ ...draft, jobUrl: event.target.value })} placeholder="https://…" /></label>
        <label>Next action<input required value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} placeholder="The next physical action" /></label>
        <div className="form-actions form-actions-split">
          {!isNew && onDelete && <button className="danger-button" type="button" onClick={() => onDelete(draft.id)}>Delete</button>}
          <button className="primary-button" type="submit"><span>{isNew ? 'Add application' : 'Save'}</span><Icon name="check" /></button>
        </div>
      </form>
    </Sheet>
  )
}

type Recall = 'instant' | 'effort' | 'struggled' | 'blank'

function ReviewSheet({ item, onComplete, onClose }: { item: LearningItem; onComplete: (recall: Recall) => void; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <Sheet title={item.concept} eyebrow={`${item.track} · confidence ${item.confidence}`} onClose={onClose}>
      <div className="recall-body">
        {!revealed ? (
          <div className="recall-prompt"><span>Recall first</span><p>Explain the idea, invariant, or formula without opening your notes.</p><button className="secondary-button" type="button" onClick={() => setRevealed(true)}>Reveal answer</button></div>
        ) : (
          <>
            <div className="answer-panel"><span>Your note</span><p>{item.content}</p></div>
            <fieldset className="recall-options">
              <legend>How did recall feel?</legend>
              <button type="button" onClick={() => onComplete('instant')}><strong>Instant</strong><span>Review in 3 weeks</span></button>
              <button type="button" onClick={() => onComplete('effort')}><strong>Some effort</strong><span>Review in 1 week</span></button>
              <button type="button" onClick={() => onComplete('struggled')}><strong>Struggled</strong><span>Review in 3 days</span></button>
              <button type="button" onClick={() => onComplete('blank')}><strong>Blank</strong><span>Review tomorrow</span></button>
            </fieldset>
          </>
        )}
      </div>
    </Sheet>
  )
}

function explainCalendarError(error: unknown): string {
  const raw = error instanceof Error ? error.message : ''
  try {
    const parsed = JSON.parse(raw) as { detail?: { error?: { message?: string }; message?: string }; error?: string }
    return parsed.detail?.error?.message ?? parsed.detail?.message ?? parsed.error ?? raw.slice(0, 140)
  } catch {
    return raw.slice(0, 140) || 'unreachable'
  }
}


export function App() {
  const today = useMemo(() => new Date(), [])
  const todayKey = dateKey(today)
  const {
    data, settings, mode, session, ready,
    saveLog, saveApplication, deleteApplication,
    savePerson, deletePerson, saveProject, deleteProject, saveIdea, deleteIdea,
    completeReview, deleteLearning, saveSettings, signOut,
  } = useCommandData()
  const [route, navigate] = useHashRoute()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [applicationOpen, setApplicationOpen] = useState(false)
  const [editingApplication, setEditingApplication] = useState<JobApplication | null>(null)
  const [reviewItem, setReviewItem] = useState<LearningItem | null>(null)
  const [createTick, setCreateTick] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    function onUpdateReady() { setUpdateReady(true) }
    window.addEventListener('command:update-ready', onUpdateReady)
    return () => window.removeEventListener('command:update-ready', onUpdateReady)
  }, [])

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }

  function goCreate(routePath: string) {
    setCreateTick((tick) => tick + 1)
    navigate(routePath)
  }

  function handleSaveLog(log: DailyLog) {
    saveLog(log)
    setLogOpen(false)
    showNotice('Today saved')
  }

  function handleSaveApplication(application: JobApplication) {
    const isEdit = Boolean(editingApplication)
    saveApplication(application)
    setApplicationOpen(false)
    setEditingApplication(null)
    showNotice(isEdit ? 'Application updated' : 'Application added')
  }

  function handleDeleteApplication(id: string) {
    deleteApplication(id)
    setApplicationOpen(false)
    setEditingApplication(null)
    showNotice('Application removed')
  }

  async function handleApplicationToCalendar(app: JobApplication) {
    if (!session) {
      showNotice('Sign in to reach Calendar')
      return
    }
    if (!app.windowClosesOn) return
    try {
      await createCalendarEvent(session, {
        summary: `${app.company} — window closes`,
        description: `${app.role} application window closes today`,
        start: `${app.windowClosesOn}T00:00:00`,
        entity_type: 'application_deadline',
        entity_id: app.id,
        idempotency_key: `application-${app.id}-${app.windowClosesOn}`,
      })
      showNotice('Added to Calendar')
    } catch (error) {
      showNotice(`Calendar: ${explainCalendarError(error)}`)
    }
  }

  async function handleProjectToCalendar(project: Project) {
    if (!session) {
      showNotice('Sign in to reach Calendar')
      return
    }
    if (!project.deadlineOn) return
    try {
      await createCalendarEvent(session, {
        summary: `${project.name} — deadline`,
        description: `${project.type} project deadline`,
        start: `${project.deadlineOn}T00:00:00`,
        entity_type: 'project_deadline',
        entity_id: project.id,
        idempotency_key: `project-${project.id}-${project.deadlineOn}`,
      })
      showNotice('Added to Calendar')
    } catch (error) {
      showNotice(`Calendar: ${explainCalendarError(error)}`)
    }
  }

  function handleReview(recall: Recall) {
    if (!reviewItem) return
    const interval = recall === 'instant' ? 21 : recall === 'effort' ? 7 : recall === 'struggled' ? 3 : 1
    const confidence = Math.max(1, Math.min(5, reviewItem.confidence + (recall === 'instant' ? 1 : recall === 'struggled' ? -1 : recall === 'blank' ? -2 : 0))) as 1 | 2 | 3 | 4 | 5
    const masteryHits = confidence === 5 && recall === 'instant' ? reviewItem.masteryHits + 1 : 0
    completeReview({
      ...reviewItem,
      confidence,
      masteryHits,
      nextReviewOn: masteryHits >= 2 ? null : dateKey(addDays(today, interval)),
    })
    setReviewItem(null)
    showNotice(masteryHits >= 2 ? 'Item retired from rotation' : `Next review in ${interval} day${interval === 1 ? '' : 's'}`)
  }

  function handleExport(kind: 'json' | 'csv', table?: string) {
    if (!data) return
    const content = kind === 'json' ? exportData(data, settings) : exportCsv(table as 'logs' | 'applications' | 'people' | 'projects' | 'learning', data)
    const type = kind === 'json' ? 'application/json' : 'text/csv'
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = kind === 'json' ? `command-export-${todayKey}.json` : `command-${table}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showNotice('Export downloaded')
  }

  if (mode === 'configuring') return <AuthScreen />
  if (!ready || !data) return <div className="loading-state">Loading…</div>

  const todayLog = data.logs.find((log) => log.day === todayKey) ?? emptyLog(todayKey)
  const live = mode === 'live'
  const canUseCalendar = live && Boolean(session)

  return (
    <>
      <div className="app-shell" id="top">
        <AppHeader today={today} live={live} onOpenSettings={() => setSettingsOpen(true)} />
        <ViewNav route={route} navigate={navigate} />
        {route === '' && (
          <main>
            <TodayInstrument log={todayLog} settings={settings} onOpen={() => setLogOpen(true)} />
            <div className="action-row" role="group" aria-label="Quick capture">
              <button className="secondary-button" type="button" onClick={() => setApplicationOpen(true)}><Icon name="plus" /><span>Application</span></button>
              <button className="secondary-button" type="button" onClick={() => goCreate('learning')}><Icon name="plus" /><span>Concept</span></button>
              <button className="secondary-button" type="button" onClick={() => goCreate('ideas')}><Icon name="plus" /><span>Idea</span></button>
            </div>
            <CalendarStrip session={session} />
            <DoubleRule />
            <WeeklyField logs={data.logs} settings={settings} today={today} />
            <DoubleRule />
            <OuterField data={data} today={today} onAddApplication={() => setApplicationOpen(true)} onEditApplication={setEditingApplication} />
            <DoubleRule />
            <ReviewQueue items={data.learning} today={today} onReview={setReviewItem} />
          </main>
        )}
        {route === 'people' && (
          <main>
            <PeopleView people={data.people} today={today} onSave={(person) => { savePerson(person); showNotice('Person saved') }} onDelete={(id) => { deletePerson(id); showNotice('Person removed') }} />
          </main>
        )}
        {route === 'projects' && (
          <main>
            <ProjectsView
              projects={data.projects}
              today={today}
              createSignal={route === 'projects' ? createTick : 0}
              onSave={(project) => { saveProject(project); showNotice('Project saved') }}
              onDelete={(id) => { deleteProject(id); showNotice('Project removed') }}
              onDeadlineToCalendar={handleProjectToCalendar}
            />
          </main>
        )}
        {route === 'ideas' && (
          <main>
            <IdeasView ideas={data.ideas} createSignal={route === 'ideas' ? createTick : 0} onSave={(idea) => { saveIdea(idea); showNotice('Idea captured') }} onDelete={(id) => { deleteIdea(id); showNotice('Idea removed') }} />
          </main>
        )}
        {route === 'learning' && (
          <main>
            <LearningView items={data.learning} today={today} createSignal={route === 'learning' ? createTick : 0} onCapture={(item) => { completeReview(item); showNotice('Concept captured') }} onDelete={(id) => { deleteLearning(id); showNotice('Concept removed') }} />
          </main>
        )}
        <footer><img src="./assets/command-mark.svg" alt="" /><span>Keep the centre clear.</span></footer>
      </div>

      {logOpen && <DailyLogSheet log={todayLog} settings={settings} onSave={handleSaveLog} onClose={() => setLogOpen(false)} />}
      {(applicationOpen || editingApplication) && (
        <ApplicationSheet
          today={today}
          people={data.people}
          existing={editingApplication}
          canUseCalendar={canUseCalendar}
          onSave={handleSaveApplication}
          onDelete={handleDeleteApplication}
          onDeadlineToCalendar={handleApplicationToCalendar}
          onClose={() => { setApplicationOpen(false); setEditingApplication(null) }}
        />
      )}
      {reviewItem && <ReviewSheet item={reviewItem} onComplete={handleReview} onClose={() => setReviewItem(null)} />}
      {settingsOpen && <SettingsSheet settings={settings} session={session} mode={mode} onSaveSettings={saveSettings} onSignOut={() => { setSettingsOpen(false); signOut() }} onClose={() => setSettingsOpen(false)} onExport={handleExport} />}
      {updateReady && (
        <div className="update-banner" role="alert">
          <span>A new version is ready.</span>
          <button className="secondary-button" type="button" onClick={() => window.location.reload()}>Refresh</button>
        </div>
      )}
      <div className={`toast ${notice ? 'is-visible' : ''}`} role="status">{notice}</div>
    </>
  )
}

import type { CommandData, Commitment, Settings } from '../types'
import { compactDuration } from '../domain'
import { EmptyState, Icon } from '../ui'
import { dueItems, relativeDueLabel, threeFloorStatus, weeklyOutcomeProgress } from '../v3Selectors'
import { pendingProposalCount } from './AgentInboxSheet'

export function TodayView({ data, settings, today, onLog, onCapture, onOutcome, onOpenItem, onOpenAgentInbox }: {
  data: CommandData
  settings: Settings
  today: Date
  onLog: () => void
  onCapture: () => void
  onOutcome: (commitment: Commitment) => void
  onOpenItem: (id: string) => void
  onOpenAgentInbox?: () => void
}) {
  const floors = threeFloorStatus(data, settings, today)
  const overdue = dueItems(data, today, 'overdue')
  const queue = dueItems(data, today).slice(0, 5)
  const weekly = weeklyOutcomeProgress(data, today)
  const allFloorsMet = floors.every((floor) => floor.met)
  const pendingAgents = pendingProposalCount(data)

  return <main>
    <section className="today-zone v3-today">
      <div className="today-topline"><p className="today-kicker">Today · Asia/Kolkata</p>{pendingAgents > 0 && onOpenAgentInbox && <button className="agent-inbox-indicator" type="button" onClick={onOpenAgentInbox}>Agent inbox · {pendingAgents}</button>}</div>
      {overdue.length > 0 && <div className="urgent-lead">
        <span className="eyebrow">Overdue exception</span>
        <strong>{overdue[0].commitment.action}</strong>
        <p>{overdue[0].entity.title} · {relativeDueLabel(today, overdue[0].commitment.dueOn)}</p>
        <div className="action-row"><button className="primary-button" type="button" onClick={() => onOutcome(overdue[0].commitment)}>Record outcome <Icon name="check" /></button><button className="secondary-button" type="button" onClick={() => onOpenItem(overdue[0].entity.id)}>Open item</button></div>
      </div>}
      <div className={`floor-field ${overdue.length ? 'is-after-exception' : ''}`}>
        <div className="floor-grid three-floors">{floors.map((floor) => <div className="floor" key={floor.key}><span className={`gate-mark ${floor.met ? 'is-met' : ''}`} /><span>{floor.label}</span><strong>{compactDuration(floor.minutes)} / {compactDuration(floor.target)}</strong></div>)}</div>
        <p>{allFloorsMet ? 'Practice floors are clear. Use the day for deliberate work.' : 'Three practice floors set the centre of the day.'}</p>
      </div>
      <div className="weekly-targets" role="group" aria-label="Weekly outcome progress">
        <div className="weekly-target"><span>Applications submitted</span><strong>{weekly.applications} / {settings.weeklyTargets.applications}</strong></div>
        <div className="weekly-target"><span>New people contacted</span><strong>{weekly.peopleContacted} / {settings.weeklyTargets.peopleContacted}</strong></div>
      </div>
      <div className="today-action-row"><button className="primary-button" type="button" onClick={onLog}><span>{allFloorsMet ? 'Review today' : 'Log today'}</span><Icon name="arrow" /></button><button className="secondary-button" type="button" onClick={onCapture}>Capture record</button></div>
    </section>
    <section className="zone view-zone compact-queue">
      <div className="zone-heading"><div><span className="eyebrow">Open commitments</span><h2>{queue.length ? 'What is owed' : 'Nothing due'}</h2></div><div className="zone-aside">{overdue.length ? `${overdue.length} overdue` : 'Calm queue'}</div></div>
      {queue.length === 0 ? <EmptyState message="No open commitments. Capture work only when it earns a clear next date." /> : <CommitmentQueue items={queue} today={today} onOutcome={onOutcome} onOpenItem={onOpenItem} />}
    </section>
  </main>
}

export function CommitmentQueue({ items, today, onOutcome, onOpenItem }: {
  items: ReturnType<typeof dueItems>
  today: Date
  onOutcome: (commitment: Commitment) => void
  onOpenItem: (id: string) => void
}) {
  return <div className="commitment-list">{items.map((item) => <article className={`commitment-row is-${item.dueStatus}`} key={item.commitment.id}>
    <button type="button" className="item-button commitment-main" onClick={() => onOpenItem(item.entity.id)}><span className="status-pill">{item.type.singularName}</span><strong>{item.commitment.action}</strong><small>{item.entity.title} · {relativeDueLabel(today, item.commitment.dueOn)}</small></button>
    <button className="secondary-button commitment-outcome" type="button" onClick={() => onOutcome(item.commitment)}>Outcome</button>
  </article>)}</div>
}

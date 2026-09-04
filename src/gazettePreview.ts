import { addDays, dateKey, dayDistance, startOfMonday } from './domain'
import type {
  ActivityEvent, AgentProposal, CommandData, Commitment, DailyLog, RunSummary, Settings, WeekSummary,
} from './types'
import { upgradeLegacyData } from './v3Data'

const entityIds = {
  stripe: '00000000-0000-4000-8000-000000000101',
  anthropic: '00000000-0000-4000-8000-000000000102',
  sarah: '00000000-0000-4000-8000-000000000103',
  raft: '00000000-0000-4000-8000-000000000104',
  learning: '00000000-0000-4000-8000-000000000105',
} as const

export const gazettePreviewSettings: Settings = {
  theme: 'day',
  floors: { node: 90, dsa: 60, math: 45, job: 60 },
  budgets: { node: 420, dsa: 840, math: 420, job: 420 },
  weeklyTargets: { applications: 15, peopleContacted: 2 },
}

export const gazettePreviewExecution = [
  { node: 95, dsa: 65, math: 50, job: 3 },
  { node: 100, dsa: 70, math: 45, job: 2 },
  { node: 90, dsa: 60, math: 50, job: 4 },
  { node: 110, dsa: 30, math: 45, job: 1 },
  { node: 105, dsa: 40, math: 50, job: 2 },
  { node: 105, dsa: 40, math: 50, job: 2 },
  { node: 0, dsa: 0, math: 0, job: 0 },
] as const

export function isGazettePreview(): boolean {
  return new URLSearchParams(window.location.search).get('preview') === 'gazette-v12'
}

export function createGazettePreviewData(now = new Date()): CommandData {
  const today = dateKey(now)
  const monday = startOfMonday(now)
  const logs: DailyLog[] = gazettePreviewExecution.map((entry, index) => ({
    day: dateKey(addDays(monday, index)),
    meditation: index < 6,
    gym: index < 6,
    diet: index < 6 ? 'on_track' : null,
    nodeMinutes: entry.node,
    dsaMinutes: entry.dsa,
    mathMinutes: entry.math,
    jobMinutes: entry.job,
    note: index === 5 ? 'Completed Tarjan strongly connected components. Benchmarked Node.js cluster worker memory boundaries.' : '',
  }))
  const todayLog = logs.find((log) => log.day === today)
  if (todayLog) Object.assign(todayLog, { nodeMinutes: 105, dsaMinutes: 40, mathMinutes: 50 })

  const data = upgradeLegacyData({
    logs,
    applications: [
      {
        id: entityIds.stripe, company: 'Stripe', role: 'Staff Systems Engineer', lane: 'sde', channel: 'remote_intl',
        status: 'phone', windowClosesOn: null, appliedOn: day(now, -9), followUpOn: null, hasReferral: true,
        ctcLpa: null, referrerId: null, jobUrl: '', resumeVersion: 'v12', resumeDriveUrl: '',
        nextAction: 'Distributed rate limiter and token bucket architecture',
        notes: 'Round 3: distributed rate limiter & token bucket architecture.',
      },
      {
        id: entityIds.anthropic, company: 'Anthropic', role: 'Senior Distributed Systems', lane: 'sde', channel: 'remote_intl',
        status: 'phone', windowClosesOn: null, appliedOn: day(now, -4), followUpOn: null, hasReferral: false,
        ctcLpa: null, referrerId: null, jobUrl: '', resumeVersion: 'v12', resumeDriveUrl: '',
        nextAction: 'Hiring manager conversation', notes: 'Hiring manager conversation complete. Rust & Python engine.',
      },
    ],
    people: [{
      id: entityIds.sarah, name: 'Sarah Chen', company: 'Datadog', email: '', linkedinUrl: '', howKnown: 'linkedin',
      status: 'talking', lastContactOn: day(now, -50), nextFollowUpOn: null,
      notes: 'Principal Engineer. Met at Systems Conf. eBPF and tracing expert.',
    }],
    projects: [{
      id: entityIds.raft, name: 'KV-Raft Distributed Consensus Engine', type: 'portfolio', status: 'active', client: '',
      paymentStatus: 'na', amount: null, currency: 'USD', isPublic: true, deadlineOn: null,
      repoUrl: 'https://github.com/command-spec/kv-raft', demoUrl: '', driveFolderUrl: '',
      nextAction: 'Raft consensus and linearizable reads portfolio build.', content: 'Raft consensus and linearizable reads portfolio build.',
    }],
    learning: [{
      id: entityIds.learning, concept: 'Monotonic Stack & Segment Trees', stack: 'brain', track: 'dsa', itemType: 'pattern',
      confidence: 4, difficulty: 'hard', nextReviewOn: null, lastReviewedOn: day(now, -19), masteryHits: 1,
      sourceUrl: '', content: 'Hard range-minimum-query drills with monotonic-stack and segment-tree comparisons.',
    }],
    ideas: [],
  })

  const details = {
    [entityIds.stripe]: { title: 'Staff Systems Engineer @ Stripe', created: day(now, -9), fields: { status: 'Technical', stage: 'Technical', comp: '340–380' } },
    [entityIds.anthropic]: { title: 'Senior Distributed Systems @ Anthropic', created: day(now, -4), fields: { status: 'Screen', stage: 'Screen', comp: '310–360' } },
    [entityIds.sarah]: { title: 'Sarah Chen (Principal @ Datadog)', created: day(now, -50), fields: { role: 'Principal Engineer', cadence_days: 30, context: 'Met at Systems Conf. eBPF and tracing expert.' } },
    [entityIds.raft]: { title: 'KV-Raft Distributed Consensus Engine', created: day(now, -28), fields: { repo: 'github.com/command-spec/kv-raft', target_outcome: 'Raft consensus and linearizable reads portfolio build.' } },
    [entityIds.learning]: { title: 'Monotonic Stack & Segment Trees', created: day(now, -19), fields: { topic: 'Monotonic Stack & Segment Trees', interval_multiplier: 2.5 } },
  }
  data.entities = data.entities.map((entity) => {
    const detail = details[entity.id as keyof typeof details]
    if (!detail) return entity
    const timestamp = `${detail.created}T08:00:00.000Z`
    return { ...entity, title: detail.title, fields: { ...entity.fields, ...detail.fields }, createdAt: timestamp, updatedAt: timestamp }
  })
  const typeNames: Record<string, [string, string]> = {
    application: ['Job Application', 'Job Applications'],
    person: ['Contact', 'Contacts'],
    project: ['Engineering Project', 'Engineering Projects'],
    learning: ['Learning Drill', 'Learning Drills'],
  }
  data.entityTypes = data.entityTypes.map((type) => {
    const names = typeNames[type.typeKey]
    const ordered = { ...type, defaultSortField: 'created_at', defaultSortDirection: 'asc' as const }
    const renamed = names ? { ...ordered, singularName: names[0], pluralName: names[1] } : ordered
    if (type.typeKey !== 'application') return renamed
    const orderedKeys = ['role', 'company', 'status']
    const visible = orderedKeys.map((key) => type.fields.find((field) => field.key === key)!).map((field) => ({
      ...field,
      label: field.key === 'role' ? 'Position / role' : field.key === 'company' ? 'Company / org' : 'Pipeline stage',
    }))
    const remainder = type.fields.filter((field) => !orderedKeys.includes(field.key))
    return { ...renamed, fields: [...visible, ...remainder] }
  })
  data.commitments = previewCommitments(now)
  data.activityEvents = previewActivity(now)
  data.agentProposals = [previewProposal(now, data)]
  return data
}

export function createGazettePreviewWeek(now = new Date()): WeekSummary {
  const monday = startOfMonday(now)
  const days = gazettePreviewExecution.map((entry, index) => {
    const current = dateKey(addDays(monday, index))
    const filed = index < 6
    return {
      day: current, isFuture: !filed, hasLog: filed,
      nodeMinutes: filed ? entry.node : null,
      dsaMinutes: filed ? entry.dsa : null,
      mathMinutes: filed ? entry.math : null,
      meditation: filed ? true : null,
      gym: filed ? true : null,
      diet: filed ? 'on_track' as const : null,
    }
  })
  return {
    weekStart: days[0].day, weekEnd: days[6].day, days,
    practice: {
      node: { minutes: 605, target: gazettePreviewSettings.budgets.node },
      dsa: { minutes: 305, target: gazettePreviewSettings.budgets.dsa },
      math: { minutes: 290, target: gazettePreviewSettings.budgets.math },
    },
    applicationsSubmitted: 14, applicationTarget: 15, peopleContacted: 2, peopleTarget: 2,
    commitments: { completed: 0, cancelled: 0, missed: 1 },
    proposals: { proposed: 1, approved: 0, rejected: 0 },
  }
}

export function createGazettePreviewRun(now = new Date()): RunSummary {
  const months = completedMonths(now)
  const metric = (current: number, target: number, history: number[]) => ({
    current, target, historyReady: true, history: months.map((month, index) => ({ month, value: history[index] })),
  })
  return {
    asOfDay: dateKey(now), historyStart: `${months[0]}-01`, historyEnd: monthEnd(months[2]),
    publicPortfolio: metric(2, 3, [1, 1, 2]),
    dsaPatterns: { ...metric(19, 24, [12, 16, 19]), covered: 19 },
    mockInterviews: metric(7, 10, [2, 5, 7]),
    applicationConversion: { ...metric(28.5, 25, [18, 22, 28.5]), numerator: 2, denominator: 7 },
    referralConversations: metric(9, 12, [3, 6, 9]),
  }
}

function previewCommitments(now: Date): Commitment[] {
  const open = (id: string, entityId: string, kind: Commitment['kind'], action: string, offset: number): Commitment => ({
    id, entityId, kind, action, dueOn: day(now, offset), state: 'open', outcome: null, completedAt: null, originSource: 'ui',
  })
  return [
    open('20000000-0000-4000-8000-000000000102', entityIds.sarah, 'contact', 'Sarah Chen catch-up & systems engineering wire', -1),
    open('20000000-0000-4000-8000-000000000101', entityIds.stripe, 'milestone', 'Stripe system design: distributed rate limiter drill', 0),
    open('20000000-0000-4000-8000-000000000105', entityIds.learning, 'review', 'Hard range minimum query spaced review', 0),
    open('20000000-0000-4000-8000-000000000104', entityIds.raft, 'milestone', 'Raft log compaction & snapshotting implementation', 2),
  ]
}

function previewActivity(now: Date): ActivityEvent[] {
  const event = (id: number, entityId: string | null, eventType: string, offset: number, source: ActivityEvent['source'], payload: Record<string, unknown> = {}): ActivityEvent => {
    const occurredAt = `${day(now, offset)}T08:15:00.000Z`
    return {
      id: uuid('3', id), entityId, commitmentId: null, eventType, payload, source, clientId: null,
      idempotencyKey: `gazette-preview:${id}`, occurredAt, createdAt: occurredAt,
    }
  }
  const monday = startOfMonday(now)
  const mondayOffset = (index: number) => dayDistance(now, dateKey(addDays(monday, index)))
  // Historical outreach must sit before this week's Monday, or it drifts into
  // the weekly counters on later weekdays and the edition stops matching.
  const beforeWeek = (days: number) => mondayOffset(0) - days
  const history = [
    event(1, entityIds.stripe, 'application.submitted', beforeWeek(5), 'ui', { detail: 'Internal referral dispatched.' }),
    event(2, entityIds.stripe, 'calendar.linked', beforeWeek(3), 'calendar', { detail: 'Recruiter screen booked.' }),
    event(3, entityIds.stripe, 'entity.updated', beforeWeek(1), 'mcp', { detail: 'Stage advanced: Technical.' }),
    event(4, entityIds.anthropic, 'application.submitted', beforeWeek(2), 'ui', { detail: 'Direct inbound application.' }),
    event(5, entityIds.sarah, 'person.contacted', -50, 'ui', { detail: 'Contact enrolled via outreach log.' }),
    event(6, entityIds.raft, 'entity.created', -28, 'ui', { detail: 'Lead quarter portfolio build.' }),
    event(7, entityIds.learning, 'entity.created', -19, 'ui', { detail: 'Spaced repetition schedule active.' }),
  ]
  let application = 0
  const weeklyApplications = gazettePreviewExecution.flatMap((entry, index) => Array.from({ length: entry.job }, () => {
    application += 1
    return event(100 + application, uuid('9', application), 'application.submitted', mondayOffset(index), 'ui')
  }))
  const weeklyContacts = Array.from({ length: 2 }, (_, index) => event(200 + index, uuid('8', index + 1), 'person.contacted', mondayOffset(index), 'ui'))
  return [...history, ...weeklyApplications, ...weeklyContacts]
}

function previewProposal(now: Date, data: CommandData): AgentProposal {
  const application = data.entityTypes.find((type) => type.typeKey === 'application')!
  return {
    id: '40000000-0000-4000-8000-000000000001', clientId: 'Claude Code (local MCP agent)', operation: 'capture',
    entityTypeId: application.id, targetEntityId: null, targetCommitmentId: null, targetUpdatedAt: null,
    proposedEntity: { title: 'Lead Backend Architect @ Vercel', fields: { role: 'Lead Backend Architect', company: 'Vercel', stage: 'Applied', comp: '320–360', notes: 'Parsed from recruiter email thread.' } },
    proposedCommitment: { action: 'Vercel edge runtime architecture prep', kind: 'milestone', due_on: day(now, 4) },
    state: 'pending', decisionNote: null, resultEntityId: null, resultCommitmentId: null, resultEventId: null,
    idempotencyKey: 'gazette-preview:mcp-1', expiresAt: `${day(now, 7)}T18:30:00.000Z`, decidedAt: null,
    createdAt: `${dateKey(now)}T08:30:00.000Z`,
  }
}

function day(now: Date, offset: number): string { return dateKey(addDays(now, offset)) }
function uuid(prefix: string, value: number): string { return `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, '0')}` }

function completedMonths(now: Date): string[] {
  const [year, month] = dateKey(now).split('-').map(Number)
  return [-3, -2, -1].map((offset) => {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1, 6, 30))
    return dateKey(date).slice(0, 7)
  })
}

function monthEnd(month: string): string {
  const [year, value] = month.split('-').map(Number)
  return dateKey(new Date(Date.UTC(year, value, 0, 6, 30)))
}

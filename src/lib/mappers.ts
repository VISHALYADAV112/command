import type { ActivityEvent, AgentProposal, CommandData, Commitment, DailyLog, Entity, EntityFieldDefinition, EntityType, Idea, JobApplication, LearningItem, Person, Project, PracticeKey, RunMetric, RunSummary, Settings, WeekSummary } from '../types'
import type { DbActivityEvent, DbAgentProposal, DbCommitment, DbDailyLog, DbEntity, DbEntityType, DbEntityWrite, DbIdea, DbJobApplication, DbLearningItem, DbPerson, DbProject, DbUserSettings } from './db.rows'

export function mapLog(row: DbDailyLog): DailyLog {
  return {
    day: row.day,
    meditation: row.meditation,
    gym: row.gym,
    diet: row.diet as DailyLog['diet'],
    nodeMinutes: row.node_minutes,
    dsaMinutes: row.dsa_minutes,
    mathMinutes: row.math_minutes,
    jobMinutes: row.job_hunt_minutes,
    note: row.note ?? '',
  }
}

export function logToDb(log: DailyLog): Pick<DbDailyLog, 'meditation' | 'gym' | 'diet' | 'node_minutes' | 'dsa_minutes' | 'math_minutes' | 'job_hunt_minutes' | 'note' | 'day'> {
  return {
    day: log.day,
    meditation: log.meditation,
    gym: log.gym,
    diet: log.diet,
    node_minutes: log.nodeMinutes,
    dsa_minutes: log.dsaMinutes,
    math_minutes: log.mathMinutes,
    job_hunt_minutes: log.jobMinutes,
    note: log.note || null,
  }
}

export function mapLearning(row: DbLearningItem): LearningItem {
  return {
    id: row.id,
    concept: row.concept,
    stack: row.stack as LearningItem['stack'],
    track: row.track as LearningItem['track'],
    itemType: row.item_type as LearningItem['itemType'],
    confidence: row.confidence as 1 | 2 | 3 | 4 | 5,
    difficulty: row.difficulty as LearningItem['difficulty'],
    nextReviewOn: row.next_review_on,
    lastReviewedOn: row.last_reviewed_on,
    masteryHits: row.mastery_hits,
    sourceUrl: row.source_url ?? '',
    content: row.content_markdown ?? '',
  }
}

export function learningToDb(item: LearningItem): DbLearningItem {
  return {
    id: item.id,
    concept: item.concept,
    stack: item.stack,
    track: item.track,
    item_type: item.itemType,
    confidence: item.confidence,
    difficulty: item.difficulty,
    next_review_on: item.nextReviewOn,
    last_reviewed_on: item.lastReviewedOn,
    mastery_hits: item.masteryHits,
    source_url: item.sourceUrl || null,
    content_markdown: item.content || null,
  }
}

export function mapPerson(row: DbPerson): Person {
  return {
    id: row.id,
    name: row.name,
    company: row.company ?? '',
    email: row.email ?? '',
    linkedinUrl: row.linkedin_url ?? '',
    howKnown: row.how_known as Person['howKnown'],
    status: row.status as Person['status'],
    lastContactOn: row.last_contacted_on,
    nextFollowUpOn: row.next_follow_up_on,
    notes: row.notes ?? '',
  }
}

export function personToDb(person: Person): DbPerson {
  return {
    id: person.id,
    name: person.name,
    company: person.company || null,
    email: person.email || null,
    linkedin_url: person.linkedinUrl || null,
    how_known: person.howKnown,
    status: person.status,
    last_contacted_on: person.lastContactOn,
    next_follow_up_on: person.nextFollowUpOn,
    notes: person.notes || null,
  }
}

export function mapApplication(row: DbJobApplication): JobApplication {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    lane: row.lane as JobApplication['lane'],
    channel: row.channel as JobApplication['channel'],
    status: row.status as JobApplication['status'],
    windowClosesOn: row.window_closes_on,
    appliedOn: row.applied_on,
    followUpOn: row.follow_up_on,
    hasReferral: row.has_referral,
    ctcLpa: row.ctc_lpa ?? null,
    referrerId: row.referrer_id,
    jobUrl: row.job_url ?? '',
    resumeVersion: row.resume_version ?? '',
    resumeDriveUrl: row.resume_drive_url ?? '',
    nextAction: row.next_action ?? '',
    notes: row.notes ?? '',
  }
}

export function applicationToDb(app: JobApplication): DbJobApplication {
  return {
    id: app.id,
    company: app.company,
    role: app.role,
    lane: app.lane,
    channel: app.channel,
    status: app.status,
    applied_on: app.appliedOn,
    has_referral: app.hasReferral,
    referrer_id: app.referrerId,
    ctc_lpa: app.ctcLpa,
    next_action: app.nextAction || null,
    follow_up_on: app.followUpOn,
    window_closes_on: app.windowClosesOn,
    job_url: app.jobUrl || null,
    resume_version: app.resumeVersion || null,
    resume_drive_url: app.resumeDriveUrl || null,
    notes: app.notes || null,
  }
}

export function mapIdea(row: DbIdea): Idea {
  return {
    id: row.id,
    idea: row.idea,
    problem: row.problem ?? '',
    targetMarket: row.target_market ?? '',
    monetization: row.monetization ?? '',
    status: row.status as Idea['status'],
    nextAction: row.next_action ?? '',
  }
}

export function ideaToDb(idea: Idea): DbIdea {
  return {
    id: idea.id,
    idea: idea.idea,
    problem: idea.problem || null,
    target_market: idea.targetMarket || null,
    monetization: idea.monetization || null,
    status: idea.status,
    next_action: idea.nextAction || null,
  }
}

export function mapProject(row: DbProject): Project {
  return {
    id: row.id,
    name: row.name,
    type: row.project_type as Project['type'],
    status: row.status as Project['status'],
    client: row.client ?? '',
    paymentStatus: row.payment_status as Project['paymentStatus'],
    amount: row.amount,
    currency: row.currency,
    isPublic: row.is_public,
    deadlineOn: row.deadline_on,
    repoUrl: row.repo_url ?? '',
    demoUrl: row.demo_url ?? '',
    driveFolderUrl: row.drive_folder_url ?? '',
    nextAction: row.next_action ?? '',
    content: row.content_markdown ?? '',
  }
}

export function projectToDb(project: Project): DbProject {
  return {
    id: project.id,
    name: project.name,
    project_type: project.type,
    status: project.status,
    client: project.client || null,
    payment_status: project.paymentStatus,
    amount: project.amount,
    currency: project.currency,
    is_public: project.isPublic,
    deadline_on: project.deadlineOn,
    repo_url: project.repoUrl || null,
    demo_url: project.demoUrl || null,
    drive_folder_url: project.driveFolderUrl || null,
    next_action: project.nextAction || null,
    content_markdown: project.content || null,
  }
}

export function mapEntityType(row: DbEntityType): EntityType {
  const fields = row.field_schema as unknown as Array<Record<string, unknown>>
  return {
    id: row.id,
    typeKey: row.type_key,
    singularName: row.singular_name,
    pluralName: row.plural_name,
    iconKey: row.icon_key as EntityType['iconKey'],
    schemaVersion: row.schema_version,
    fields: fields.map((field): EntityFieldDefinition => ({
      key: String(field.key),
      label: String(field.label),
      kind: field.kind as EntityFieldDefinition['kind'],
      required: field.required === true,
      listVisible: field.list_visible === true,
      filterable: field.filterable === true,
      deprecated: field.deprecated === true,
      options: Array.isArray(field.options) ? field.options.map(String) : [],
    })),
    defaultSortField: row.default_sort_field,
    defaultSortDirection: row.default_sort_direction as EntityType['defaultSortDirection'],
    groupByField: row.group_by_field,
    allowedCommitmentKinds: row.allowed_commitment_kinds as EntityType['allowedCommitmentKinds'],
    pluginKey: row.plugin_key as EntityType['pluginKey'],
    isActive: row.is_active,
  }
}

export function entityTypeToDb(type: EntityType): DbEntityType {
  return {
    id: type.id,
    type_key: type.typeKey,
    singular_name: type.singularName,
    plural_name: type.pluralName,
    icon_key: type.iconKey,
    schema_version: type.schemaVersion,
    field_schema: type.fields.map((field) => ({
      key: field.key,
      label: field.label,
      kind: field.kind,
      required: field.required,
      list_visible: field.listVisible,
      filterable: field.filterable,
      deprecated: field.deprecated,
      ...(field.kind === 'single_select' ? { options: field.options } : {}),
    })),
    default_sort_field: type.defaultSortField,
    default_sort_direction: type.defaultSortDirection,
    group_by_field: type.groupByField,
    allowed_commitment_kinds: type.allowedCommitmentKinds,
    plugin_key: type.pluginKey,
    is_active: type.isActive,
  }
}

export function mapEntity(row: DbEntity): Entity {
  return {
    id: row.id,
    entityTypeId: row.entity_type_id,
    title: row.title,
    fields: row.fields as Entity['fields'],
    schemaVersion: row.schema_version,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function entityToDb(entity: Entity): DbEntityWrite {
  return {
    id: entity.id,
    entity_type_id: entity.entityTypeId,
    title: entity.title,
    fields: entity.fields,
    schema_version: entity.schemaVersion,
    archived_at: entity.archivedAt,
  }
}

export function mapCommitment(row: DbCommitment): Commitment {
  return {
    id: row.id,
    entityId: row.entity_id,
    kind: row.kind as Commitment['kind'],
    action: row.action,
    dueOn: row.due_on,
    state: row.state as Commitment['state'],
    outcome: row.outcome,
    completedAt: row.completed_at,
    originSource: row.origin_source as Commitment['originSource'],
  }
}

export function commitmentToDb(commitment: Commitment): DbCommitment {
  return {
    id: commitment.id,
    entity_id: commitment.entityId,
    kind: commitment.kind,
    action: commitment.action,
    due_on: commitment.dueOn,
    state: commitment.state,
    outcome: commitment.outcome,
    completed_at: commitment.completedAt,
    origin_source: commitment.originSource,
  }
}

export function mapActivityEvent(row: DbActivityEvent): ActivityEvent {
  return {
    id: row.id,
    entityId: row.entity_id,
    commitmentId: row.commitment_id,
    eventType: row.event_type,
    payload: row.payload as ActivityEvent['payload'],
    source: row.source as ActivityEvent['source'],
    clientId: row.client_id,
    idempotencyKey: row.idempotency_key,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  }
}

export function mapAgentProposal(row: DbAgentProposal): AgentProposal {
  return {
    id: row.id,
    clientId: row.client_id,
    operation: row.operation as AgentProposal['operation'],
    entityTypeId: row.entity_type_id,
    targetEntityId: row.target_entity_id,
    targetCommitmentId: row.target_commitment_id,
    targetUpdatedAt: row.target_updated_at,
    proposedEntity: row.proposed_entity as AgentProposal['proposedEntity'],
    proposedCommitment: row.proposed_commitment as AgentProposal['proposedCommitment'],
    state: row.state as AgentProposal['state'],
    decisionNote: row.decision_note,
    resultEntityId: row.result_entity_id,
    resultCommitmentId: row.result_commitment_id,
    resultEventId: row.result_event_id,
    idempotencyKey: row.idempotency_key,
    expiresAt: row.expires_at,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  }
}

export function mapSettings(row: DbUserSettings): Settings {
  const floors: Record<PracticeKey, number> = {
    node: row.node_floor_minutes,
    dsa: row.dsa_floor_minutes,
    math: row.math_floor_minutes,
    job: row.job_hunt_floor_minutes,
  }
  const budgets: Record<PracticeKey, number> = {
    node: row.node_weekly_minutes,
    dsa: row.dsa_weekly_minutes,
    math: row.math_weekly_minutes,
    job: row.job_hunt_weekly_minutes,
  }
  return {
    theme: row.theme === 'light' ? 'day' : 'night',
    floors,
    budgets,
    weeklyTargets: {
      applications: row.weekly_application_target,
      peopleContacted: row.weekly_people_contact_target,
    },
  }
}

export function settingsToDb(settings: Settings): Omit<DbUserSettings, 'user_id'> {
  return {
    theme: settings.theme === 'day' ? 'light' : 'dark',
    node_floor_minutes: settings.floors.node,
    dsa_floor_minutes: settings.floors.dsa,
    math_floor_minutes: settings.floors.math,
    job_hunt_floor_minutes: settings.floors.job,
    node_weekly_minutes: settings.budgets.node,
    dsa_weekly_minutes: settings.budgets.dsa,
    math_weekly_minutes: settings.budgets.math,
    job_hunt_weekly_minutes: settings.budgets.job,
    weekly_application_target: settings.weeklyTargets.applications,
    weekly_people_contact_target: settings.weeklyTargets.peopleContacted,
  }
}

export function mapWeekSummary(value: unknown): WeekSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Week summary is unavailable.')
  const row = value as Record<string, unknown>
  if (!Array.isArray(row.days) || row.days.length !== 7) throw new Error('Week summary is unavailable.')
  const practice = objectValue(row.practice)
  return {
    weekStart: String(row.week_start),
    weekEnd: String(row.week_end),
    days: row.days.map((value) => {
      const day = objectValue(value)
      return {
        day: String(day.day),
        isFuture: Boolean(day.is_future),
        hasLog: day.node_minutes !== null && day.node_minutes !== undefined,
        nodeMinutes: nullableNumber(day.node_minutes),
        dsaMinutes: nullableNumber(day.dsa_minutes),
        mathMinutes: nullableNumber(day.math_minutes),
        meditation: nullableBoolean(day.meditation),
        gym: nullableBoolean(day.gym),
        diet: (day.diet ?? null) as WeekSummary['days'][number]['diet'],
      }
    }),
    practice: {
      node: progress(practice.node),
      dsa: progress(practice.dsa),
      math: progress(practice.math),
    },
    applicationsSubmitted: Number(row.applications_submitted ?? 0),
    applicationTarget: Number(row.application_target ?? 0),
    peopleContacted: Number(row.people_contacted ?? 0),
    peopleTarget: Number(row.people_target ?? 0),
    commitments: counts(row.commitments, ['completed', 'cancelled', 'missed']),
    proposals: counts(row.proposals, ['proposed', 'approved', 'rejected']),
  }
}

export function mapRunSummary(value: unknown): RunSummary {
  const row = objectValue(value)
  const markers = objectValue(row.markers)
  const publicPortfolio = runMetric(markers.public_portfolio)
  const dsaPatterns = objectValue(markers.dsa_patterns)
  const applicationConversion = objectValue(markers.application_conversion)
  return {
    asOfDay: String(row.as_of_day),
    historyStart: String(row.history_start),
    historyEnd: String(row.history_end),
    publicPortfolio,
    dsaPatterns: { ...runMetric(dsaPatterns), covered: Number(dsaPatterns.covered ?? 0) },
    mockInterviews: runMetric(markers.mock_interviews),
    applicationConversion: {
      ...runMetric(applicationConversion),
      numerator: Number(applicationConversion.numerator ?? 0),
      denominator: Number(applicationConversion.denominator ?? 0),
    },
    referralConversations: runMetric(markers.referral_conversations),
  }
}

function runMetric(value: unknown): RunMetric {
  const row = objectValue(value)
  if (!Array.isArray(row.history) || row.history.length !== 3) throw new Error('Run summary is unavailable.')
  return {
    current: nullableNumber(row.current),
    target: Number(row.target ?? 0),
    historyReady: row.history_ready === true,
    history: row.history.map((point) => {
      const history = objectValue(point)
      return { month: String(history.month), value: nullableNumber(history.value) }
    }),
  }
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

function nullableBoolean(value: unknown): boolean | null {
  return value === null || value === undefined ? null : Boolean(value)
}

function progress(value: unknown): { minutes: number; target: number } {
  const row = objectValue(value)
  return { minutes: Number(row.minutes ?? 0), target: Number(row.target ?? 0) }
}

function counts<T extends string>(value: unknown, keys: readonly T[]): Record<T, number> {
  const row = objectValue(value)
  return Object.fromEntries(keys.map((key) => [key, Number(row[key] ?? 0)])) as Record<T, number>
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export type RemoteData = CommandData

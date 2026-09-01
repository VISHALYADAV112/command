import type {
  ActivityEvent, CommandData, Commitment, Entity, Idea, JobApplication, LearningItem,
  LegacyCommandData, Person, Project,
} from './types'
import { createBuiltInEntityTypes } from './v3Registry'

export function normalizeLegacyData(raw: Partial<LegacyCommandData>): LegacyCommandData {
  const applications = Array.isArray(raw.applications) ? raw.applications : []
  const people = Array.isArray(raw.people) ? raw.people : []
  const projects = Array.isArray(raw.projects) ? raw.projects : []
  const learning = Array.isArray(raw.learning) ? raw.learning : []
  const ideas = Array.isArray(raw.ideas) ? raw.ideas : []

  return {
    logs: Array.isArray(raw.logs) ? raw.logs : [],
    applications: applications.map((item) => ({
      ...item,
      appliedOn: item.appliedOn ?? null,
      hasReferral: item.hasReferral ?? false,
      resumeVersion: item.resumeVersion ?? '',
      resumeDriveUrl: item.resumeDriveUrl ?? '',
      notes: item.notes ?? '',
    })),
    people: people.map((item) => ({
      ...item,
      email: item.email ?? '',
      linkedinUrl: item.linkedinUrl ?? '',
      howKnown: item.howKnown ?? null,
      lastContactOn: item.lastContactOn ?? null,
      notes: item.notes ?? '',
    })),
    projects: projects.map((item) => ({
      ...item,
      client: item.client ?? '',
      paymentStatus: item.paymentStatus ?? 'na',
      amount: item.amount ?? null,
      currency: item.currency ?? 'INR',
      isPublic: item.isPublic ?? false,
      repoUrl: item.repoUrl ?? '',
      demoUrl: item.demoUrl ?? '',
      driveFolderUrl: item.driveFolderUrl ?? '',
      content: item.content ?? '',
    })),
    learning: learning.map((item) => ({
      ...item,
      stack: item.stack ?? 'brain',
      difficulty: item.difficulty ?? null,
      lastReviewedOn: item.lastReviewedOn ?? null,
      sourceUrl: item.sourceUrl ?? '',
    })),
    ideas: ideas.map((item) => ({
      ...item,
      problem: item.problem ?? '',
      targetMarket: item.targetMarket ?? '',
      monetization: item.monetization ?? '',
    })),
  }
}

export function upgradeLegacyData(raw: Partial<LegacyCommandData>): CommandData {
  const legacy = normalizeLegacyData(raw)
  const entityTypes = createBuiltInEntityTypes()
  const typeId = Object.fromEntries(entityTypes.map((type) => [type.typeKey, type.id]))
  const entities = [
    ...legacy.applications.map((item) => applicationEntity(item, typeId.application)),
    ...legacy.people.map((item) => personEntity(item, typeId.person)),
    ...legacy.projects.map((item) => projectEntity(item, typeId.project)),
    ...legacy.learning.map((item) => learningEntity(item, typeId.learning)),
    ...legacy.ideas.map((item) => ideaEntity(item, typeId.note)),
  ]
  const commitments = createCommitments(legacy)

  return {
    version: 3,
    entityTypes,
    entities,
    commitments,
    activityEvents: createMigrationEvents(entities, commitments, legacy),
    legacy,
  }
}

export function isCommandData(value: unknown): value is CommandData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<CommandData>
  return data.version === 3
    && Array.isArray(data.entityTypes)
    && Array.isArray(data.entities)
    && Array.isArray(data.commitments)
    && Array.isArray(data.activityEvents)
    && isLegacyData(data.legacy)
}

export function normalizeCommandData(data: CommandData): CommandData {
  const firstEventByEntity = new Map<string, string>()
  for (const event of data.activityEvents) {
    if (!event.entityId) continue
    const current = firstEventByEntity.get(event.entityId)
    if (!current || event.occurredAt < current) firstEventByEntity.set(event.entityId, event.occurredAt)
  }
  return {
    ...data,
    entities: data.entities.map((item) => {
      const createdAt = item.createdAt ?? firstEventByEntity.get(item.id) ?? '1970-01-01T00:00:00.000Z'
      return { ...item, createdAt, updatedAt: item.updatedAt ?? createdAt }
    }),
  }
}

function isLegacyData(value: unknown): value is LegacyCommandData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<LegacyCommandData>
  return Array.isArray(data.logs)
    && Array.isArray(data.applications)
    && Array.isArray(data.people)
    && Array.isArray(data.projects)
    && Array.isArray(data.learning)
    && Array.isArray(data.ideas)
}

function applicationEntity(item: JobApplication, entityTypeId: string): Entity {
  return entity(item.id, entityTypeId, `${item.company} — ${item.role}`, {
    company: item.company,
    role: item.role,
    lane: item.lane,
    channel: item.channel,
    status: item.status,
    applied_on: item.appliedOn,
    has_referral: item.hasReferral,
    ctc_lpa: item.ctcLpa,
    referrer_id: item.referrerId,
    job_url: item.jobUrl,
    resume_version: item.resumeVersion,
    resume_drive_url: item.resumeDriveUrl,
    next_action: item.nextAction,
    notes: item.notes,
  })
}

function personEntity(item: Person, entityTypeId: string): Entity {
  return entity(item.id, entityTypeId, item.name, {
    company: item.company,
    email: item.email,
    linkedin_url: item.linkedinUrl,
    how_known: item.howKnown,
    status: item.status,
    last_contacted_on: item.lastContactOn,
    notes: item.notes,
  })
}

function projectEntity(item: Project, entityTypeId: string): Entity {
  return entity(item.id, entityTypeId, item.name, {
    project_type: item.type,
    status: item.status,
    client: item.client,
    payment_status: item.paymentStatus,
    amount: item.amount,
    currency: item.currency,
    is_public: item.isPublic,
    repo_url: item.repoUrl,
    demo_url: item.demoUrl,
    drive_folder_url: item.driveFolderUrl,
    next_action: item.nextAction,
    content_markdown: item.content,
  })
}

function learningEntity(item: LearningItem, entityTypeId: string): Entity {
  return entity(item.id, entityTypeId, item.concept, {
    stack: item.stack,
    track: item.track,
    item_type: item.itemType,
    confidence: item.confidence,
    difficulty: item.difficulty,
    last_reviewed_on: item.lastReviewedOn,
    mastery_hits: item.masteryHits,
    source_url: item.sourceUrl,
    content_markdown: item.content,
  })
}

function ideaEntity(item: Idea, entityTypeId: string): Entity {
  return entity(item.id, entityTypeId, item.idea, {
    tag: 'idea',
    problem: item.problem,
    target_market: item.targetMarket,
    monetization: item.monetization,
    status: item.status,
    next_action: item.nextAction,
  })
}

function entity(id: string, entityTypeId: string, title: string, fields: Entity['fields']): Entity {
  const timestamp = '2026-01-01T00:00:00.000Z'
  return { id, entityTypeId, title, fields, schemaVersion: 2, archivedAt: null, createdAt: timestamp, updatedAt: timestamp }
}

function createCommitments(data: LegacyCommandData): Commitment[] {
  return [
    ...data.applications.flatMap((item) => [
      commitment(item.id, 'follow-up', item.nextAction || 'Follow up on application', item.followUpOn, 'application-follow-up'),
      commitment(item.id, 'deadline', 'Application window closes', item.windowClosesOn, 'application-deadline'),
    ]),
    ...data.people.map((item) => commitment(item.id, 'contact', `Contact ${item.name}`, item.nextFollowUpOn, 'person-contact')),
    ...data.projects.map((item) => commitment(item.id, 'deadline', item.nextAction || 'Project deadline', item.deadlineOn, 'project-deadline')),
    ...data.learning.map((item) => commitment(item.id, 'review', `Review ${item.concept}`, item.nextReviewOn, 'learning-review')),
  ].filter((item): item is Commitment => item !== null)
}

function createMigrationEvents(entities: Entity[], commitments: Commitment[], legacy: LegacyCommandData): ActivityEvent[] {
  const occurredAt = '2026-01-01T00:00:00.000Z'
  return [
    ...entities.map((entity) => ({
      id: stableUuid(`entity-event:${entity.id}`),
      entityId: entity.id,
      commitmentId: null,
      eventType: 'entity.migrated',
      payload: { migration: 'command-v3' },
      source: 'migration' as const,
      clientId: null,
      idempotencyKey: `migration:entity:${entity.id}`,
      occurredAt,
      createdAt: occurredAt,
    })),
    ...commitments.map((commitment) => ({
      id: stableUuid(`commitment-event:${commitment.id}`),
      entityId: commitment.entityId,
      commitmentId: commitment.id,
      eventType: 'commitment.migrated',
      payload: { migration: 'command-v3' },
      source: 'migration' as const,
      clientId: null,
      idempotencyKey: `migration:commitment:${commitment.id}`,
      occurredAt,
      createdAt: occurredAt,
    })),
    ...legacy.applications.flatMap((item) => item.appliedOn ? [outcomeEvent(
      item.id, 'application.submitted', item.appliedOn, `migration:application-submitted:${item.id}`,
    )] : []),
    ...legacy.people.flatMap((item) => item.lastContactOn ? [outcomeEvent(
      item.id, 'person.contacted', item.lastContactOn, `migration:person-contacted:${item.id}`,
    )] : []),
  ]
}

function outcomeEvent(entityId: string, eventType: string, day: string, idempotencyKey: string): ActivityEvent {
  const occurredAt = `${day}T06:30:00.000Z`
  return {
    id: stableUuid(`outcome-event:${eventType}:${entityId}:${day}`),
    entityId,
    commitmentId: null,
    eventType,
    payload: { migration: 'command-v3', day },
    source: 'migration',
    clientId: null,
    idempotencyKey,
    occurredAt,
    createdAt: occurredAt,
  }
}

function commitment(
  entityId: string,
  kind: Commitment['kind'],
  action: string,
  dueOn: string | null,
  discriminator: string,
): Commitment | null {
  if (!dueOn) return null
  return {
    id: stableUuid(`${entityId}:${discriminator}`),
    entityId,
    kind,
    action,
    dueOn,
    state: 'open',
    outcome: null,
    completedAt: null,
    originSource: 'migration',
  }
}

function stableUuid(seed: string): string {
  let hex = ''
  for (let round = 0; round < 4; round += 1) {
    let hash = 2166136261 ^ round
    for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    hex += (hash >>> 0).toString(16).padStart(8, '0')
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`
}

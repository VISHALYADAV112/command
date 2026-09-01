import type {
  ActivityEvent, CommandData, Commitment, DailyLog, Entity, EntityType, Idea,
  JobApplication, LearningItem, Person, Project, Settings,
} from '../types'
import type { CommandClient } from './supabase'
import { settings as defaultSettings } from '../domain'
import {
  applicationToDb, ideaToDb, learningToDb, logToDb, mapActivityEvent, mapApplication,
  mapCommitment, mapEntity, mapEntityType, mapIdea, mapLearning, mapLog, mapPerson,
  mapProject, mapSettings, personToDb, projectToDb, settingsToDb,
} from './mappers'

function throwIfError(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message)
}

export const REMOTE_READ_LIMIT = 1000
export const V3_SCREEN_READ_LIMIT = 100
export const V3_PAGE_SIZE = 25

export interface RemotePage<T> {
  items: T[]
  hasMore: boolean
}

export interface RemoteDueItem {
  commitmentId: string
  entityId: string
  entityTypeId: string
  typeKey: string
  entityTitle: string
  kind: string
  action: string
  dueOn: string
  state: string
  originSource: string
  dueStatus: string
}

export function exportData(data: CommandData, settings: Settings): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), settings, ...data }, null, 2)
}

export type CsvTable = 'logs' | 'applications' | 'people' | 'projects' | 'learning' | 'ideas'

export function exportCsv(kind: CsvTable, data: CommandData): string {
  const legacy = data.legacy
  const escape = (value: string | number | boolean | null | undefined): string => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const line = (row: (string | number | boolean | null | undefined)[]) => row.map(escape).join(',')

  switch (kind) {
    case 'logs':
      return [
        line(['day', 'meditation', 'gym', 'diet', 'node_minutes', 'dsa_minutes', 'math_minutes', 'job_minutes', 'note']),
        ...legacy.logs.map((log) => line([log.day, log.meditation, log.gym, log.diet, log.nodeMinutes, log.dsaMinutes, log.mathMinutes, log.jobMinutes, log.note])),
      ].join('\n')
    case 'applications':
      return [
        line(['id', 'company', 'role', 'lane', 'channel', 'status', 'applied_on', 'window_closes_on', 'follow_up_on', 'has_referral', 'ctc_lpa', 'referrer_id', 'job_url', 'resume_version', 'resume_drive_url', 'next_action', 'notes']),
        ...legacy.applications.map((app) => line([app.id, app.company, app.role, app.lane, app.channel, app.status, app.appliedOn, app.windowClosesOn, app.followUpOn, app.hasReferral, app.ctcLpa, app.referrerId, app.jobUrl, app.resumeVersion, app.resumeDriveUrl, app.nextAction, app.notes])),
      ].join('\n')
    case 'people':
      return [
        line(['id', 'name', 'company', 'email', 'linkedin_url', 'how_known', 'status', 'last_contacted_on', 'next_follow_up_on', 'notes']),
        ...legacy.people.map((person) => line([person.id, person.name, person.company, person.email, person.linkedinUrl, person.howKnown, person.status, person.lastContactOn, person.nextFollowUpOn, person.notes])),
      ].join('\n')
    case 'projects':
      return [
        line(['id', 'name', 'type', 'status', 'client', 'payment_status', 'amount', 'currency', 'is_public', 'deadline_on', 'repo_url', 'demo_url', 'drive_folder_url', 'next_action', 'content']),
        ...legacy.projects.map((project) => line([project.id, project.name, project.type, project.status, project.client, project.paymentStatus, project.amount, project.currency, project.isPublic, project.deadlineOn, project.repoUrl, project.demoUrl, project.driveFolderUrl, project.nextAction, project.content])),
      ].join('\n')
    case 'learning':
      return [
        line(['id', 'concept', 'stack', 'track', 'item_type', 'confidence', 'difficulty', 'next_review_on', 'last_reviewed_on', 'mastery_hits', 'source_url', 'content']),
        ...legacy.learning.map((item) => line([item.id, item.concept, item.stack, item.track, item.itemType, item.confidence, item.difficulty, item.nextReviewOn, item.lastReviewedOn, item.masteryHits, item.sourceUrl, item.content])),
      ].join('\n')
    case 'ideas':
      return [
        line(['id', 'idea', 'problem', 'target_market', 'monetization', 'status', 'next_action']),
        ...legacy.ideas.map((idea) => line([idea.id, idea.idea, idea.problem, idea.targetMarket, idea.monetization, idea.status, idea.nextAction])),
      ].join('\n')
  }
}

export async function loadRemoteData(client: CommandClient): Promise<CommandData> {
  const [entityTypes, entities, commitments, activityEvents, logs, learning, people, applications, projects, ideas] = await Promise.all([
    client.from('entity_types').select('*').order('type_key').order('id').limit(REMOTE_READ_LIMIT),
    client.from('entities').select('*').order('updated_at', { ascending: false }).order('id').limit(REMOTE_READ_LIMIT),
    client.from('commitments').select('*').order('due_on').order('id').limit(REMOTE_READ_LIMIT),
    client.from('activity_events').select('*').order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(REMOTE_READ_LIMIT),
    client.from('daily_logs').select('*').order('day', { ascending: false }).order('id').limit(REMOTE_READ_LIMIT),
    client.from('learning_items').select('*').order('next_review_on', { nullsFirst: false }).order('id').limit(REMOTE_READ_LIMIT),
    client.from('people').select('*').order('name').order('id').limit(REMOTE_READ_LIMIT),
    client.from('job_applications').select('*').order('updated_at', { ascending: false }).order('id').limit(REMOTE_READ_LIMIT),
    client.from('projects').select('*').order('updated_at', { ascending: false }).order('id').limit(REMOTE_READ_LIMIT),
    client.from('ideas').select('*').order('updated_at', { ascending: false }).order('id').limit(REMOTE_READ_LIMIT),
  ])
  ;[entityTypes, entities, commitments, activityEvents, logs, learning, people, applications, projects, ideas].forEach(throwIfError)
  return {
    version: 3,
    entityTypes: (entityTypes.data ?? []).map(mapEntityType),
    entities: (entities.data ?? []).map(mapEntity),
    commitments: (commitments.data ?? []).map(mapCommitment),
    activityEvents: (activityEvents.data ?? []).map(mapActivityEvent),
    legacy: {
      logs: (logs.data ?? []).map(mapLog),
      learning: (learning.data ?? []).map(mapLearning),
      people: (people.data ?? []).map(mapPerson),
      applications: (applications.data ?? []).map(mapApplication),
      projects: (projects.data ?? []).map(mapProject),
      ideas: (ideas.data ?? []).map(mapIdea),
    },
  }
}

export async function loadV3Registry(client: CommandClient): Promise<EntityType[]> {
  const result = await client.from('entity_types').select('*').order('type_key').order('id').limit(V3_SCREEN_READ_LIMIT)
  throwIfError(result)
  return (result.data ?? []).map(mapEntityType)
}

export async function loadV3Today(client: CommandClient, day: string): Promise<unknown> {
  const result = await client.rpc('get_v3_today', { p_day: day, p_limit: V3_SCREEN_READ_LIMIT })
  throwIfError(result)
  return result.data
}

export async function loadV3Due(
  client: CommandClient,
  day: string,
  window: 'overdue' | 'today' | 'week' | 'all',
  typeKey: string | null,
  offset = 0,
): Promise<RemoteDueItem[]> {
  const result = await client.rpc('get_v3_due', {
    p_day: day,
    p_window: window,
    p_type_key: typeKey ?? undefined,
    p_limit: V3_SCREEN_READ_LIMIT,
    p_offset: offset,
  })
  throwIfError(result)
  return (result.data ?? []).map(mapRemoteDueItem)
}

export async function loadV3DuePage(
  client: CommandClient,
  day: string,
  window: 'overdue' | 'today' | 'week' | 'all',
  typeKey: string | null,
  offset = 0,
): Promise<RemotePage<RemoteDueItem>> {
  const result = await client.rpc('get_v3_due', {
    p_day: day,
    p_window: window,
    p_type_key: typeKey ?? undefined,
    p_limit: V3_PAGE_SIZE + 1,
    p_offset: offset,
  })
  throwIfError(result)
  const items = (result.data ?? []).map(mapRemoteDueItem)
  return { items: items.slice(0, V3_PAGE_SIZE), hasMore: items.length > V3_PAGE_SIZE }
}

export async function loadV3Browse(client: CommandClient, entityTypeId: string, offset = 0): Promise<Entity[]> {
  const result = await client.from('entities').select('*').eq('entity_type_id', entityTypeId)
    .is('archived_at', null).order('updated_at', { ascending: false }).order('id')
    .range(offset, offset + V3_SCREEN_READ_LIMIT - 1)
  throwIfError(result)
  return (result.data ?? []).map(mapEntity)
}

export async function loadV3BrowsePage(
  client: CommandClient,
  type: EntityType,
  offset = 0,
): Promise<RemotePage<Entity>> {
  const sortColumn = type.defaultSortField === 'title'
    || type.defaultSortField === 'created_at'
    || type.defaultSortField === 'updated_at'
    ? type.defaultSortField : `fields->>${type.defaultSortField}`
  const result = await client.from('entities').select('*').eq('entity_type_id', type.id)
    .is('archived_at', null).order(sortColumn, { ascending: type.defaultSortDirection === 'asc' }).order('id')
    .range(offset, offset + V3_PAGE_SIZE)
  throwIfError(result)
  const items = (result.data ?? []).map(mapEntity)
  return { items: items.slice(0, V3_PAGE_SIZE), hasMore: items.length > V3_PAGE_SIZE }
}

export async function loadV3Item(client: CommandClient, entityId: string): Promise<{
  entity: Entity | null
  commitments: Commitment[]
  activityEvents: ActivityEvent[]
}> {
  const [entity, commitments, activityEvents] = await Promise.all([
    client.from('entities').select('*').eq('id', entityId).maybeSingle(),
    client.from('commitments').select('*').eq('entity_id', entityId).order('due_on').order('id').limit(V3_SCREEN_READ_LIMIT),
    client.from('activity_events').select('*').eq('entity_id', entityId)
      .order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(V3_SCREEN_READ_LIMIT),
  ])
  ;[entity, commitments, activityEvents].forEach(throwIfError)
  return {
    entity: entity.data ? mapEntity(entity.data) : null,
    commitments: (commitments.data ?? []).map(mapCommitment),
    activityEvents: (activityEvents.data ?? []).map(mapActivityEvent),
  }
}

export async function writeV3Entity(client: CommandClient, entity: Entity, idempotencyKey: string): Promise<void> {
  const result = await client.rpc('write_v3_entity_with_outcome', {
    p_id: entity.id,
    p_entity_type_id: entity.entityTypeId,
    p_title: entity.title,
    p_fields: entity.fields as never,
    p_schema_version: entity.schemaVersion,
    p_archived_at: entity.archivedAt as never,
    p_idempotency_key: idempotencyKey,
  })
  throwIfError(result)
}

export async function writeV3Commitment(client: CommandClient, commitment: Commitment, idempotencyKey: string): Promise<void> {
  const result = await client.rpc('write_v3_commitment', {
    p_id: commitment.id,
    p_entity_id: commitment.entityId,
    p_kind: commitment.kind,
    p_action: commitment.action,
    p_due_on: commitment.dueOn,
    p_state: commitment.state,
    p_outcome: commitment.outcome as never,
    p_completed_at: commitment.completedAt as never,
    p_idempotency_key: idempotencyKey,
  })
  throwIfError(result)
}

export async function writeV3Capture(
  client: CommandClient,
  entity: Entity,
  commitment: Commitment,
  idempotencyKey: string,
): Promise<void> {
  const result = await client.rpc('write_v3_capture', {
    p_entity_id: entity.id,
    p_entity_type_id: entity.entityTypeId,
    p_title: entity.title,
    p_fields: entity.fields as never,
    p_schema_version: entity.schemaVersion,
    p_commitment_id: commitment.id,
    p_commitment_kind: commitment.kind,
    p_commitment_action: commitment.action,
    p_due_on: commitment.dueOn,
    p_idempotency_key: idempotencyKey,
  })
  throwIfError(result)
}

function mapRemoteDueItem(item: {
  commitment_id: string
  entity_id: string
  entity_type_id: string
  type_key: string
  entity_title: string
  kind: string
  action: string
  due_on: string
  state: string
  origin_source: string
  due_status: string
}): RemoteDueItem {
  return {
    commitmentId: item.commitment_id,
    entityId: item.entity_id,
    entityTypeId: item.entity_type_id,
    typeKey: item.type_key,
    entityTitle: item.entity_title,
    kind: item.kind,
    action: item.action,
    dueOn: item.due_on,
    state: item.state,
    originSource: item.origin_source,
    dueStatus: item.due_status,
  }
}

export async function savePersonRow(client: CommandClient, person: Person, userId: string): Promise<void> {
  throwIfError(await client.from('people').upsert({ user_id: userId, ...personToDb(person) }))
}

export async function saveProjectRow(client: CommandClient, project: Project, userId: string): Promise<void> {
  throwIfError(await client.from('projects').upsert({ user_id: userId, ...projectToDb(project) }))
}

export async function saveIdeaRow(client: CommandClient, idea: Idea, userId: string): Promise<void> {
  throwIfError(await client.from('ideas').upsert({ user_id: userId, ...ideaToDb(idea) }))
}

export async function deleteRow(client: CommandClient, table: 'job_applications' | 'people' | 'projects' | 'ideas' | 'learning_items', id: string): Promise<void> {
  throwIfError(await client.from(table).delete().eq('id', id))
}

export async function loadRemoteSettings(client: CommandClient): Promise<Settings> {
  const user = await client.auth.getUser()
  if (user.error) throw new Error(user.error.message)
  const id = user.data?.user?.id
  if (!id) return defaultSettings
  const { data, error } = await client.from('user_settings').select('*').eq('user_id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return defaultSettings
  return mapSettings(data)
}

export async function upsertApplicationRow(client: CommandClient, app: JobApplication, userId: string): Promise<void> {
  throwIfError(await client.from('job_applications').upsert({ user_id: userId, ...applicationToDb(app) }))
}

export async function upsertLog(client: CommandClient, log: DailyLog, userId: string): Promise<void> {
  throwIfError(await client.from('daily_logs').upsert({ user_id: userId, ...logToDb(log) }, { onConflict: 'user_id,day' }))
}

export async function upsertLearning(client: CommandClient, item: LearningItem, userId: string): Promise<void> {
  throwIfError(await client.from('learning_items').upsert({ user_id: userId, ...learningToDb(item) }))
}

export async function saveRemoteSettings(client: CommandClient, settings: Settings): Promise<void> {
  const user = await client.auth.getUser()
  if (user.error) throw new Error(user.error.message)
  const id = user.data?.user?.id
  if (!id) throw new Error('Your session has expired. Sign in again.')
  throwIfError(await client.from('user_settings').upsert({ user_id: id, ...settingsToDb(settings) }, { onConflict: 'user_id' }))
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { addDaysKey, indiaDateKey, weekRange } from './dates.ts'
import {
  DAILY_FLOOR_KEYS, DEFAULT_FLOORS, meetsFloor, type DailyFloorKey,
} from '../_shared/command-domain.ts'
import type {
  AuditEntry, CaptureInput, CommandRepository, CompleteInput, QueryInput, ScheduleInput,
} from './types.ts'
import { commandError } from './errors.ts'
import {
  MCP_PERMISSION, mayReadType, permissionsFromRow, requirePermission, type McpPermission,
} from './permissions.ts'
import { assertCaptureFields, assertSchedule, type RegistryTypeRow } from './validation.ts'

export interface RepositoryOptions {
  url: string
  publishableKey: string
  service: SupabaseClient
  token: string
  userId: string
  clientId: string
  client?: SupabaseClient
}

const TODAY_LIMIT = 50
const WEEK_LIMIT = 100
const LIST_LIMIT = 200
const QUERY_SCAN_LIMIT = 100

function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw commandError('unavailable')
  return result.data
}

export function createCommandRepository(options: RepositoryOptions): CommandRepository {
  const client = options.client ?? createClient(options.url, options.publishableKey, {
    global: { headers: { Authorization: `Bearer ${options.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  let permissionRequest: Promise<McpPermission[]> | null = null

  function permissions(): Promise<McpPermission[]> {
    if (!permissionRequest) {
      permissionRequest = loadPermissions()
    }
    return permissionRequest
  }

  async function loadPermissions(): Promise<McpPermission[]> {
    const result = await options.service.from('mcp_client_permissions')
      .select('can_read_types,can_read_data,can_write_proposals,can_access_people')
      .eq('user_id', options.userId).eq('client_id', options.clientId).maybeSingle()
    return permissionsFromRow(checked(result))
  }

  async function authorize(permission: string): Promise<void> {
    requirePermission(await permissions(), permission)
  }
  async function describeTypes() {
    const types = checked(await options.service.from('entity_types')
      .select('id,type_key,singular_name,plural_name,field_schema,schema_version,allowed_commitment_kinds,plugin_key')
      .eq('user_id', options.userId).eq('is_active', true).order('type_key').limit(50))
    return { types }
  }

  async function proposal(
    operation: 'capture' | 'schedule' | 'complete',
    entityTypeId: string,
    entityId: string | null,
    commitmentId: string | null,
    entityPayload: Record<string, unknown> | null,
    commitmentPayload: Record<string, unknown> | null,
    idempotencyKey: string,
  ) {
    const result = checked(await options.service.rpc('create_agent_proposal', {
      p_user_id: options.userId,
      p_client_id: options.clientId,
      p_operation: operation,
      p_entity_type_id: entityTypeId,
      p_target_entity_id: entityId,
      p_target_commitment_id: commitmentId,
      p_entity_payload: entityPayload,
      p_commitment_payload: commitmentPayload,
      p_idempotency_key: idempotencyKey,
    }))
    return { proposal: result }
  }

  async function replay(idempotencyKey: string): Promise<Record<string, unknown> | null> {
    const existing = checked(await options.service.from('agent_proposals')
      .select('id,state').eq('user_id', options.userId).eq('client_id', options.clientId)
      .eq('idempotency_key', idempotencyKey).maybeSingle())
    return existing?.id ? {
      proposal: { proposal_id: existing.id, state: existing.state, replayed: true },
    } : null
  }

  async function typeForKey(typeKey: string): Promise<RegistryTypeRow> {
    const row = checked(await options.service.from('entity_types')
      .select('id,type_key,field_schema,schema_version,allowed_commitment_kinds,is_active')
      .eq('user_id', options.userId).eq('type_key', typeKey).eq('is_active', true).maybeSingle())
    if (!row?.id) throw commandError('not_found')
    if (String(row.type_key) === 'person') await authorize(MCP_PERMISSION.peopleData)
    return row as RegistryTypeRow
  }

  async function entityContext(entityId: string): Promise<{ type: RegistryTypeRow; archived: boolean }> {
    const entity = checked(await options.service.from('entities').select('entity_type_id,archived_at')
      .eq('user_id', options.userId).eq('id', entityId).maybeSingle())
    if (!entity?.entity_type_id) throw commandError('not_found')
    const type = checked(await options.service.from('entity_types')
      .select('id,type_key,field_schema,schema_version,allowed_commitment_kinds,is_active')
      .eq('user_id', options.userId).eq('id', entity.entity_type_id).eq('is_active', true).maybeSingle())
    if (!type?.id) throw commandError('not_found')
    if (String(type.type_key) === 'person') await authorize(MCP_PERMISSION.peopleData)
    return { type: type as RegistryTypeRow, archived: Boolean(entity.archived_at) }
  }

  async function captureV3(input: CaptureInput) {
    const existing = await replay(input.idempotencyKey)
    if (existing) return existing
    const type = await typeForKey(input.typeKey)
    assertCaptureFields(type, input.fields, input.schemaVersion)
    return proposal('capture', type.id, null, null, {
      title: input.title, fields: input.fields, schema_version: input.schemaVersion,
    }, null, input.idempotencyKey)
  }

  async function complete(input: CompleteInput) {
    const existing = await replay(input.idempotencyKey)
    if (existing) return existing
    const [{ type, archived }, commitment] = await Promise.all([
      entityContext(input.entityId),
      options.service.from('commitments').select('entity_id,state').eq('user_id', options.userId)
        .eq('id', input.commitmentId).maybeSingle().then(checked),
    ])
    if (archived || !commitment || commitment.entity_id !== input.entityId || commitment.state !== 'open') {
      throw commandError('invalid_outcome')
    }
    return proposal('complete', type.id, input.entityId, input.commitmentId, null,
      { outcome: input.outcome }, input.idempotencyKey)
  }

  async function schedule(input: ScheduleInput) {
    const existing = await replay(input.idempotencyKey)
    if (existing) return existing
    const { type, archived } = await entityContext(input.entityId)
    if (archived) throw commandError('invalid_schedule')
    assertSchedule(type, input.kind, input.dueOn)
    return proposal('schedule', type.id, input.entityId, null, null, {
      kind: input.kind, action: input.action, due_on: input.dueOn,
    }, input.idempotencyKey)
  }

  async function queryV3(input: QueryInput) {
    const granted = await permissions()
    const requestedType = input.typeKey ? await typeForKey(input.typeKey) : null
    if (input.dueWindow) {
      const rows = (checked(await options.service.rpc('get_v3_due_for_mcp', {
        p_user_id: options.userId, p_window: input.dueWindow, p_type_key: input.typeKey ?? null,
        p_limit: requestedType || granted.includes(MCP_PERMISSION.peopleData) ? input.limit : QUERY_SCAN_LIMIT,
        p_offset: 0,
      })) ?? []) as Array<Record<string, unknown>>
      const visible = rows.filter((row) => mayReadType(granted, String(row.type_key)))
      return { commitments: visible.slice(0, input.limit), limit: input.limit }
    }

    let request = options.service.from('entities').select('id,title,entity_type_id,created_at')
      .eq('user_id', options.userId).is('archived_at', null).order('created_at', { ascending: false }).order('id').limit(input.limit)
    if (requestedType) request = request.eq('entity_type_id', requestedType.id)
    else if (!granted.includes(MCP_PERMISSION.peopleData)) {
      const person = checked(await options.service.from('entity_types').select('id').eq('user_id', options.userId)
        .eq('type_key', 'person').maybeSingle())
      if (person?.id) request = request.neq('entity_type_id', person.id)
    }
    if (input.text) request = request.ilike('title', `%${escapeLike(input.text)}%`)
    return { entities: checked(await request), limit: input.limit }
  }

  async function getToday() {
    const today = indiaDateKey()
    const [log, settings, projects, jobs, people, learning] = await Promise.all([
      client.from('daily_logs').select('*').eq('user_id', options.userId).eq('day', today).maybeSingle(),
      client.from('user_settings').select('node_floor_minutes,dsa_floor_minutes,math_floor_minutes')
        .eq('user_id', options.userId).maybeSingle(),
      client.from('projects').select('id,name,status,deadline_on,next_action').eq('user_id', options.userId)
        .in('status', ['active', 'blocked', 'review']).order('deadline_on', { nullsFirst: false }).order('id').limit(TODAY_LIMIT),
      client.from('job_applications').select('id,company,role,status,follow_up_on,window_closes_on,next_action').eq('user_id', options.userId)
        .in('status', ['researching', 'applied', 'oa', 'phone', 'onsite']).order('follow_up_on', { nullsFirst: false }).order('id').limit(TODAY_LIMIT),
      client.from('people').select('id,name,company,status,next_follow_up_on').eq('user_id', options.userId)
        .lte('next_follow_up_on', today).order('next_follow_up_on').order('id').limit(TODAY_LIMIT),
      client.from('learning_items').select('id,concept,track,confidence,next_review_on').eq('user_id', options.userId)
        .lte('next_review_on', today).order('next_review_on').order('id').limit(TODAY_LIMIT),
    ])
    ;[log, settings, projects, jobs, people, learning].forEach((result) => checked(result))
    return {
      date: today,
      log: log.data,
      floorStatus: deriveTodayFloors(log.data, settings.data),
      activeProjects: projects.data,
      activeApplications: jobs.data,
      followUpsDue: people.data,
      learningDue: learning.data,
    }
  }

  async function getWeek() {
    const today = indiaDateKey()
    const range = weekRange(today)
    const [logs, projects, jobs, learning] = await Promise.all([
      client.from('daily_logs').select('*').eq('user_id', options.userId).gte('day', range.start).lte('day', range.end).order('day').limit(7),
      client.from('projects').select('id,name,status,deadline_on,next_action').eq('user_id', options.userId)
        .gte('deadline_on', range.start).lte('deadline_on', range.end).order('deadline_on').order('id').limit(WEEK_LIMIT),
      client.from('job_applications').select('id,company,role,status,follow_up_on,window_closes_on,next_action').eq('user_id', options.userId)
        .or(`and(follow_up_on.gte.${range.start},follow_up_on.lte.${range.end}),and(window_closes_on.gte.${range.start},window_closes_on.lte.${range.end})`)
        .order('follow_up_on', { nullsFirst: false }).order('id').limit(WEEK_LIMIT),
      client.from('learning_items').select('id,concept,track,confidence,next_review_on').eq('user_id', options.userId)
        .gte('next_review_on', range.start).lte('next_review_on', range.end).order('next_review_on').order('id').limit(WEEK_LIMIT),
    ])
    ;[logs, projects, jobs, learning].forEach((result) => checked(result))
    const totals = (logs.data ?? []).reduce((sum, row) => ({
      nodeMinutes: sum.nodeMinutes + row.node_minutes,
      dsaMinutes: sum.dsaMinutes + row.dsa_minutes,
      mathMinutes: sum.mathMinutes + row.math_minutes,
      jobMinutes: sum.jobMinutes + row.job_hunt_minutes,
    }), { nodeMinutes: 0, dsaMinutes: 0, mathMinutes: 0, jobMinutes: 0 })
    return { ...range, today, totals, logs: logs.data, projectDeadlines: projects.data, applicationDates: jobs.data, learningReviews: learning.data }
  }

  async function search(query: string, limit: number) {
    const data = checked(await client.rpc('search_command', { p_query: query.trim(), p_limit: limit }))
    return { query: query.trim(), results: data }
  }

  async function listProjects(status?: string) {
    let query = client.from('projects').select('*').eq('user_id', options.userId)
    if (status) query = query.eq('status', status)
    return { projects: checked(await query.order('deadline_on', { nullsFirst: false }).order('id').limit(LIST_LIMIT)) }
  }

  async function listJobs(status?: string) {
    let query = client.from('job_applications').select('*').eq('user_id', options.userId)
    if (status) query = query.eq('status', status)
    return { applications: checked(await query.order('follow_up_on', { nullsFirst: false }).order('id').limit(LIST_LIMIT)) }
  }

  async function getLearningDue(asOf = indiaDateKey()) {
    const query = client.from('learning_items').select('*').eq('user_id', options.userId).lte('next_review_on', asOf)
      .order('next_review_on').order('id').limit(LIST_LIMIT)
    return { asOf, items: checked(await query) }
  }

  async function audit(entry: AuditEntry): Promise<void> {
    const { error } = await options.service.from('mcp_audit_log').insert({
      user_id: options.userId,
      client_id: options.clientId.slice(0, 200),
      tool_name: entry.tool,
      input_summary: entry.summary,
      success: entry.success,
      error_message: entry.error?.slice(0, 300) ?? null,
      duration_ms: Math.max(0, Math.round(entry.durationMs)),
    })
    if (error) console.error('MCP audit write failed', error.message)
  }

  return {
    authorize, describeTypes, capture: captureV3, complete, schedule, query: queryV3, audit,
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function deriveTodayFloors(
  log: Record<string, unknown> | null,
  settings: Record<string, unknown> | null,
): Record<DailyFloorKey, { minutes: number; targetMinutes: number; met: boolean }> {
  return Object.fromEntries(DAILY_FLOOR_KEYS.map((key) => {
    const minutes = Number(log?.[`${key}_minutes`] ?? 0)
    const targetMinutes = Number(settings?.[`${key}_floor_minutes`] ?? DEFAULT_FLOORS[key])
    return [key, { minutes, targetMinutes, met: meetsFloor(minutes, targetMinutes) }]
  })) as Record<DailyFloorKey, { minutes: number; targetMinutes: number; met: boolean }>
}

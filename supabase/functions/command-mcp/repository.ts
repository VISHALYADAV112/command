import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { addDaysKey, indiaDateKey, weekRange } from './dates.ts'
import {
  DAILY_FLOOR_KEYS, DEFAULT_FLOORS, meetsFloor, type DailyFloorKey,
} from '../_shared/command-domain.ts'
import type { AuditEntry, CaptureInput, CommandRepository } from './types.ts'

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

function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export function createCommandRepository(options: RepositoryOptions): CommandRepository {
  const client = options.client ?? createClient(options.url, options.publishableKey, {
    global: { headers: { Authorization: `Bearer ${options.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
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

  async function capture(input: CaptureInput) {
    const id = await stableUuid(`${options.userId}\0${input.kind}\0${input.idempotencyKey}`)
    const common = { id, user_id: options.userId }
    const content = input.content?.trim() || null
    const nextAction = input.nextAction?.trim() || null
    const due = input.dueOn || null
    if (input.kind === 'idea') {
      checked(await client.from('ideas').upsert(
        { ...common, idea: input.title, problem: content, status: 'captured', next_action: nextAction },
        { onConflict: 'id', ignoreDuplicates: true },
      ))
    } else if (input.kind === 'learning') {
      checked(await client.from('learning_items').upsert(
        { ...common, concept: input.title, stack: 'brain', track: input.track ?? 'dsa', item_type: 'concept', confidence: 1, next_review_on: due ?? addDaysKey(indiaDateKey(), 1), mastery_hits: 0, source_url: input.sourceUrl ?? null, content_markdown: content },
        { onConflict: 'id', ignoreDuplicates: true },
      ))
    } else if (input.kind === 'project') {
      checked(await client.from('projects').upsert(
        { ...common, name: input.title, project_type: 'portfolio', status: 'active', payment_status: 'na', currency: 'INR', is_public: false, deadline_on: due, next_action: nextAction, content_markdown: content },
        { onConflict: 'id', ignoreDuplicates: true },
      ))
    } else if (input.kind === 'person') {
      checked(await client.from('people').upsert(
        { ...common, name: input.title, company: input.subtitle?.trim() || null, status: 'to_reach_out', next_follow_up_on: due, notes: content },
        { onConflict: 'id', ignoreDuplicates: true },
      ))
    } else {
      checked(await client.from('job_applications').upsert(
        { ...common, company: input.title, role: input.subtitle!, lane: 'sde', channel: 'india_product', status: 'researching', has_referral: false, window_closes_on: due, next_action: nextAction, notes: content },
        { onConflict: 'id', ignoreDuplicates: true },
      ))
    }
    return { created: { id, kind: input.kind, title: input.title }, idempotencyKey: input.idempotencyKey }
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

  return { getToday, getWeek, search, listProjects, listJobs, getLearningDue, capture, audit }
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

async function stableUuid(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).slice(0, 16)
  digest[6] = (digest[6] & 0x0f) | 0x50
  digest[8] = (digest[8] & 0x3f) | 0x80
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CommandData, DailyLog, JobApplication, LearningItem, Settings } from '../types'
import type {
  DbDailyLog, DbJobApplication, DbLearningItem, DbPerson, DbProject, DbUserSettings,
} from './database.types'
import {
  logToDb, mapApplication, mapLearning, mapLog, mapPerson, mapProject, mapSettings,
  applicationToDb,
} from './mappers'

export function exportData(data: CommandData, settings: Settings): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), settings, ...data }, null, 2)
}

export function exportCsv(kind: 'logs' | 'applications' | 'people' | 'projects' | 'learning', data: CommandData): string {
  const escape = (value: string | number | boolean | null | undefined): string => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const line = (row: (string | number | boolean | null | undefined)[]) => row.map(escape).join(',')

  switch (kind) {
    case 'logs':
      return [
        line(['day', 'meditation', 'gym', 'diet', 'node_minutes', 'dsa_minutes', 'math_minutes', 'job_minutes', 'note']),
        ...data.logs.map((log) => line([log.day, log.meditation, log.gym, log.diet, log.nodeMinutes, log.dsaMinutes, log.mathMinutes, log.jobMinutes, log.note])),
      ].join('\n')
    case 'applications':
      return [
        line(['company', 'role', 'lane', 'status', 'window_closes_on', 'follow_up_on', 'next_action']),
        ...data.applications.map((app) => line([app.company, app.role, app.lane, app.status, app.windowClosesOn, app.followUpOn, app.nextAction])),
      ].join('\n')
    case 'people':
      return [
        line(['name', 'company', 'status', 'next_follow_up']),
        ...data.people.map((person) => line([person.name, person.company, person.status, person.nextFollowUpOn])),
      ].join('\n')
    case 'projects':
      return [
        line(['name', 'type', 'status', 'deadline', 'next_action']),
        ...data.projects.map((project) => line([project.name, project.type, project.status, project.deadlineOn, project.nextAction])),
      ].join('\n')
    case 'learning':
      return [
        line(['concept', 'track', 'item_type', 'confidence', 'next_review', 'mastery_hits']),
        ...data.learning.map((item) => line([item.concept, item.track, item.itemType, item.confidence, item.nextReviewOn, item.masteryHits])),
      ].join('\n')
  }
}

export async function loadRemoteData(client: SupabaseClient): Promise<CommandData> {
  const logs = await client.from('daily_logs').select('*')
  const learning = await client.from('learning_items').select('*')
  const people = await client.from('people').select('*')
  const applications = await client.from('job_applications').select('*')
  const projects = await client.from('projects').select('*')
  return {
    logs: (logs.data ?? []).map((row) => mapLog(row as DbDailyLog)),
    learning: (learning.data ?? []).map((row) => mapLearning(row as DbLearningItem)),
    people: (people.data ?? []).map((row) => mapPerson(row as DbPerson)),
    applications: (applications.data ?? []).map((row) => mapApplication(row as DbJobApplication)),
    projects: (projects.data ?? []).map((row) => mapProject(row as DbProject)),
  }
}

export async function loadRemoteSettings(client: SupabaseClient): Promise<Settings> {
  const user = await client.auth.getUser()
  const id = user.data?.user?.id
  if (!id) return mapSettings(defaultSettingsRow())
  const { data } = await client.from('user_settings').select('*').eq('user_id', id).maybeSingle()
  if (!data) return mapSettings(defaultSettingsRow())
  return mapSettings(data as DbUserSettings)
}

export async function upsertLog(client: SupabaseClient, log: DailyLog): Promise<void> {
  await client.from('daily_logs').upsert({ ...logToDb(log) }, { onConflict: 'user_id,day' })
}

export async function insertApplication(client: SupabaseClient, app: JobApplication): Promise<void> {
  await client.from('job_applications').insert({ ...applicationToDb(app) })
}

export async function updateLearning(client: SupabaseClient, item: LearningItem): Promise<void> {
  await client.from('learning_items').upsert({
    id: item.id,
    concept: item.concept,
    track: item.track,
    item_type: item.itemType,
    confidence: item.confidence,
    next_review_on: item.nextReviewOn,
    mastery_hits: item.masteryHits,
    content_markdown: item.content,
  })
}

export async function saveRemoteSettings(client: SupabaseClient, settings: Settings): Promise<void> {
  const user = await client.auth.getUser()
  const id = user.data?.user?.id
  if (!id) return
  await client.from('user_settings').upsert({
    user_id: id,
    node_floor_minutes: settings.floors.node,
    dsa_floor_minutes: settings.floors.dsa,
    math_floor_minutes: settings.floors.math,
    job_hunt_floor_minutes: settings.floors.job,
    node_weekly_minutes: settings.budgets.node,
    dsa_weekly_minutes: settings.budgets.dsa,
    math_weekly_minutes: settings.budgets.math,
    job_hunt_weekly_minutes: settings.budgets.job,
  }, { onConflict: 'user_id' })
}

function defaultSettingsRow(): DbUserSettings {
  return {
    user_id: '',
    node_floor_minutes: 30, dsa_floor_minutes: 60, math_floor_minutes: 30, job_hunt_floor_minutes: 60,
    node_weekly_minutes: 420, dsa_weekly_minutes: 840, math_weekly_minutes: 420, job_hunt_weekly_minutes: 420,
    theme: 'dark',
  }
}


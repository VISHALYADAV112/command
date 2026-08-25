import type { CommandData, DailyLog, Idea, JobApplication, LearningItem, Person, Project, Settings } from '../types'
import type { CommandClient } from './supabase'
import { settings as defaultSettings } from '../domain'
import {
  applicationToDb, ideaToDb, learningToDb, logToDb, mapApplication, mapIdea, mapLearning,
  mapLog, mapPerson, mapProject, mapSettings, personToDb, projectToDb, settingsToDb,
} from './mappers'

function throwIfError(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message)
}

export function exportData(data: CommandData, settings: Settings): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), settings, ...data }, null, 2)
}

export type CsvTable = 'logs' | 'applications' | 'people' | 'projects' | 'learning' | 'ideas'

export function exportCsv(kind: CsvTable, data: CommandData): string {
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
        line(['id', 'company', 'role', 'lane', 'channel', 'status', 'applied_on', 'window_closes_on', 'follow_up_on', 'has_referral', 'ctc_lpa', 'referrer_id', 'job_url', 'resume_version', 'resume_drive_url', 'next_action', 'notes']),
        ...data.applications.map((app) => line([app.id, app.company, app.role, app.lane, app.channel, app.status, app.appliedOn, app.windowClosesOn, app.followUpOn, app.hasReferral, app.ctcLpa, app.referrerId, app.jobUrl, app.resumeVersion, app.resumeDriveUrl, app.nextAction, app.notes])),
      ].join('\n')
    case 'people':
      return [
        line(['id', 'name', 'company', 'email', 'linkedin_url', 'how_known', 'status', 'last_contacted_on', 'next_follow_up_on', 'notes']),
        ...data.people.map((person) => line([person.id, person.name, person.company, person.email, person.linkedinUrl, person.howKnown, person.status, person.lastContactOn, person.nextFollowUpOn, person.notes])),
      ].join('\n')
    case 'projects':
      return [
        line(['id', 'name', 'type', 'status', 'client', 'payment_status', 'amount', 'currency', 'is_public', 'deadline_on', 'repo_url', 'demo_url', 'drive_folder_url', 'next_action', 'content']),
        ...data.projects.map((project) => line([project.id, project.name, project.type, project.status, project.client, project.paymentStatus, project.amount, project.currency, project.isPublic, project.deadlineOn, project.repoUrl, project.demoUrl, project.driveFolderUrl, project.nextAction, project.content])),
      ].join('\n')
    case 'learning':
      return [
        line(['id', 'concept', 'stack', 'track', 'item_type', 'confidence', 'difficulty', 'next_review_on', 'last_reviewed_on', 'mastery_hits', 'source_url', 'content']),
        ...data.learning.map((item) => line([item.id, item.concept, item.stack, item.track, item.itemType, item.confidence, item.difficulty, item.nextReviewOn, item.lastReviewedOn, item.masteryHits, item.sourceUrl, item.content])),
      ].join('\n')
    case 'ideas':
      return [
        line(['id', 'idea', 'problem', 'target_market', 'monetization', 'status', 'next_action']),
        ...data.ideas.map((idea) => line([idea.id, idea.idea, idea.problem, idea.targetMarket, idea.monetization, idea.status, idea.nextAction])),
      ].join('\n')
  }
}

export async function loadRemoteData(client: CommandClient): Promise<CommandData> {
  const [logs, learning, people, applications, projects, ideas] = await Promise.all([
    client.from('daily_logs').select('*'),
    client.from('learning_items').select('*'),
    client.from('people').select('*'),
    client.from('job_applications').select('*'),
    client.from('projects').select('*'),
    client.from('ideas').select('*'),
  ])
  ;[logs, learning, people, applications, projects, ideas].forEach(throwIfError)
  return {
    logs: (logs.data ?? []).map(mapLog),
    learning: (learning.data ?? []).map(mapLearning),
    people: (people.data ?? []).map(mapPerson),
    applications: (applications.data ?? []).map(mapApplication),
    projects: (projects.data ?? []).map(mapProject),
    ideas: (ideas.data ?? []).map(mapIdea),
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

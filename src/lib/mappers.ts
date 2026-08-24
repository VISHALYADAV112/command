import type { CommandData, DailyLog, JobApplication, LearningItem, Person, Project, PracticeKey, Settings } from '../types'
import type { DbDailyLog, DbJobApplication, DbLearningItem, DbPerson, DbProject, DbUserSettings } from './database.types'

export function mapLog(row: DbDailyLog): DailyLog {
  return {
    day: row.day,
    meditation: row.meditation,
    gym: row.gym,
    diet: row.diet,
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
    track: row.track,
    itemType: row.item_type,
    confidence: row.confidence as 1 | 2 | 3 | 4 | 5,
    nextReviewOn: row.next_review_on,
    masteryHits: row.mastery_hits,
    content: row.content_markdown ?? '',
  }
}

export function mapPerson(row: DbPerson): Person {
  return {
    id: row.id,
    name: row.name,
    company: row.company ?? '',
    status: row.status,
    nextFollowUpOn: row.next_follow_up_on,
  }
}

export function mapApplication(row: DbJobApplication): JobApplication {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    lane: row.lane,
    status: row.status,
    windowClosesOn: row.window_closes_on,
    followUpOn: row.follow_up_on,
    nextAction: row.next_action ?? '',
  }
}

export function applicationToDb(app: JobApplication): Pick<DbJobApplication, 'company' | 'role' | 'lane' | 'status' | 'window_closes_on' | 'follow_up_on' | 'next_action'> {
  return {
    company: app.company,
    role: app.role,
    lane: app.lane,
    status: app.status,
    window_closes_on: app.windowClosesOn,
    follow_up_on: app.followUpOn,
    next_action: app.nextAction || null,
  }
}

export function mapProject(row: DbProject): Project {
  return {
    id: row.id,
    name: row.name,
    type: row.project_type,
    status: row.status,
    deadlineOn: row.deadline_on,
    nextAction: row.next_action ?? '',
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
  return { floors, budgets }
}

export type RemoteData = CommandData
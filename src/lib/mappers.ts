import type { CommandData, DailyLog, Idea, JobApplication, LearningItem, Person, Project, PracticeKey, Settings } from '../types'
import type { DbDailyLog, DbIdea, DbJobApplication, DbLearningItem, DbPerson, DbProject, DbUserSettings } from './db.rows'

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
    stack: row.stack,
    track: row.track,
    itemType: row.item_type,
    confidence: row.confidence as 1 | 2 | 3 | 4 | 5,
    difficulty: row.difficulty,
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
    howKnown: row.how_known,
    status: row.status,
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
    lane: row.lane,
    channel: row.channel,
    status: row.status,
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
    status: row.status,
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
    type: row.project_type,
    status: row.status,
    client: row.client ?? '',
    paymentStatus: row.payment_status,
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

export function settingsToDb(settings: Settings): Omit<DbUserSettings, 'user_id' | 'theme'> {
  return {
    node_floor_minutes: settings.floors.node,
    dsa_floor_minutes: settings.floors.dsa,
    math_floor_minutes: settings.floors.math,
    job_hunt_floor_minutes: settings.floors.job,
    node_weekly_minutes: settings.budgets.node,
    dsa_weekly_minutes: settings.budgets.dsa,
    math_weekly_minutes: settings.budgets.math,
    job_hunt_weekly_minutes: settings.budgets.job,
  }
}

export type RemoteData = CommandData

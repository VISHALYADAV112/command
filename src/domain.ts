import type { DailyLog, JobApplication, LearningItem, Person, PracticeKey, Recall, Settings } from './types'
import {
  COMMAND_TIMEZONE, DEFAULT_FLOORS, indiaDateKey, meetsFloor,
} from '../supabase/functions/_shared/command-domain'

export { COMMAND_TIMEZONE }

export const practices: Array<{ key: PracticeKey; label: string; shortLabel: string }> = [
  { key: 'node', label: 'Node', shortLabel: 'Node' },
  { key: 'dsa', label: 'DSA', shortLabel: 'DSA' },
  { key: 'math', label: 'Math', shortLabel: 'Math' },
  { key: 'job', label: 'Job hunt', shortLabel: 'Job' },
]

export const settings: Settings = {
  theme: 'night',
  floors: { ...DEFAULT_FLOORS },
  budgets: { node: 420, dsa: 840, math: 420, job: 420 },
  weeklyTargets: { applications: 15, peopleContacted: 2 },
}

export function dateKey(date: Date): string {
  return indiaDateKey(date)
}

export function dateFromKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 6, 30))
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + amount)
  return next
}

export function startOfMonday(date: Date): Date {
  const start = dateFromKey(dateKey(date))
  const day = start.getUTCDay()
  return addDays(start, -(day === 0 ? 6 : day - 1))
}

export function currentWeek(date: Date): Date[] {
  const monday = startOfMonday(date)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function minutesFor(log: DailyLog | undefined, key: PracticeKey): number {
  if (!log) return 0
  return key === 'node'
    ? log.nodeMinutes
    : key === 'dsa'
      ? log.dsaMinutes
      : key === 'math'
        ? log.mathMinutes
        : log.jobMinutes
}

export function weeklyTotals(logs: DailyLog[], week: Date[]): Record<PracticeKey, number> {
  const keys = new Set(week.map(dateKey))
  return logs.reduce<Record<PracticeKey, number>>(
    (total, log) => {
      if (!keys.has(log.day)) return total
      total.node += log.nodeMinutes
      total.dsa += log.dsaMinutes
      total.math += log.mathMinutes
      total.job += log.jobMinutes
      return total
    },
    { node: 0, dsa: 0, math: 0, job: 0 },
  )
}

export function weeklyJobHuntProgress(
  applications: Array<Pick<JobApplication, 'appliedOn'>>,
  people: Array<Pick<Person, 'lastContactOn'>>,
  today: Date,
): { applications: number; peopleContacted: number } {
  const week = currentWeek(today)
  const start = dateKey(week[0])
  const end = dateKey(week[6])
  const happenedThisWeek = (value: string | null): boolean => value !== null && value >= start && value <= end
  return {
    applications: applications.filter((application) => happenedThisWeek(application.appliedOn)).length,
    peopleContacted: people.filter((person) => happenedThisWeek(person.lastContactOn)).length,
  }
}

export function floorStatus(
  log: DailyLog | undefined,
  floors: Settings['floors'] = settings.floors,
): Record<PracticeKey, boolean> {
  return {
    node: meetsFloor(minutesFor(log, 'node'), floors.node),
    dsa: meetsFloor(minutesFor(log, 'dsa'), floors.dsa),
    math: meetsFloor(minutesFor(log, 'math'), floors.math),
    job: meetsFloor(minutesFor(log, 'job'), floors.job),
  }
}

export function compactDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder}m`
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}

export function hoursValue(minutes: number): string {
  if (minutes === 0) return '—'
  const hours = minutes / 60
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

export function dayDistance(from: Date, toKey: string): number {
  const start = dateFromKey(dateKey(from)).getTime()
  return Math.round((dateFromKey(toKey).getTime() - start) / 86_400_000)
}

export function applyRecall(item: LearningItem, recall: Recall, today: Date): LearningItem {
  const interval = recall === 'instant' ? 21 : recall === 'effort' ? 7 : recall === 'struggled' ? 3 : 1
  const confidence = Math.max(1, Math.min(5,
    item.confidence + (recall === 'instant' ? 1 : recall === 'struggled' ? -1 : recall === 'blank' ? -2 : 0),
  )) as LearningItem['confidence']
  const masteryHits = confidence === 5 && recall === 'instant' ? item.masteryHits + 1 : 0
  return {
    ...item,
    confidence,
    masteryHits,
    lastReviewedOn: dateKey(today),
    nextReviewOn: masteryHits >= 2 ? null : dateKey(addDays(dateFromKey(dateKey(today)), interval)),
  }
}

export function emptyLog(day: string): DailyLog {
  return {
    day,
    meditation: false,
    gym: false,
    diet: null,
    nodeMinutes: 0,
    dsaMinutes: 0,
    mathMinutes: 0,
    jobMinutes: 0,
    note: '',
  }
}

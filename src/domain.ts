import type { DailyLog, PracticeKey, Settings } from './types'

export const practices: Array<{ key: PracticeKey; label: string; shortLabel: string }> = [
  { key: 'node', label: 'Node', shortLabel: 'Node' },
  { key: 'dsa', label: 'DSA', shortLabel: 'DSA' },
  { key: 'math', label: 'Math', shortLabel: 'Math' },
  { key: 'job', label: 'Job hunt', shortLabel: 'Job' },
]

export const settings: Settings = {
  floors: { node: 30, dsa: 60, math: 30, job: 60 },
  budgets: { node: 420, dsa: 840, math: 420, job: 420 },
}

export function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateFromKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function startOfMonday(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
  return start
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

export function floorStatus(log: DailyLog | undefined): Record<PracticeKey, boolean> {
  return {
    node: minutesFor(log, 'node') >= settings.floors.node,
    dsa: minutesFor(log, 'dsa') >= settings.floors.dsa,
    math: minutesFor(log, 'math') >= settings.floors.math,
    job: minutesFor(log, 'job') >= settings.floors.job,
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
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  return Math.round((dateFromKey(toKey).getTime() - start) / 86_400_000)
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

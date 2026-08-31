export const COMMAND_TIMEZONE = 'Asia/Kolkata'

export const PRACTICE_KEYS = ['node', 'dsa', 'math', 'job'] as const
export const DAILY_FLOOR_KEYS = ['node', 'dsa', 'math'] as const

export type PracticeKey = typeof PRACTICE_KEYS[number]
export type DailyFloorKey = typeof DAILY_FLOOR_KEYS[number]

export const DEFAULT_FLOORS: Record<PracticeKey, number> = {
  node: 30,
  dsa: 60,
  math: 30,
  job: 60,
}

export function indiaDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COMMAND_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function addDaysKey(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function weekRange(key: string): { start: string; end: string } {
  const date = new Date(`${key}T12:00:00Z`)
  const mondayOffset = (date.getUTCDay() + 6) % 7
  return { start: addDaysKey(key, -mondayOffset), end: addDaysKey(key, 6 - mondayOffset) }
}

export function meetsFloor(minutes: number, targetMinutes: number): boolean {
  return minutes >= targetMinutes
}

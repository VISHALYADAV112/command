import { describe, expect, it } from 'vitest'
import { currentWeek, dateKey, floorStatus, weeklyTotals } from './domain'
import type { DailyLog } from './types'

function log(day: string, values: Partial<DailyLog> = {}): DailyLog {
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
    ...values,
  }
}

describe('currentWeek', () => {
  it('uses a Monday to Sunday week', () => {
    const week = currentWeek(new Date(2026, 7, 26))
    expect(week.map(dateKey)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ])
  })
})

describe('floorStatus', () => {
  it('derives the four bindu states from actual minutes', () => {
    expect(floorStatus(log('2026-08-24', {
      nodeMinutes: 30,
      dsaMinutes: 59,
      mathMinutes: 45,
      jobMinutes: 60,
    }))).toEqual({ node: true, dsa: false, math: true, job: true })
  })
})

describe('weeklyTotals', () => {
  it('sums only logs inside the selected week', () => {
    const week = currentWeek(new Date(2026, 7, 26))
    const totals = weeklyTotals([
      log('2026-08-24', { nodeMinutes: 30, dsaMinutes: 60 }),
      log('2026-08-26', { nodeMinutes: 45, mathMinutes: 30, jobMinutes: 60 }),
      log('2026-08-31', { nodeMinutes: 999 }),
    ], week)
    expect(totals).toEqual({ node: 75, dsa: 60, math: 30, job: 60 })
  })
})

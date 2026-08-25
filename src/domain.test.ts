import { describe, expect, it } from 'vitest'
import { applyRecall, currentWeek, dateKey, floorStatus, weeklyTotals } from './domain'
import type { DailyLog, LearningItem } from './types'

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

describe('India day boundary', () => {
  it('uses Asia/Kolkata instead of the device timezone', () => {
    expect(dateKey(new Date('2026-08-24T20:00:00.000Z'))).toBe('2026-08-25')
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

  it('uses the user-configured floors', () => {
    expect(floorStatus(log('2026-08-24', { nodeMinutes: 45 }), {
      node: 60, dsa: 0, math: 0, job: 0,
    })).toEqual({ node: false, dsa: true, math: true, job: true })
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

describe('applyRecall', () => {
  const item: LearningItem = {
    id: '00000000-0000-4000-8000-000000000999',
    concept: 'Invariant', stack: 'brain', track: 'dsa', itemType: 'concept',
    confidence: 4, difficulty: 'medium', nextReviewOn: '2026-08-25',
    lastReviewedOn: null, masteryHits: 1, sourceUrl: '', content: 'Keep it true.',
  }

  it('retires an item after a second confident instant recall', () => {
    expect(applyRecall(item, 'instant', new Date('2026-08-25T06:00:00Z'))).toMatchObject({
      confidence: 5,
      masteryHits: 2,
      lastReviewedOn: '2026-08-25',
      nextReviewOn: null,
    })
  })

  it('resets mastery and schedules a blank recall for tomorrow', () => {
    expect(applyRecall(item, 'blank', new Date('2026-08-25T06:00:00Z'))).toMatchObject({
      confidence: 2,
      masteryHits: 0,
      nextReviewOn: '2026-08-26',
    })
  })
})

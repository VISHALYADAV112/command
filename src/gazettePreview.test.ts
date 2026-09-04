import { describe, expect, it } from 'vitest'
import { createGazettePreviewData, createGazettePreviewWeek } from './gazettePreview'
import { weeklyOutcomeProgress } from './v3Selectors'

// The sample edition must read the same on every weekday. Offsets measured from
// "today" instead of the week's Monday used to pull a historical application
// into the current week from Thursday onward, so the Outreach floor showed
// 15 of 15 met instead of the reference's 14 of 15.
describe('Gazette v12 sample edition', () => {
  const week = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']

  it.each(week)('reports the reference outreach figures on %s', (day) => {
    const now = new Date(`${day}T06:00:00.000Z`)
    const progress = weeklyOutcomeProgress(createGazettePreviewData(now), now)
    expect(progress.applications).toBe(14)
    expect(progress.peopleContacted).toBe(2)
  })

  it.each(week)('reports the reference week totals on %s', (day) => {
    const summary = createGazettePreviewWeek(new Date(`${day}T06:00:00.000Z`))
    expect(summary.applicationsSubmitted).toBe(14)
    expect(summary.applicationTarget).toBe(15)
    expect(summary.days.filter((entry) => entry.hasLog)).toHaveLength(6)
  })

  it('keeps the reference standing queue on every weekday', () => {
    for (const day of week) {
      const now = new Date(`${day}T06:00:00.000Z`)
      const open = createGazettePreviewData(now).commitments.filter((item) => item.state === 'open')
      expect(open).toHaveLength(4)
    }
  })
})

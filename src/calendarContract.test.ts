import { describe, expect, it } from 'vitest'
import { allDayEvent, oauthState, pkceVerifier, todayWindow } from '../supabase/functions/_shared/calendar'

describe('Calendar edge contract', () => {
  it("uses Google's exclusive end date for all-day events", () => {
    expect(allDayEvent('2026-08-31', 'Deadline', 'Ship it')).toEqual({
      summary: 'Deadline',
      description: 'Ship it',
      start: { date: '2026-08-31' },
      end: { date: '2026-09-01' },
    })
  })

  it('creates cryptographically random URL-safe PKCE and state values', () => {
    const verifier = pkceVerifier()
    const first = oauthState('user-id')
    const second = oauthState('user-id')
    expect(verifier).toMatch(/^[A-Za-z0-9._~-]{64}$/)
    expect(first).toMatch(/^user-id\.[A-Za-z0-9._~-]{32}$/)
    expect(first).not.toBe(second)
  })

  it('lists the current calendar day in India across a UTC boundary', () => {
    expect(todayWindow(new Date('2026-08-24T20:00:00Z'))).toEqual({
      timeMin: '2026-08-24T18:30:00.000Z',
      timeMax: '2026-08-25T18:30:00.000Z',
    })
  })
})

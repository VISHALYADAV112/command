import { describe, expect, it } from 'vitest'
import { allDayEvent, calendarCommitmentEvent, isCalendarCommitment, oauthState, pkceVerifier, todayWindow } from '../supabase/functions/_shared/calendar'
import { decryptCalendarToken, encryptCalendarToken } from '../supabase/functions/_shared/calendar-token'

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

  it('maps only approved canonical commitment kinds', () => {
    expect(isCalendarCommitment({ kind: 'deadline', action: 'Submit', state: 'open' })).toBe(true)
    expect(isCalendarCommitment({ kind: 'milestone', action: 'Launch', state: 'open' })).toBe(true)
    expect(isCalendarCommitment({ kind: 'drill', action: 'Mock interview — systems', state: 'open' })).toBe(true)
    expect(isCalendarCommitment({ kind: 'drill', action: 'Binary-search drill', state: 'open' })).toBe(false)
    expect(isCalendarCommitment({ kind: 'deadline', action: 'Submit', state: 'completed' })).toBe(false)
  })

  it('derives Calendar content from the canonical commitment instead of browser text', () => {
    expect(calendarCommitmentEvent({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'deadline', action: 'Submit final package', dueOn: '2026-09-10', state: 'open',
      entityTitle: 'Acme role', typeName: 'Application',
    })).toEqual({
      summary: 'Acme role — Submit final package',
      description: 'Application · deadline · Command commitment',
      start: '2026-09-10',
      entity_type: 'commitment',
      entity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      idempotency_key: 'commitment-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
  })

  it('encrypts refresh tokens with randomized AES-GCM ciphertext', async () => {
    const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
    const first = await encryptCalendarToken('private-refresh-token', key)
    const second = await encryptCalendarToken('private-refresh-token', key)
    expect(first).not.toBe(second)
    expect(first).not.toContain('private-refresh-token')
    await expect(decryptCalendarToken(first, key)).resolves.toBe('private-refresh-token')
    await expect(decryptCalendarToken(`${first}tampered`, key)).resolves.toBeNull()
  })
})

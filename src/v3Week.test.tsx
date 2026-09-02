import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDemoData } from './data'
import { settings } from './domain'
import type { ActivityEvent, AgentProposal, Commitment } from './types'
import { deriveWeekSummary, weekHasActivity } from './v3Week'
import { WeekView } from './views/WeekView'

const today = new Date('2026-09-02T06:00:00.000Z')

describe('Phase 7 Week', () => {
  it('derives Monday–Sunday India boundaries and all approved outcomes', () => {
    const data = createDemoData(today)
    const entityId = data.entities[0].id
    data.legacy.logs = [
      { day: '2026-08-31', nodeMinutes: 40, dsaMinutes: 70, mathMinutes: 20, jobMinutes: 90, meditation: true, gym: false, diet: 'on_track', note: '' },
      { day: '2026-09-02', nodeMinutes: 5, dsaMinutes: 10, mathMinutes: 15, jobMinutes: 90, meditation: false, gym: true, diet: 'loose', note: '' },
    ]
    data.activityEvents = [
      event('application.submitted', '2026-08-30T18:30:00.000Z', entityId),
      event('application.submitted', '2026-08-30T18:29:59.999Z', crypto.randomUUID()),
      event('person.contacted', '2026-09-06T18:29:59.999Z', crypto.randomUUID()),
      event('commitment.cancelled', '2026-09-01T06:00:00.000Z', entityId),
    ]
    data.commitments = [
      commitment('completed', '2026-08-31', '2026-08-30T18:30:00.000Z', entityId),
      commitment('open', '2026-09-01', null, entityId),
      commitment('open', '2026-09-02', null, entityId),
    ]
    data.agentProposals = [
      proposal('pending', '2026-08-31T06:00:00.000Z', null),
      proposal('approved', '2026-08-30T18:30:00.000Z', '2026-09-01T06:00:00.000Z'),
      proposal('rejected', '2026-09-02T06:00:00.000Z', '2026-09-06T18:29:59.999Z'),
    ]

    const summary = deriveWeekSummary(data, settings, today)
    expect(summary).toMatchObject({
      weekStart: '2026-08-31', weekEnd: '2026-09-06',
      practice: {
        node: { minutes: 45, target: 420 },
        dsa: { minutes: 80, target: 840 },
        math: { minutes: 35, target: 420 },
      },
      applicationsSubmitted: 1, applicationTarget: 15,
      peopleContacted: 1, peopleTarget: 2,
      commitments: { completed: 1, cancelled: 1, missed: 1 },
      proposals: { proposed: 3, approved: 1, rejected: 1 },
    })
    expect(summary.days).toHaveLength(7)
    expect(summary.days.filter((day) => day.isFuture).map((day) => day.day)).toEqual([
      '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06',
    ])
  })

  it('keeps an empty week structured and renders future days as pending', () => {
    const data = createDemoData(today)
    data.legacy.logs = []
    data.activityEvents = []
    data.commitments = []
    data.agentProposals = []

    const summary = deriveWeekSummary(data, settings, today)
    expect(weekHasActivity(summary)).toBe(false)
    expect(summary.days).toHaveLength(7)
    render(<WeekView data={data} settings={settings} today={today} />)

    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument()
    expect(screen.getAllByText('Pending')).toHaveLength(4)
    expect(screen.getAllByText('Not logged')).toHaveLength(3)
    const thursday = screen.getByText(/Thursday/).closest('article')!
    expect(within(thursday).getByText('Pending')).toBeInTheDocument()
    expect(within(thursday).queryByText('0m')).not.toBeInTheDocument()
  })
})

function event(eventType: string, occurredAt: string, entityId: string): ActivityEvent {
  return {
    id: crypto.randomUUID(), entityId, commitmentId: null, eventType, payload: {}, source: 'ui', clientId: null,
    idempotencyKey: crypto.randomUUID(), occurredAt, createdAt: occurredAt,
  }
}

function commitment(state: Commitment['state'], dueOn: string, completedAt: string | null, entityId: string): Commitment {
  return {
    id: crypto.randomUUID(), entityId, kind: 'deadline', action: 'Test commitment', dueOn,
    state, outcome: completedAt ? 'Done' : null, completedAt, originSource: 'ui',
  }
}

function proposal(state: AgentProposal['state'], createdAt: string, decidedAt: string | null): AgentProposal {
  return {
    id: crypto.randomUUID(), clientId: 'week-client', operation: 'capture', entityTypeId: crypto.randomUUID(),
    targetEntityId: null, targetCommitmentId: null, targetUpdatedAt: null,
    proposedEntity: {}, proposedCommitment: null, state, decisionNote: null,
    resultEntityId: null, resultCommitmentId: null, resultEventId: null,
    idempotencyKey: crypto.randomUUID(), expiresAt: '2026-09-09T00:00:00.000Z', decidedAt, createdAt,
  }
}

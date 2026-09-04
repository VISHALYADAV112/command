import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDemoData } from './data'
import type { ActivityEvent, Commitment, Entity } from './types'
import { deriveRunSummary } from './v3Run'
import { RunView } from './views/RunView'

const today = new Date('2026-09-02T06:00:00.000Z')

describe('Phase 7 Run', () => {
  it('derives the five fixed markers and three completed India-local months', () => {
    const data = emptyData()
    const type = Object.fromEntries(data.entityTypes.map((item) => [item.typeKey, item.id]))
    data.entities = [
      entity(type.project, 'June portfolio', { project_type: 'portfolio', status: 'done', is_public: true, content_markdown: 'Documented', repo_url: 'https://example.test/repo' }, '2026-05-01T00:00:00Z', '2026-06-10T00:00:00Z'),
      entity(type.project, 'August portfolio', { project_type: 'portfolio', status: 'done', is_public: true, content_markdown: 'Documented', demo_url: 'https://example.test/demo' }, '2026-07-01T00:00:00Z', '2026-08-10T00:00:00Z'),
      entity(type.learning, 'June pattern', { track: 'dsa', item_type: 'pattern', confidence: 5, mastery_hits: 2, last_reviewed_on: '2026-06-15' }, '2026-05-01T00:00:00Z', '2026-06-15T00:00:00Z'),
      entity(type.learning, 'August pattern', { track: 'dsa', item_type: 'pattern', confidence: 5, mastery_hits: 2, last_reviewed_on: '2026-08-15' }, '2026-07-01T00:00:00Z', '2026-08-15T00:00:00Z'),
      entity(type.learning, 'Covered pattern', { track: 'dsa', item_type: 'pattern', confidence: 4, mastery_hits: 1, last_reviewed_on: '2026-08-20' }, '2026-08-01T00:00:00Z', '2026-08-20T00:00:00Z'),
      entity(type.application, 'June application', { status: 'phone' }, '2026-06-01T00:00:00Z'),
      entity(type.application, 'July application', { status: 'oa' }, '2026-07-01T00:00:00Z'),
      entity(type.application, 'August application', { status: 'offer' }, '2026-08-01T00:00:00Z'),
      entity(type.person, 'First person', {}, '2026-05-01T00:00:00Z'),
      entity(type.person, 'Second person', {}, '2026-08-01T00:00:00Z'),
    ]
    const [junePattern, augustPattern] = data.entities.filter((item) => item.entityTypeId === type.learning)
    const applications = data.entities.filter((item) => item.entityTypeId === type.application)
    const people = data.entities.filter((item) => item.entityTypeId === type.person)
    data.commitments = [
      commitment(junePattern.id, 'drill', 'Mock interview: systems', '2026-06-20T04:30:00Z'),
      commitment(augustPattern.id, 'drill', 'Mock interview — algorithms', '2026-08-20T04:30:00Z'),
      commitment(people[0].id, 'contact', 'Referral conversation', '2026-06-25T04:30:00Z'),
      commitment(people[0].id, 'contact', 'Follow-up conversation', '2026-07-25T04:30:00Z'),
      commitment(people[1].id, 'contact', 'Referral conversation', '2026-08-25T04:30:00Z'),
    ]
    data.activityEvents = applications.map((application, index) => event(
      application.id, `2026-0${index + 6}-05T04:30:00Z`, `2026-0${index + 6}-05T04:30:00Z`,
    ))

    const summary = deriveRunSummary(data, today)
    expect(summary).toMatchObject({
      asOfDay: '2026-09-02', historyStart: '2026-06-01', historyEnd: '2026-08-31',
      publicPortfolio: { current: 2, target: 3, historyReady: true },
      dsaPatterns: { current: 2, covered: 3, target: 24, historyReady: true },
      mockInterviews: { current: 2, target: 10, historyReady: true },
      applicationConversion: { current: 66.7, numerator: 2, denominator: 3, target: 25, historyReady: true },
      referralConversations: { current: 2, target: 12, historyReady: true },
    })
    expect(summary.publicPortfolio.history.map((point) => point.value)).toEqual([1, 1, 2])
    expect(summary.applicationConversion.history.map((point) => point.value)).toEqual([100, 0, 100])
  })

  it('shows current values while suppressing trends when history is insufficient', () => {
    const data = emptyData()
    const summary = deriveRunSummary(data, today)
    expect(summary.applicationConversion.current).toBeNull()
    expect(Object.values(summary).filter((value) => typeof value === 'object' && value && 'historyReady' in value)
      .every((metric) => metric.historyReady === false)).toBe(true)

    render(<RunView data={data} today={today} />)
    expect(screen.getByRole('heading', { name: 'The run' })).toBeInTheDocument()
    expect(screen.getAllByText(/Trend withheld/)).toHaveLength(5)
    expect(screen.getByRole('heading', { name: 'Screen-to-technical conversion' })).toBeInTheDocument()
    expect(screen.queryByText(/oldest to latest/)).not.toBeInTheDocument()
  })
})

function emptyData() {
  const data = createDemoData(today)
  data.entities = []
  data.commitments = []
  data.activityEvents = []
  data.agentProposals = []
  data.legacy = { logs: [], applications: [], people: [], projects: [], learning: [], ideas: [] }
  return data
}

function entity(entityTypeId: string, title: string, fields: Entity['fields'], createdAt: string, updatedAt = createdAt): Entity {
  return { id: crypto.randomUUID(), entityTypeId, title, fields, schemaVersion: 2, archivedAt: null, createdAt, updatedAt }
}

function commitment(entityId: string, kind: Commitment['kind'], action: string, completedAt: string): Commitment {
  return { id: crypto.randomUUID(), entityId, kind, action, dueOn: completedAt.slice(0, 10), state: 'completed', outcome: 'Done', completedAt, originSource: 'ui' }
}

function event(entityId: string, occurredAt: string, createdAt: string): ActivityEvent {
  return { id: crypto.randomUUID(), entityId, commitmentId: null, eventType: 'application.submitted', payload: {}, source: 'ui', clientId: null, idempotencyKey: crypto.randomUUID(), occurredAt, createdAt }
}

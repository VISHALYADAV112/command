import { describe, expect, it } from 'vitest'
import { createDemoData } from './data'
import { settings } from './domain'
import { browseEntities, dueItems, threeFloorStatus, weeklyOutcomeProgress } from './v3Selectors'

const today = new Date('2026-08-25T06:00:00Z')

describe('v3 derived selectors', () => {
  it('orders the unified queue and applies due windows and type filters', () => {
    const data = createDemoData(today)
    expect(dueItems(data, today, 'overdue').every((item) => item.dueStatus === 'overdue')).toBe(true)
    expect(dueItems(data, today, 'today', 'learning').every((item) => item.type.typeKey === 'learning' && item.dueStatus === 'today')).toBe(true)
    expect(dueItems(data, today).map((item) => item.commitment.dueOn)).toEqual([...dueItems(data, today).map((item) => item.commitment.dueOn)].sort())
  })

  it('uses only the approved three daily floors and immutable weekly outcome events', () => {
    const data = createDemoData(today)
    const application = data.entities.find((item) => item.title.startsWith('Razorpay'))!
    const person = data.entities.find((item) => item.title === 'Ananya Rao')!
    data.activityEvents.push(
      { id: crypto.randomUUID(), entityId: application.id, commitmentId: null, eventType: 'application.submitted', payload: {}, source: 'ui', clientId: null, idempotencyKey: 'application-event', occurredAt: '2026-08-25T06:30:00.000Z', createdAt: '2026-08-25T06:30:00.000Z' },
      { id: crypto.randomUUID(), entityId: person.id, commitmentId: null, eventType: 'person.contacted', payload: {}, source: 'ui', clientId: null, idempotencyKey: 'person-event', occurredAt: '2026-08-25T06:30:00.000Z', createdAt: '2026-08-25T06:30:00.000Z' },
    )
    expect(threeFloorStatus(data, settings, today).map((item) => item.key)).toEqual(['node', 'dsa', 'math'])
    expect(weeklyOutcomeProgress(data, today)).toEqual({ applications: 1, peopleContacted: 1 })
  })

  it('searches and filters registry records using registered fields', () => {
    const data = createDemoData(today)
    const type = data.entityTypes.find((item) => item.typeKey === 'application')!
    expect(browseEntities(data, type, 'Atlassian')).toHaveLength(1)
    expect(browseEntities(data, type, '', { status: 'applied' }).map((item) => item.title)).toEqual([
      'Razorpay — Software Engineer — Backend',
    ])
  })

  it('uses canonical timestamps for registry default sorting', () => {
    const data = createDemoData(today)
    const type = data.entityTypes.find((item) => item.typeKey === 'project')!
    const projects = data.entities.filter((item) => item.entityTypeId === type.id)
    projects[0].updatedAt = '2026-08-20T00:00:00.000Z'
    projects[1].updatedAt = '2026-08-25T00:00:00.000Z'

    expect(browseEntities(data, type).map((item) => item.id)).toEqual([projects[1].id, projects[0].id])
  })
})

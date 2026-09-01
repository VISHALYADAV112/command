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

  it('uses only the approved three daily floors and canonical weekly outcome fields', () => {
    const data = createDemoData(today)
    const application = data.entities.find((item) => item.title.startsWith('Razorpay'))!
    const person = data.entities.find((item) => item.title === 'Ananya Rao')!
    application.fields.applied_on = '2026-08-25'
    person.fields.last_contacted_on = '2026-08-25'
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
})

import { describe, expect, it } from 'vitest'
import { createLegacyDemoData } from './data'
import { upgradeLegacyData } from './v3Data'

describe('legacy-to-v3 compatibility projection', () => {
  it('builds the canonical registry, entities, and commitments deterministically', () => {
    const legacy = createLegacyDemoData(new Date('2026-08-25T06:00:00Z'))
    const first = upgradeLegacyData(legacy)
    const second = upgradeLegacyData(legacy)

    expect(first.version).toBe(3)
    expect(first.entityTypes.map((type) => type.typeKey)).toEqual([
      'application', 'person', 'project', 'learning', 'note',
    ])
    expect(first.entities).toEqual(second.entities)
    expect(first.commitments).toEqual(second.commitments)
    expect(first.activityEvents).toEqual(second.activityEvents)
    expect(first.activityEvents.some((event) => event.eventType === 'entity.migrated')).toBe(true)
    expect(first.commitments.every((item) => item.state === 'open' && item.originSource === 'migration')).toBe(true)
  })

  it('preserves historical job minutes and converts ideas into tagged notes', () => {
    const legacy = createLegacyDemoData(new Date('2026-08-25T06:00:00Z'))
    const data = upgradeLegacyData(legacy)
    const noteType = data.entityTypes.find((type) => type.typeKey === 'note')
    const notes = data.entities.filter((item) => item.entityTypeId === noteType?.id)

    expect(data.legacy.logs.map((log) => log.jobMinutes)).toEqual(legacy.logs.map((log) => log.jobMinutes))
    expect(notes).toHaveLength(legacy.ideas.length)
    expect(notes.every((note) => note.fields.tag === 'idea')).toBe(true)
  })

  it('keeps built-in field keys aligned with the seeded database registry', () => {
    const data = upgradeLegacyData({})
    const application = data.entityTypes.find((type) => type.typeKey === 'application')
    const learning = data.entityTypes.find((type) => type.typeKey === 'learning')

    expect(application?.fields.map((field) => field.key)).toContain('applied_on')
    expect(application?.allowedCommitmentKinds).toEqual(['follow-up', 'deadline', 'milestone'])
    expect(learning?.pluginKey).toBe('spaced_repetition')
    expect(learning?.fields.every((field) => field.deprecated === false)).toBe(true)
  })
})

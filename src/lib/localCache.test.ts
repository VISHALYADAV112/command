import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoData, createLegacyDemoData } from '../data'
import { settings } from '../domain'
import {
  readDemoData, readLiveCache, readStoredSettings, writeDemoData, writeLiveCache,
  writeStoredSettings,
} from './localCache'

describe('stored settings compatibility', () => {
  beforeEach(() => localStorage.clear())

  it('adds approved weekly targets to older settings caches', () => {
    localStorage.setItem('command.prototype.settings.v1', JSON.stringify({
      floors: settings.floors,
      budgets: settings.budgets,
    }))

    expect(readStoredSettings()?.weeklyTargets).toEqual({
      applications: 15,
      peopleContacted: 2,
    })
  })

  it('preserves customized weekly targets', () => {
    const customized = {
      ...settings,
      weeklyTargets: { applications: 20, peopleContacted: 3 },
    }
    writeStoredSettings(customized)
    expect(readStoredSettings()).toEqual(customized)
    expect(JSON.parse(localStorage.getItem('command.prototype.settings.v3') ?? '{}')).toEqual({
      version: 3,
      data: customized,
    })
  })
})

describe('versioned command data caches', () => {
  beforeEach(() => localStorage.clear())

  it('stores and reads the v3 aggregate in a versioned envelope', () => {
    const data = createDemoData(new Date('2026-08-25T06:00:00Z'))
    writeDemoData(data)
    writeLiveCache(data)

    expect(readDemoData()).toEqual(data)
    expect(readLiveCache()).toEqual(data)
    expect(JSON.parse(localStorage.getItem('command.prototype.v3') ?? '{}').version).toBe(3)
    expect(JSON.parse(localStorage.getItem('command.live-cache.v3') ?? '{}').data.version).toBe(3)
  })

  it('migrates a v1 demo cache without deleting its compatibility data', () => {
    const legacy = createLegacyDemoData(new Date('2026-08-25T06:00:00Z'))
    localStorage.setItem('command.prototype.v1', JSON.stringify(legacy))

    const migrated = readDemoData()

    expect(migrated.version).toBe(3)
    expect(migrated.legacy).toEqual(legacy)
    expect(migrated.entityTypes.map((type) => type.typeKey)).toEqual([
      'application', 'person', 'project', 'learning', 'note',
    ])
    expect(migrated.entities).toHaveLength(
      legacy.applications.length + legacy.people.length + legacy.projects.length
        + legacy.learning.length + legacy.ideas.length,
    )
    expect(localStorage.getItem('command.prototype.v1')).not.toBeNull()
    expect(JSON.parse(localStorage.getItem('command.prototype.v3') ?? '{}').data.version).toBe(3)
  })

  it('ignores an incompatible v3 cache instead of exposing partial state', () => {
    localStorage.setItem('command.prototype.v3', JSON.stringify({
      version: 3,
      data: { version: 3, entities: [] },
    }))

    const fallback = readDemoData()
    expect(fallback.version).toBe(3)
    expect(fallback.entityTypes).toHaveLength(5)
    expect(fallback.legacy.applications.length).toBeGreaterThan(0)
  })
})

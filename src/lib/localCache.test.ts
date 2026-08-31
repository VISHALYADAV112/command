import { beforeEach, describe, expect, it } from 'vitest'
import { settings } from '../domain'
import { readStoredSettings, writeStoredSettings } from './localCache'

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
  })
})

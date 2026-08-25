import { describe, expect, it } from 'vitest'
import { createDemoData } from '../data'
import { settings } from '../domain'
import {
  applicationToDb, ideaToDb, learningToDb, logToDb, mapApplication, mapIdea,
  mapLearning, mapLog, mapPerson, mapProject, mapSettings, personToDb,
  projectToDb, settingsToDb,
} from './mappers'

describe('database mappers', () => {
  const data = createDemoData(new Date('2026-08-25T06:00:00Z'))

  it('round-trips every persisted model field', () => {
    expect(mapApplication(applicationToDb(data.applications[0]))).toEqual(data.applications[0])
    expect(mapPerson(personToDb(data.people[0]))).toEqual(data.people[0])
    expect(mapProject(projectToDb(data.projects[0]))).toEqual(data.projects[0])
    expect(mapIdea(ideaToDb(data.ideas[0]))).toEqual(data.ideas[0])
    expect(mapLearning(learningToDb(data.learning[0]))).toEqual(data.learning[0])
    expect(mapLog({ id: crypto.randomUUID(), ...logToDb(data.logs[0]) })).toEqual(data.logs[0])
  })

  it('keeps target settings at the mapper boundary', () => {
    expect(mapSettings({ user_id: crypto.randomUUID(), theme: 'dark', ...settingsToDb(settings) })).toEqual(settings)
  })
})

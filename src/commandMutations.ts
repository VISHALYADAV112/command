import type { Session } from '@supabase/supabase-js'
import type { CommandData, DailyLog, Idea, JobApplication, LearningItem, Person, Project, Settings } from './types'
import type { CommandMode } from './useCommandData'
import type { RemoteSync } from './useRemoteSync'
import { getSupabase } from './lib/supabase'
import {
  deleteRow, saveIdeaRow, savePersonRow, saveProjectRow, saveRemoteSettings,
  upsertApplicationRow, upsertLearning, upsertLog,
} from './lib/api'
import { writeStoredSettings } from './lib/localCache'

interface Options {
  mode: CommandMode
  session: Session | null
  dataRef: { current: CommandData | null }
  setData: (data: CommandData) => void
  setSettings: (settings: Settings) => void
  sync: RemoteSync
}

export function createCommandMutations(options: Options) {
  const { mode, session, dataRef, setData, setSettings, sync } = options

  function update(fn: (current: CommandData) => CommandData): void {
    if (!dataRef.current) return
    const next = fn(dataRef.current)
    dataRef.current = next
    setData(next)
  }

  function canMutate(): boolean {
    if (!sync.canWrite()) return false
    if (mode === 'live' && !session?.user.id) {
      sync.fail(new Error('Your session has expired. Sign in again.'), 'Your session has expired.')
      return false
    }
    return true
  }

  function remote(action: (client: NonNullable<ReturnType<typeof getSupabase>>, userId: string) => Promise<unknown>) {
    if (mode !== 'live' || !session?.user.id) return
    const client = getSupabase()
    if (client) sync.run(() => action(client, session.user.id))
  }

  function replace<T extends { id: string }>(list: T[], item: T): T[] {
    return list.some((existing) => existing.id === item.id)
      ? list.map((existing) => existing.id === item.id ? item : existing)
      : [item, ...list]
  }

  function saveLog(log: DailyLog): boolean {
    if (!canMutate()) return false
    update((data) => ({
      ...data,
      legacy: { ...data.legacy, logs: [...data.legacy.logs.filter((item) => item.day !== log.day), log] },
    }))
    remote((client, userId) => upsertLog(client, log, userId))
    return true
  }

  function saveApplication(app: JobApplication): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, applications: replace(data.legacy.applications, app) } }))
    remote((client, userId) => upsertApplicationRow(client, app, userId))
    return true
  }

  function deleteApplication(id: string): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, applications: data.legacy.applications.filter((item) => item.id !== id) } }))
    remote((client) => deleteRow(client, 'job_applications', id))
    return true
  }

  function savePerson(person: Person): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, people: replace(data.legacy.people, person) } }))
    remote((client, userId) => savePersonRow(client, person, userId))
    return true
  }

  function deletePerson(id: string): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, people: data.legacy.people.filter((item) => item.id !== id) } }))
    remote((client) => deleteRow(client, 'people', id))
    return true
  }

  function saveProject(project: Project): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, projects: replace(data.legacy.projects, project) } }))
    remote((client, userId) => saveProjectRow(client, project, userId))
    return true
  }

  function deleteProject(id: string): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, projects: data.legacy.projects.filter((item) => item.id !== id) } }))
    remote((client) => deleteRow(client, 'projects', id))
    return true
  }

  function saveIdea(idea: Idea): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, ideas: replace(data.legacy.ideas, idea) } }))
    remote((client, userId) => saveIdeaRow(client, idea, userId))
    return true
  }

  function deleteIdea(id: string): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, ideas: data.legacy.ideas.filter((item) => item.id !== id) } }))
    remote((client) => deleteRow(client, 'ideas', id))
    return true
  }

  function completeReview(item: LearningItem): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, learning: data.legacy.learning.map((row) => row.id === item.id ? item : row) } }))
    remote((client, userId) => upsertLearning(client, item, userId))
    return true
  }

  function captureConcept(item: LearningItem): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, learning: replace(data.legacy.learning, item) } }))
    remote((client, userId) => upsertLearning(client, item, userId))
    return true
  }

  function deleteLearning(id: string): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, legacy: { ...data.legacy, learning: data.legacy.learning.filter((item) => item.id !== id) } }))
    remote((client) => deleteRow(client, 'learning_items', id))
    return true
  }

  function saveSettings(next: Settings): boolean {
    if (!canMutate()) return false
    setSettings(next)
    if (mode === 'demo') writeStoredSettings(next)
    remote((client) => saveRemoteSettings(client, next))
    return true
  }

  return {
    saveLog, saveApplication, deleteApplication, savePerson, deletePerson,
    saveProject, deleteProject, saveIdea, deleteIdea, completeReview,
    captureConcept, deleteLearning, saveSettings,
  }
}

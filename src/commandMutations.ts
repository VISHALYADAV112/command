import type { Session } from '@supabase/supabase-js'
import type { CommandData, DailyLog, Idea, JobApplication, LearningItem, Person, Project, Settings } from './types'
import type { CommandMode } from './useCommandData'
import type { RemoteSync } from './useRemoteSync'
import { getSupabase } from './lib/supabase'
import {
  deleteRow, saveIdeaRow, savePersonRow, saveProjectRow, saveRemoteSettings,
  upsertApplicationRow, upsertLearning, upsertLog,
} from './lib/api'
import {
  applicationDeadlineEvent, createCalendarEvent, deleteCalendarEvent,
  projectDeadlineEvent, type DeadlineEventPayload,
} from './lib/calendar'
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

  function unlinkDeadline(entityType: 'project_deadline' | 'application_deadline', entityId: string) {
    if (mode !== 'live' || !session) return
    void deleteCalendarEvent(session, { entity_type: entityType, entity_id: entityId })
      .catch((error: unknown) => sync.fail(error, 'Calendar cleanup failed.'))
  }

  function resyncDeadline(payload: DeadlineEventPayload) {
    if (mode !== 'live' || !session) return
    void createCalendarEvent(session, { ...payload, update_only: true })
      .catch((error: unknown) => sync.fail(error, 'Calendar resync failed.'))
  }

  function saveLog(log: DailyLog): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, logs: [...data.logs.filter((item) => item.day !== log.day), log] }))
    remote((client, userId) => upsertLog(client, log, userId))
    return true
  }

  function saveApplication(app: JobApplication): boolean {
    if (!canMutate()) return false
    update((data) => {
      const previous = data.applications.find((item) => item.id === app.id)
      if (previous?.windowClosesOn && !app.windowClosesOn) unlinkDeadline('application_deadline', app.id)
      else if (previous?.windowClosesOn && app.windowClosesOn !== previous.windowClosesOn) resyncDeadline(applicationDeadlineEvent(app))
      return { ...data, applications: replace(data.applications, app) }
    })
    remote((client, userId) => upsertApplicationRow(client, app, userId))
    return true
  }

  function deleteApplication(id: string): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, applications: data.applications.filter((item) => item.id !== id) }))
    unlinkDeadline('application_deadline', id)
    remote((client) => deleteRow(client, 'job_applications', id))
    return true
  }

  function savePerson(person: Person): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, people: replace(data.people, person) }))
    remote((client, userId) => savePersonRow(client, person, userId))
    return true
  }

  function deletePerson(id: string): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, people: data.people.filter((item) => item.id !== id) }))
    remote((client) => deleteRow(client, 'people', id))
    return true
  }

  function saveProject(project: Project): boolean {
    if (!canMutate()) return false
    update((data) => {
      const previous = data.projects.find((item) => item.id === project.id)
      if (previous?.deadlineOn && !project.deadlineOn) unlinkDeadline('project_deadline', project.id)
      else if (previous?.deadlineOn && project.deadlineOn !== previous.deadlineOn) resyncDeadline(projectDeadlineEvent(project))
      return { ...data, projects: replace(data.projects, project) }
    })
    remote((client, userId) => saveProjectRow(client, project, userId))
    return true
  }

  function deleteProject(id: string): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, projects: data.projects.filter((item) => item.id !== id) }))
    unlinkDeadline('project_deadline', id)
    remote((client) => deleteRow(client, 'projects', id))
    return true
  }

  function saveIdea(idea: Idea): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, ideas: replace(data.ideas, idea) }))
    remote((client, userId) => saveIdeaRow(client, idea, userId))
    return true
  }

  function deleteIdea(id: string): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, ideas: data.ideas.filter((item) => item.id !== id) }))
    remote((client) => deleteRow(client, 'ideas', id))
    return true
  }

  function completeReview(item: LearningItem): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, learning: data.learning.map((row) => row.id === item.id ? item : row) }))
    remote((client, userId) => upsertLearning(client, item, userId))
    return true
  }

  function captureConcept(item: LearningItem): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, learning: replace(data.learning, item) }))
    remote((client, userId) => upsertLearning(client, item, userId))
    return true
  }

  function deleteLearning(id: string): boolean {
    if (!canMutate()) return false
    update((data) => ({ ...data, learning: data.learning.filter((item) => item.id !== id) }))
    remote((client) => deleteRow(client, 'learning_items', id))
    return true
  }

  function saveSettings(next: Settings): boolean {
    if (!canMutate()) return false
    setSettings(next)
    writeStoredSettings(next)
    remote((client) => saveRemoteSettings(client, next))
    return true
  }

  return {
    saveLog, saveApplication, deleteApplication, savePerson, deletePerson,
    saveProject, deleteProject, saveIdea, deleteIdea, completeReview,
    captureConcept, deleteLearning, saveSettings,
  }
}

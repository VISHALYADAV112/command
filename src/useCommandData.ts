import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createDemoData } from './data'
import type { CommandData, DailyLog, Idea, JobApplication, LearningItem, Person, Project, Settings } from './types'
import { getSupabase } from './lib/supabase'
import { isSupabaseConfigured } from './lib/config'
import { onAuthStateChange, signOut as doSignOut, getSession } from './lib/auth'
import {
  deleteRow, loadRemoteData, loadRemoteSettings, saveIdeaRow, savePersonRow, saveProjectRow,
  saveRemoteSettings, upsertApplicationRow, upsertLearning, upsertLog,
} from './lib/api'
import { settings as defaultSettings } from './domain'

const DATA_KEY = 'command.prototype.v1'
const SETTINGS_KEY = 'command.prototype.settings.v1'

function readDemoData(): CommandData {
  try {
    const stored = localStorage.getItem(DATA_KEY)
    return stored ? (JSON.parse(stored) as CommandData) : createDemoData()
  } catch {
    return createDemoData()
  }
}

function writeDemoData(data: CommandData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
  } catch {
    /* prototype cache only */
  }
}

function readStoredSettings(): Settings | null {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    return stored ? (JSON.parse(stored) as Settings) : null
  } catch {
    return null
  }
}

export type CommandMode = 'loading' | 'configuring' | 'demo' | 'live'

export interface UseCommandDataResult {
  data: CommandData | null
  settings: Settings
  mode: CommandMode
  session: Session | null
  ready: boolean
  saveLog: (log: DailyLog) => void
  saveApplication: (app: JobApplication) => void
  deleteApplication: (id: string) => void
  savePerson: (person: Person) => void
  deletePerson: (id: string) => void
  saveProject: (project: Project) => void
  deleteProject: (id: string) => void
  saveIdea: (idea: Idea) => void
  deleteIdea: (id: string) => void
  completeReview: (item: LearningItem) => void
  captureConcept: (item: LearningItem) => void
  saveSettings: (next: Settings) => void
  signOut: () => void
}

export function useCommandData(): UseCommandDataResult {
  const [data, setDataState] = useState<CommandData | null>(null)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [mode, setMode] = useState<CommandMode>('loading')
  const [session, setSession] = useState<Session | null>(null)

  function boot(): void {
    const client = getSupabase()
    if (!client || !isSupabaseConfigured) {
      setDataState(readDemoData())
      setSettings(readStoredSettings() ?? defaultSettings)
      setMode('demo')
      return
    }
    setMode('loading')
    getSession().then((found) => {
      if (!found) {
        setMode('configuring')
        return
      }
      setSession(found)
      Promise.all([loadRemoteData(client), loadRemoteSettings(client)])
        .then(([remoteData, remoteSettings]) => {
          setDataState(remoteData)
          setSettings(remoteSettings)
          setMode('live')
        })
        .catch(() => setMode('configuring'))
    })
  }

  useEffect(() => {
    boot()
    return onAuthStateChange((next) => {
      if (next) setSession(next)
      else boot()
    })
    // run once on mount
  }, [])

  useEffect(() => {
    if (mode === 'demo' && data) writeDemoData(data)
  }, [data, mode])

  function update(fn: (current: CommandData) => CommandData): CommandData | null {
    const next = data ? fn(data) : null
    if (next) setDataState(next)
    return next
  }

  function remote(action: (client: NonNullable<ReturnType<typeof getSupabase>>, userId: string) => Promise<unknown>): void {
    if (mode === 'live' && session?.user?.id) {
      const client = getSupabase()
      const userId = session.user.id
      if (client) void action(client, userId).catch((error) => console.error('sync failed', error))
    }
  }

  function replace<T extends { id: string }>(list: T[], item: T): T[] {
    return list.some((existing) => existing.id === item.id)
      ? list.map((existing) => existing.id === item.id ? item : existing)
      : [item, ...list]
  }

  function saveLog(log: DailyLog): void {
    update((current) => ({ ...current, logs: [...current.logs.filter((item) => item.day !== log.day), log] }))
    remote((client, userId) => upsertLog(client, log, userId))
  }

  function saveApplication(app: JobApplication): void {
    update((current) => ({ ...current, applications: replace(current.applications, app) }))
    remote((client, userId) => upsertApplicationRow(client, app, userId))
  }

  function deleteApplication(id: string): void {
    update((current) => ({ ...current, applications: current.applications.filter((item) => item.id !== id) }))
    remote((client) => deleteRow(client, 'job_applications', id))
  }

  function savePerson(person: Person): void {
    update((current) => ({ ...current, people: replace(current.people, person) }))
    remote((client, userId) => savePersonRow(client, person, userId))
  }

  function deletePerson(id: string): void {
    update((current) => ({ ...current, people: current.people.filter((item) => item.id !== id) }))
    remote((client) => deleteRow(client, 'people', id))
  }

  function saveProject(project: Project): void {
    update((current) => ({ ...current, projects: replace(current.projects, project) }))
    remote((client, userId) => saveProjectRow(client, project, userId))
  }

  function deleteProject(id: string): void {
    update((current) => ({ ...current, projects: current.projects.filter((item) => item.id !== id) }))
    remote((client) => deleteRow(client, 'projects', id))
  }

  function saveIdea(idea: Idea): void {
    update((current) => ({ ...current, ideas: replace(current.ideas, idea) }))
    remote((client, userId) => saveIdeaRow(client, idea, userId))
  }

  function deleteIdea(id: string): void {
    update((current) => ({ ...current, ideas: current.ideas.filter((item) => item.id !== id) }))
    remote((client) => deleteRow(client, 'ideas', id))
  }

  function completeReview(item: LearningItem): void {
    update((current) => ({
      ...current,
      learning: current.learning.map((existing) => existing.id === item.id ? item : existing),
    }))
    remote((client) => upsertLearning(client, item))
  }

  function captureConcept(item: LearningItem): void {
    update((current) => ({ ...current, learning: replace(current.learning, item) }))
    remote((client) => upsertLearning(client, item))
  }

  function saveSettings(next: Settings): void {
    setSettings(next)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    } catch {
      /* prototype */
    }
    if (mode === 'live' && session) void saveRemoteSettings(getSupabase()!, next)
  }

  function signOutFromCommand(): void {
    if (mode === 'demo') {
      try {
        localStorage.removeItem(DATA_KEY)
        localStorage.removeItem(SETTINGS_KEY)
      } catch {
        /* prototype */
      }
    } else {
      const client = getSupabase()
      if (client) void doSignOut(client)
    }
    boot()
  }

  return {
    data,
    settings,
    mode,
    session,
    ready: mode !== 'loading' && data !== null,
    saveLog,
    saveApplication,
    deleteApplication,
    savePerson,
    deletePerson,
    saveProject,
    deleteProject,
    saveIdea,
    deleteIdea,
    completeReview,
    captureConcept,
    saveSettings,
    signOut: signOutFromCommand,
  }
}

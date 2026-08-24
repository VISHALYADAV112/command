import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createDemoData } from './data'
import type { CommandData, DailyLog, JobApplication, LearningItem, Settings } from './types'
import { getSupabase } from './lib/supabase'
import { isSupabaseConfigured } from './lib/config'
import { onAuthStateChange, signOut as doSignOut, getSession } from './lib/auth'
import {
  insertApplication, loadRemoteData, loadRemoteSettings, saveRemoteSettings, updateLearning, upsertLog,
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
  completeReview: (item: LearningItem) => void
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

  function saveLog(log: DailyLog): void {
    update((current) => ({ ...current, logs: [...current.logs.filter((item) => item.day !== log.day), log] }))
    if (mode === 'live' && session) void upsertLog(getSupabase()!, log)
  }

  function saveApplication(app: JobApplication): void {
    update((current) => ({ ...current, applications: [app, ...current.applications] }))
    if (mode === 'live' && session) void insertApplication(getSupabase()!, app)
  }

  function completeReview(item: LearningItem): void {
    update((current) => ({
      ...current,
      learning: current.learning.map((existing) => existing.id === item.id ? item : existing),
    }))
    if (mode === 'live' && session) void updateLearning(getSupabase()!, item)
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
    completeReview,
    saveSettings,
    signOut: signOutFromCommand,
  }
}
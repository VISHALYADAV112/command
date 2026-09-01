import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { CommandData, Commitment, DailyLog, Entity, EntityType, Idea, JobApplication, LearningItem, Person, Project, Settings } from './types'
import { getSupabase } from './lib/supabase'
import { isSupabaseConfigured } from './lib/config'
import { onAuthStateChange, signOut as doSignOut, getSession } from './lib/auth'
import { loadRemoteData, loadRemoteSettings, loadV3BrowsePage, loadV3DuePage, type RemoteDueItem, type RemotePage } from './lib/api'
import { settings as defaultSettings } from './domain'
import {
  clearDemoCache, readDemoData, readLiveCache, readStoredSettings,
  writeDemoData, writeLiveCache,
} from './lib/localCache'
import { useRemoteSync } from './useRemoteSync'
import { createCommandMutations } from './commandMutations'
import { createV3Mutations } from './v3Mutations'

export type SyncState = 'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'stale'

export type CommandMode = 'loading' | 'configuring' | 'demo' | 'live'

export interface UseCommandDataResult {
  data: CommandData | null
  settings: Settings
  mode: CommandMode
  session: Session | null
  ready: boolean
  syncState: SyncState
  syncMessage: string
  online: boolean
  retrySync: () => void
  loadDuePage: (day: string, window: 'overdue' | 'today' | 'week' | 'all', typeKey: string | null, offset: number) => Promise<RemotePage<RemoteDueItem>>
  loadBrowsePage: (type: EntityType, offset: number) => Promise<RemotePage<Entity>>
  saveLog: (log: DailyLog) => boolean
  saveApplication: (app: JobApplication) => boolean
  deleteApplication: (id: string) => boolean
  savePerson: (person: Person) => boolean
  deletePerson: (id: string) => boolean
  saveProject: (project: Project) => boolean
  deleteProject: (id: string) => boolean
  saveIdea: (idea: Idea) => boolean
  deleteIdea: (id: string) => boolean
  completeReview: (item: LearningItem) => boolean
  captureConcept: (item: LearningItem) => boolean
  deleteLearning: (id: string) => boolean
  saveEntity: (entity: Entity) => boolean
  saveCommitment: (commitment: Commitment) => boolean
  saveCapture: (entity: Entity, commitment: Commitment | null) => boolean
  archiveEntity: (entity: Entity) => boolean
  restoreEntity: (entity: Entity) => boolean
  saveSettings: (next: Settings) => boolean
  signOut: () => void
}

export function useCommandData(): UseCommandDataResult {
  const [data, setDataState] = useState<CommandData | null>(null)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [mode, setMode] = useState<CommandMode>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const dataRef = useRef<CommandData | null>(null)
  const sync = useRemoteSync({ mode, dataRef, reload: boot })

  function boot(): void {
    const client = getSupabase()
    if (!client || !isSupabaseConfigured) {
      const demo = readDemoData()
      setDataState(demo)
      dataRef.current = demo
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
          dataRef.current = remoteData
          writeLiveCache(remoteData)
          setSettings(remoteSettings)
          setMode('live')
          sync.mark('idle')
        })
        .catch((error: unknown) => {
          const cached = readLiveCache()
          if (cached) {
            setDataState(cached)
            dataRef.current = cached
            setMode('live')
            sync.mark('stale', 'Showing cached data. Reconnect to refresh.')
          } else {
            sync.fail(error, 'Could not load Command data.')
            setMode('loading')
          }
        })
    }).catch((error: unknown) => {
      const cached = readLiveCache()
      if (cached) {
        setDataState(cached)
        dataRef.current = cached
        setMode('live')
        sync.mark('stale', 'Session check failed. Showing cached data.')
      } else {
        sync.fail(error, 'Could not check your session.')
        setMode('loading')
      }
    })
  }

  useEffect(() => {
    boot()
    const stopAuth = onAuthStateChange((next) => {
      if (next) setSession(next)
      else boot()
    })
    return stopAuth
    // run once on mount
  }, [])

  useEffect(() => {
    if (mode === 'demo' && data) writeDemoData(data)
  }, [data, mode])

  const mutations = createCommandMutations({
    mode, session, dataRef, setData: setDataState, setSettings, sync,
  })
  const v3Mutations = createV3Mutations({ mode, session, dataRef, setData: setDataState, sync })

  const loadDuePage = useCallback(async (
    day: string,
    window: 'overdue' | 'today' | 'week' | 'all',
    typeKey: string | null,
    offset: number,
  ): Promise<RemotePage<RemoteDueItem>> => {
    const client = getSupabase()
    if (mode !== 'live' || !client) return { items: [], hasMore: false }
    return loadV3DuePage(client, day, window, typeKey, offset)
  }, [mode])

  const loadBrowsePage = useCallback(async (type: EntityType, offset: number): Promise<RemotePage<Entity>> => {
    const client = getSupabase()
    if (mode !== 'live' || !client) return { items: [], hasMore: false }
    return loadV3BrowsePage(client, type, offset)
  }, [mode])

  function signOutFromCommand(): void {
    if (mode === 'demo') {
      clearDemoCache()
    } else {
      const client = getSupabase()
      if (client) {
        void doSignOut(client).then(() => {
          setSession(null)
          boot()
        }).catch((error: unknown) => sync.fail(error, 'Sign-out failed. Try again.'))
        return
      }
    }
    boot()
  }

  return {
    data,
    settings,
    mode,
    session,
    ready: mode !== 'loading' && data !== null,
    syncState: sync.state,
    syncMessage: sync.message,
    online: sync.online,
    retrySync: sync.retry,
    loadDuePage,
    loadBrowsePage,
    ...mutations,
    ...v3Mutations,
    signOut: signOutFromCommand,
  }
}

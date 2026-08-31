import { useEffect, useRef, useState } from 'react'
import type { CommandData } from './types'
import type { CommandMode, SyncState } from './useCommandData'
import { writeLiveCache } from './lib/localCache'

interface Options {
  mode: CommandMode
  dataRef: { current: CommandData | null }
  reload: () => void
}

export function useRemoteSync({ mode, dataRef, reload }: Options) {
  const [state, setState] = useState<SyncState>('idle')
  const [message, setMessage] = useState('')
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const failed = useRef<Array<() => Promise<unknown>>>([])
  const pending = useRef(0)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reloadRef = useRef(reload)
  reloadRef.current = reload

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
  }, [])

  useEffect(() => {
    function becameOnline() {
      setOnline(true)
      if (state === 'offline') retry()
      else if (state === 'stale') reloadRef.current()
    }
    function becameOffline() {
      setOnline(false)
      if (mode === 'live') mark('offline', 'Offline. Reconnect before saving.')
    }
    window.addEventListener('online', becameOnline)
    window.addEventListener('offline', becameOffline)
    return () => {
      window.removeEventListener('online', becameOnline)
      window.removeEventListener('offline', becameOffline)
    }
  }, [mode, state])

  useEffect(() => {
    function refreshWhenVisible() {
      if (
        mode === 'live'
        && document.visibilityState === 'visible'
        && navigator.onLine
        && pending.current === 0
        && failed.current.length === 0
      ) {
        reloadRef.current()
      }
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible)
  }, [mode])

  function mark(next: SyncState, nextMessage = '') {
    setState(next)
    setMessage(nextMessage)
  }

  function fail(error: unknown, fallback: string) {
    mark('error', error instanceof Error ? error.message : fallback)
  }

  function canWrite(): boolean {
    if (mode !== 'live' || navigator.onLine) return true
    mark('offline', 'Offline. Your form is retained; reconnect before saving.')
    return false
  }

  function run(task: () => Promise<unknown>): void {
    pending.current += 1
    if (savedTimer.current) clearTimeout(savedTimer.current)
    mark('saving', 'Saving…')
    void task().then(() => finish()).catch((error: unknown) => {
      pending.current -= 1
      if (!failed.current.includes(task)) failed.current.push(task)
      fail(error, 'Save failed. Retry when connected.')
    })
  }

  function finish() {
    pending.current -= 1
    if (pending.current > 0) return
    if (failed.current.length > 0) {
      mark('error', 'Some changes failed to save. Retry when connected.')
      return
    }
    if (dataRef.current) writeLiveCache(dataRef.current)
    mark('saved', 'Saved')
    savedTimer.current = setTimeout(() => {
      if (pending.current === 0 && failed.current.length === 0) mark('idle')
    }, 2000)
  }

  function retry(): void {
    if (!navigator.onLine) {
      mark('offline', 'Still offline. Reconnect before retrying.')
      return
    }
    if (failed.current.length > 0) {
      const tasks = failed.current
      failed.current = []
      tasks.forEach(run)
    } else if (state === 'stale' || state === 'error') reloadRef.current()
  }

  return { state, message, online, mark, fail, canWrite, run, retry }
}

export type RemoteSync = ReturnType<typeof useRemoteSync>

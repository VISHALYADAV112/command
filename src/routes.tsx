import { useEffect, useState } from 'react'
import type { DueWindow } from './v3Selectors'

export type AppRoute =
  | { kind: 'today' }
  | { kind: 'due'; window: DueWindow; typeKey: string | null }
  | { kind: 'browse'; typeKey: string | null }
  | { kind: 'item'; id: string }

const legacyTypes: Record<string, string> = {
  jobs: 'application',
  people: 'person',
  projects: 'project',
  ideas: 'note',
  learning: 'learning',
}

function readRoute(): AppRoute {
  const [path = '', query = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  const params = new URLSearchParams(query)
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'due') {
    const windowValue = params.get('window')
    const window: DueWindow = windowValue === 'overdue' || windowValue === 'today' || windowValue === 'week' ? windowValue : 'all'
    return { kind: 'due', window, typeKey: params.get('type') }
  }
  if (parts[0] === 't') return { kind: 'browse', typeKey: parts[1] ?? null }
  if (parts[0] === 'i' && parts[1]) return { kind: 'item', id: parts[1] }
  if (legacyTypes[parts[0]]) return { kind: 'browse', typeKey: legacyTypes[parts[0]] }
  return { kind: 'today' }
}

function hashFor(route: AppRoute): string {
  if (route.kind === 'today') return '#/'
  if (route.kind === 'item') return `#/i/${route.id}`
  if (route.kind === 'browse') return route.typeKey ? `#/t/${route.typeKey}` : '#/t/application'
  const params = new URLSearchParams()
  if (route.window !== 'all') params.set('window', route.window)
  if (route.typeKey) params.set('type', route.typeKey)
  const suffix = params.toString()
  return `#/due${suffix ? `?${suffix}` : ''}`
}

export function useHashRoute(): [AppRoute, (route: AppRoute) => void] {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    function onHash() { setRoute(readRoute()) }
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  function navigate(next: AppRoute) {
    window.location.hash = hashFor(next)
    setRoute(next)
  }
  return [route, navigate]
}

export function ViewNav({ route, navigate, onCapture, onMore }: {
  route: AppRoute
  navigate: (route: AppRoute) => void
  onCapture: () => void
  onMore: () => void
}) {
  const active = route.kind === 'item' ? 'browse' : route.kind
  return (
    <nav className="view-nav" aria-label="Sections">
      <button type="button" className={active === 'today' ? 'is-active' : ''} aria-current={active === 'today' ? 'page' : undefined} onClick={() => navigate({ kind: 'today' })}>Today</button>
      <button type="button" className={active === 'due' ? 'is-active' : ''} aria-current={active === 'due' ? 'page' : undefined} onClick={() => navigate({ kind: 'due', window: 'all', typeKey: null })}>Due</button>
      <button type="button" onClick={onCapture}>Capture</button>
      <button type="button" className={active === 'browse' ? 'is-active' : ''} aria-current={active === 'browse' ? 'page' : undefined} onClick={() => navigate({ kind: 'browse', typeKey: 'application' })}>Browse</button>
      <button type="button" onClick={onMore}>More</button>
    </nav>
  )
}

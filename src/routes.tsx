import { useEffect, useState } from 'react'
import type { DueWindow } from './v3Selectors'

export type AppRoute =
  | { kind: 'today' }
  | { kind: 'due'; window: DueWindow; typeKey: string | null }
  | { kind: 'calendar' }
  | { kind: 'browse'; typeKey: string | null }
  | { kind: 'item'; id: string }
  | { kind: 'week' }
  | { kind: 'run' }
  | { kind: 'settings' }

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
  if (parts[0] === 'calendar') return { kind: 'calendar' }
  if (parts[0] === 't') return { kind: 'browse', typeKey: parts[1] ?? null }
  if (parts[0] === 'i' && parts[1]) return { kind: 'item', id: parts[1] }
  if (parts[0] === 'week') return { kind: 'week' }
  if (parts[0] === 'run') return { kind: 'run' }
  if (parts[0] === 'settings') return { kind: 'settings' }
  if (legacyTypes[parts[0]]) return { kind: 'browse', typeKey: legacyTypes[parts[0]] }
  return { kind: 'today' }
}

function hashFor(route: AppRoute): string {
  if (route.kind === 'today') return '#/'
  if (route.kind === 'item') return `#/i/${route.id}`
  if (route.kind === 'calendar') return '#/calendar'
  if (route.kind === 'week') return '#/week'
  if (route.kind === 'run') return '#/run'
  if (route.kind === 'settings') return '#/settings'
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

const glyphs = {
  today: '𑀓', due: '𑀥', calendar: '𑀘', browse: '𑀧',
  item: '𑀫', week: '𑀯', run: '𑀭', settings: '𑀲',
}

export function sealGlyph(route: AppRoute): string {
  return glyphs[route.kind] ?? glyphs.today
}

export function ViewNav({ route, navigate, onCapture, onLog, onAgent, pendingAgents, dueBadge }: {
  route: AppRoute
  navigate: (route: AppRoute) => void
  onCapture: () => void
  onLog: () => void
  onAgent: () => void
  pendingAgents: number
  dueBadge: number
}) {
  const active = route.kind === 'item' ? 'browse' : route.kind
  return (
    <div className="gazette-nav-row">
      <nav className="view-nav" aria-label="Sections">
        <NavButton label="Today" mobileLabel="Today" glyph={glyphs.today} active={active === 'today'} onClick={() => navigate({ kind: 'today' })} />
        <NavButton label="Due queue" mobileLabel="Due" glyph={glyphs.due} active={active === 'due'} badge={dueBadge} onClick={() => navigate({ kind: 'due', window: 'all', typeKey: null })} />
        <NavButton className="desktop-section" label="Calendar" glyph={glyphs.calendar} active={active === 'calendar'} onClick={() => navigate({ kind: 'calendar' })} />
        <button className="mobile-capture" type="button" onClick={onCapture}><span aria-hidden="true">＋</span>Capture</button>
        <NavButton label="Directory" mobileLabel="Browse" glyph={glyphs.browse} active={active === 'browse'} onClick={() => navigate({ kind: 'browse', typeKey: 'application' })} />
        <NavButton className="desktop-section" label="Week review" glyph={glyphs.week} active={active === 'week'} onClick={() => navigate({ kind: 'week' })} />
        <NavButton className="desktop-section" label="Run" glyph={glyphs.run} active={active === 'run'} onClick={() => navigate({ kind: 'run' })} />
        <NavButton className="desktop-section" label="Prefs" glyph={glyphs.settings} active={active === 'settings'} onClick={() => navigate({ kind: 'settings' })} />
        <button className="mobile-more" type="button" onClick={() => navigate({ kind: 'settings' })}><span aria-hidden="true">𑀲</span>More</button>
      </nav>
      <div className="gazette-actions">
        {pendingAgents > 0 && <button className="wire-button" type="button" onClick={onAgent}>MCP wire {pendingAgents}</button>}
        <button className="log-button" type="button" onClick={onLog}>File daily log</button>
        <button className="capture-button" type="button" onClick={onCapture}>+ Capture</button>
      </div>
    </div>
  )
}

function NavButton({ label, mobileLabel, glyph, active, badge, className = '', onClick }: {
  label: string
  mobileLabel?: string
  glyph: string
  active: boolean
  badge?: number
  className?: string
  onClick: () => void
}) {
  return <button type="button" className={`${className}${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} aria-label={mobileLabel ?? undefined} onClick={onClick}>
    <span className="nav-glyph" aria-hidden="true">{glyph}</span><span className="nav-label"><span className="desktop-label">{label}</span>{mobileLabel && <span className="mobile-label">{mobileLabel}</span>}</span>{badge ? <small>{badge} due</small> : null}
  </button>
}

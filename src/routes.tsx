import { useEffect, useState } from 'react'

export type AppRoute = '' | 'jobs' | 'people' | 'projects' | 'ideas' | 'learning'

const routes: Array<{ path: AppRoute; label: string }> = [
  { path: '', label: 'Today' },
  { path: 'jobs', label: 'Jobs' },
  { path: 'people', label: 'People' },
  { path: 'projects', label: 'Projects' },
  { path: 'ideas', label: 'Ideas' },
  { path: 'learning', label: 'Learning' },
]

function readRoute(): AppRoute {
  const found = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return routes.some((route) => route.path === found) ? found as AppRoute : ''
}

export function useHashRoute(): [AppRoute, (route: AppRoute) => void] {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    function onHash() { setRoute(readRoute()) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  function navigate(next: AppRoute) {
    window.location.hash = next ? `#/${next}` : '#/'
    setRoute(next)
  }
  return [route, navigate]
}

export function ViewNav({ route, navigate }: { route: AppRoute; navigate: (route: AppRoute) => void }) {
  return (
    <nav className="view-nav" aria-label="Sections">
      {routes.map((item) => (
        <button
          key={item.path}
          type="button"
          className={route === item.path ? 'is-active' : ''}
          onClick={() => navigate(item.path)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

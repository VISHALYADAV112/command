import { dateKey } from './domain'
import { Icon } from './ui'

export function AppHeader({ today, live, theme, onOpenSettings, onToggleTheme }: {
  today: Date
  live: boolean
  theme: 'day' | 'night'
  onOpenSettings: () => void
  onToggleTheme: () => void
}) {
  return (
    <header className="app-header">
      <a className="wordmark" href="#/" aria-label="Command dashboard home">
        <img src="./assets/command-mark.svg" alt="" />
        <span>Command</span>
      </a>
      <div className="header-meta">
        <span className={live ? 'live-label' : 'prototype-label'}>{live ? 'Live' : 'Local prototype'}</span>
        <time dateTime={dateKey(today)}>
          {today.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
          })}
        </time>
        <button
          className="header-action theme-toggle"
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'night' ? 'day' : 'night'} edition`}
          title={`Switch to ${theme === 'night' ? 'day' : 'night'} edition`}
        >
          <span aria-hidden="true">{theme === 'night' ? '☼' : '◐'}</span>
        </button>
        <button className="header-action" type="button" onClick={onOpenSettings} aria-label="Open settings">
          <Icon name="settings" />
        </button>
      </div>
    </header>
  )
}

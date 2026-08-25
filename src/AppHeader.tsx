import { dateKey } from './domain'
import { Icon } from './ui'

export function AppHeader({ today, live, onOpenSettings }: {
  today: Date
  live: boolean
  onOpenSettings: () => void
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
        <button className="header-action" type="button" onClick={onOpenSettings} aria-label="Open settings">
          <Icon name="settings" />
        </button>
      </div>
    </header>
  )
}

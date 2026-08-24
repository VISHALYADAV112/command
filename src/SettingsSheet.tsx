import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { practices } from './domain'
import type { Settings } from './types'
import type { CommandMode } from './useCommandData'
import {
  disconnectCalendar, getCalendarStatus, startCalendarConnect, type CalendarStatus,
} from './lib/calendar'

export function SettingsSheet({
  settings,
  session,
  mode,
  onSaveSettings,
  onSignOut,
  onClose,
  onExport,
}: {
  settings: Settings
  session: Session | null
  mode: CommandMode
  onSaveSettings: (next: Settings) => void
  onSignOut: () => void
  onClose: () => void
  onExport: (kind: 'json' | 'csv', table?: string) => void
}) {
  const [draft, setDraft] = useState(settings)
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null)
  const [calendarError, setCalendarError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  useEffect(() => {
    if (mode !== 'live' || !session) return
    getCalendarStatus(session).then(setCalendar).catch((error: Error) => setCalendarError(error.message))
  }, [mode, session])

  function save() {
    onSaveSettings(draft)
  }

  function connect() {
    if (!session) return
    setCalendarError(null)
    void startCalendarConnect(session)
  }

  function disconnect() {
    if (!session) return
    setCalendarError(null)
    void disconnectCalendar(session).then(() => setCalendar({ connected: false, account: null }))
  }

  function setField(group: 'floors' | 'budgets', key: keyof Settings['floors'], value: number) {
    setDraft((current) => ({ ...current, [group]: { ...current[group], [key]: Math.max(0, Math.round(value)) } }))
  }

  function hours(minutes: number): string {
    const value = minutes / 60
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }

  const budgetNote = practices.map(({ key, label }) => `${label} ${hours(draft.budgets[key])}h`).join(' · ')

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="sheet-header">
          <div><span className="eyebrow">Settings</span><h2 id="settings-title">Targets &amp; data</h2></div>
          <button className="icon-button sheet-close" type="button" onClick={onClose} aria-label="Close"><span className="icon-close">×</span></button>
        </header>

        <div className="settings-group">
          <h3>Daily floors and weekly budgets</h3>
          <p className="settings-hint">Floors are the minimums. Budgets measure the week.</p>
          <div className="settings-grid">
            {practices.map(({ key, label }) => (
              <div className="settings-row" key={key}>
                <span className="time-label">{label}</span>
                <label>Floor<input type="number" min="0" step="5" value={draft.floors[key]} onChange={(e) => setField('floors', key, Number(e.target.value))} /></label>
                <label>Budget<input type="number" min="0" step="15" value={draft.budgets[key]} onChange={(e) => setField('budgets', key, Number(e.target.value))} /></label>
              </div>
            ))}
          </div>
          <div className="form-actions"><button className="primary-button" type="button" onClick={save}><span>Save targets</span></button></div>
        </div>

        <div className="settings-group">
          <h3>Google Calendar</h3>
          {mode === 'live' ? (
            <>
              {calendarError && <p className="settings-error">{calendarError}</p>}
              <p className="settings-status">
                {calendar ? `Connected · ${calendar.account?.status}` : 'Checking connection…'}
              </p>
              <div className="settings-actions">
                {!calendar?.connected ? (
                  <button className="secondary-button" type="button" onClick={connect}>Connect Calendar</button>
                ) : (
                  <button className="secondary-button" type="button" onClick={disconnect}>Disconnect</button>
                )}
              </div>
            </>
          ) : (
            <p className="settings-status">Available after signing in.</p>
          )}
        </div>

        <div className="settings-group">
          <h3>Export</h3>
          <div className="settings-actions">
            <button className="secondary-button" type="button" onClick={() => onExport('json')}>Export JSON</button>
            {(['logs', 'applications', 'people', 'projects', 'learning'] as const).map((kind) => (
              <button className="secondary-button" type="button" key={kind} onClick={() => onExport('csv', kind)}>CSV · {kind}</button>
            ))}
          </div>
        </div>

        <div className="settings-group">
          <h3>Account</h3>
          <p className="settings-status">{mode === 'live' ? `Signed in · ${session?.user?.email ?? ''}` : 'Local prototype — edits stay in this browser.'}</p>
          <div className="settings-actions">
            <button className="secondary-button" type="button" onClick={onSignOut}>{mode === 'live' ? 'Sign out' : 'Reset prototype data'}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
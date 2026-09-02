import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { dailyPractices } from './domain'
import { McpConnections } from './McpConnections'
import { TypeRegistrySettings } from './TypeRegistrySettings'
import type { EntityType, Settings } from './types'
import type { CommandMode } from './useCommandData'
import { ConfirmSheet, Sheet } from './ui'
import {
  disconnectCalendar, getCalendarStatus, startCalendarConnect, type CalendarStatus,
} from './lib/calendar'

export function SettingsSheet({
  settings,
  entityTypes,
  session,
  mode,
  onSaveSettings,
  onSaveEntityType,
  onSignOut,
  onClose,
  onOpenWeek,
  onOpenRun,
  onExport,
}: {
  settings: Settings
  entityTypes: EntityType[]
  session: Session | null
  mode: CommandMode
  onSaveSettings: (next: Settings) => boolean
  onSaveEntityType: (type: EntityType) => boolean
  onSignOut: () => void
  onClose: () => void
  onOpenWeek: () => void
  onOpenRun: () => void
  onExport: (kind: 'json' | 'csv', table?: string) => void
}) {
  const [draft, setDraft] = useState(settings)
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<'disconnect' | 'reset' | null>(null)

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
    void startCalendarConnect(session).catch((error: Error) => setCalendarError(error.message))
  }

  function disconnect() {
    if (!session) return
    setCalendarError(null)
    void disconnectCalendar(session)
      .then(() => setCalendar({ connected: false, account: null, last_synced_at: null }))
      .catch((error: Error) => setCalendarError(error.message))
  }

  function confirmAction() {
    if (confirmation === 'disconnect') disconnect()
    else if (confirmation === 'reset') onSignOut()
    setConfirmation(null)
  }

  function setField(group: 'floors' | 'budgets', key: keyof Settings['floors'], value: number) {
    setDraft((current) => ({ ...current, [group]: { ...current[group], [key]: Math.max(0, Math.round(value)) } }))
  }

  function setWeeklyTarget(key: keyof Settings['weeklyTargets'], value: number) {
    setDraft((current) => ({
      ...current,
      weeklyTargets: { ...current.weeklyTargets, [key]: Math.max(0, Math.round(value)) },
    }))
  }

  function hours(minutes: number): string {
    const value = minutes / 60
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }

  const budgetNote = dailyPractices.map(({ key, label }) => `${label} ${hours(draft.budgets[key])}h`).join(' · ')

  return (
    <>
    <Sheet title="Targets & data" eyebrow="Settings" onClose={onClose}>
        <div className="settings-group">
          <h3>Edition</h3>
          <p className="settings-hint">Choose the paper treatment that stays with this browser and account.</p>
          <div className="edition-switch" role="group" aria-label="Colour edition">
            {(['night', 'day'] as const).map((edition) => (
              <button
                className={draft.theme === edition ? 'is-selected' : ''}
                type="button"
                aria-pressed={draft.theme === edition}
                key={edition}
                onClick={() => setDraft((current) => ({ ...current, theme: edition }))}
              >
                {edition === 'night' ? 'Night edition' : 'Day edition'}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-group">
          <h3>Review</h3>
          <p className="settings-hint">Review this week’s execution or the longer monthly readiness signals.</p>
          <div className="settings-actions">
            <button className="secondary-button" type="button" onClick={onOpenWeek}>Open weekly review</button>
            <button className="secondary-button" type="button" onClick={onOpenRun}>Open monthly Run</button>
          </div>
        </div>

        <div className="settings-group">
          <h3>Three daily floors and weekly budgets</h3>
          <p className="settings-hint">Floors are the minimums. Job-hunt progress is tracked as weekly application and outreach outcomes.</p>
          <div className="settings-grid">
            {dailyPractices.map(({ key, label }) => (
              <div className="settings-row" key={key}>
                <span className="time-label">{label}</span>
                <label>Floor<input type="number" min="0" step="5" value={draft.floors[key]} onChange={(e) => setField('floors', key, Number(e.target.value))} /></label>
                <label>Budget<input type="number" min="0" step="15" value={draft.budgets[key]} onChange={(e) => setField('budgets', key, Number(e.target.value))} /></label>
              </div>
            ))}
          </div>
          <div className="settings-grid weekly-target-grid">
            <div className="settings-row"><span className="time-label">Job hunt</span><label>Applications<input type="number" min="0" step="1" value={draft.weeklyTargets.applications} onChange={(event) => setWeeklyTarget('applications', Number(event.target.value))} /></label><label>People contacted<input type="number" min="0" step="1" value={draft.weeklyTargets.peopleContacted} onChange={(event) => setWeeklyTarget('peopleContacted', Number(event.target.value))} /></label></div>
          </div>
          <p className="settings-hint">Week and historical status are always derived using the targets currently saved here; changing a target reinterprets prior summaries without changing their underlying events.</p>
          <div className="form-actions"><button className="primary-button" type="button" onClick={save}><span>Save targets</span></button></div>
        </div>

        <TypeRegistrySettings types={entityTypes} onSave={onSaveEntityType} />

        <McpConnections session={mode === 'live' ? session : null} />

        <div className="settings-group">
          <h3>Google Calendar</h3>
          {mode === 'live' ? (
            <>
              {calendarError && <p className="settings-error">{calendarError}</p>}
              <p className="settings-status">{calendar ? calendar.connected ? calendarStatusLabel(calendar) : 'Not connected' : 'Checking connection…'}</p>
              <div className="settings-actions">
                {!calendar?.connected ? (
                  <button className="secondary-button" type="button" onClick={connect}>Connect Calendar</button>
                ) : (
                  <button className="secondary-button" type="button" onClick={() => setConfirmation('disconnect')}>Disconnect</button>
                )}
              </div>
            </>
          ) : (
            <p className="settings-status">Available after signing in.</p>
          )}
        </div>

        <div className="settings-group">
          <h3>Export</h3>
          {mode === 'live' ? <div className="settings-actions">
              <button className="secondary-button" type="button" onClick={() => onExport('json')}>Export JSON</button>
              {entityTypes.map((type) => (
                <button className="secondary-button" type="button" key={type.id} onClick={() => onExport('csv', type.typeKey)}>CSV · {type.pluralName}</button>
              ))}
            </div> : <p className="settings-status">Exports are available after signing in.</p>}
        </div>

        <div className="settings-group">
          <h3>Account</h3>
          <p className="settings-status">{mode === 'live' ? `Signed in · ${session?.user?.email ?? ''}` : 'Local prototype — edits stay in this browser.'}</p>
          <div className="settings-actions">
            <button className="secondary-button" type="button" onClick={() => mode === 'live' ? onSignOut() : setConfirmation('reset')}>{mode === 'live' ? 'Sign out' : 'Reset prototype data'}</button>
          </div>
        </div>
    </Sheet>
    {confirmation && <ConfirmSheet
      title={confirmation === 'disconnect' ? 'Disconnect Google Calendar?' : 'Reset prototype data?'}
      detail={confirmation === 'disconnect' ? 'Command will revoke its Calendar access and forget all linked event records.' : 'All locally saved Command data and target settings will be removed from this browser.'}
      eyebrow="Confirm action"
      confirmLabel={confirmation === 'disconnect' ? 'Disconnect Calendar' : 'Reset data'}
      onClose={() => setConfirmation(null)}
      onConfirm={confirmAction}
    />}
    </>
  )
}

function calendarStatusLabel(calendar: CalendarStatus): string {
  if (!calendar.account) return 'Connected'
  const verified = calendar.account.last_verified_at
    ? new Date(calendar.account.last_verified_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
    : 'not verified yet'
  const synced = calendar.last_synced_at
    ? new Date(calendar.last_synced_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
    : 'no commitments exported yet'
  return `Connected · ${calendar.account.status} · verified ${verified} · last sync ${synced}`
}

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { dailyPractices } from './domain'
import { McpConnections } from './McpConnections'
import { TypeRegistrySettings } from './TypeRegistrySettings'
import type { EntityType, Settings } from './types'
import type { CommandMode } from './useCommandData'
import { ConfirmSheet, Sheet, ViewShell } from './ui'
import {
  disconnectCalendar, getCalendarStatus, startCalendarConnect, type CalendarStatus,
} from './lib/calendar'

const floorLabels: Record<string, string> = {
  node: 'Node.js engineering floor', dsa: 'DSA & algorithmic drills', math: 'Math theory & computation',
}
const floorDesks: Record<string, string> = { node: 'Systems', dsa: 'Algorithms', math: 'Theory' }

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
  onOpenCalendar,
  onExport,
  inline = false,
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
  onOpenCalendar?: () => void
  onExport: (kind: 'json' | 'csv', table?: string) => void
  inline?: boolean
}) {
  const [draft, setDraft] = useState(settings)
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<'disconnect' | 'reset' | null>(null)
  const [tab, setTab] = useState<'targets' | 'types' | 'integrations'>('targets')

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

  const targetRows = [
    ...dailyPractices.map(({ key, label }) => ({
      key: `floor-${key}`, label: floorLabels[key], hint: `${floorDesks[key]} desk · daily minimum`,
      value: draft.floors[key], step: 5, onChange: (value: number) => setField('floors', key, value),
    })),
    { key: 'applications', label: 'Weekly application budget', hint: 'Outreach · per week', value: draft.weeklyTargets.applications, step: 1, onChange: (value: number) => setWeeklyTarget('applications', value) },
    { key: 'people', label: 'New people contacted', hint: 'Outreach · per week', value: draft.weeklyTargets.peopleContacted, step: 1, onChange: (value: number) => setWeeklyTarget('peopleContacted', value) },
    ...dailyPractices.map(({ key, label }) => ({
      key: `budget-${key}`, label: `${label} weekly budget`, hint: `${floorDesks[key]} desk · minutes per week`,
      value: draft.budgets[key], step: 15, onChange: (value: number) => setField('budgets', key, value),
    })),
  ]

  const targets = <form className="prefs-form" onSubmit={(event) => { event.preventDefault(); save() }}>
    {targetRows.map((row) => <div className="prefs-row" key={row.key}>
      <div><div className="prefs-label">{row.label}</div><div className="prefs-hint">{row.hint}</div></div>
      <input type="number" min="0" step={row.step} aria-label={row.label} value={row.value} onChange={(event) => row.onChange(Number(event.target.value))} />
    </div>)}
    <p className="prefs-note">Week and historical status are always derived using the targets currently saved here; changing a target reinterprets prior summaries without changing their underlying events.</p>
    <button className="capture-button prefs-submit" type="submit">Save targets</button>
  </form>

  const types = <div className="prefs-panel">
    <TypeRegistrySettings types={entityTypes} onSave={onSaveEntityType} />
  </div>

  const integrations = <div className="prefs-panel">
    <div className="prefs-record">
      <div className="prefs-record-head"><span>Google Calendar</span><em className={calendar?.connected ? 'is-good' : ''}>{mode === 'live' ? calendar ? calendar.connected ? 'Connected' : 'Disconnected' : 'Checking' : 'Sign in required'}</em></div>
      {calendarError && <div className="prefs-record-line is-short">{calendarError}</div>}
      <div className="prefs-record-line">{mode === 'live' ? calendar?.connected ? calendarStatusLabel(calendar) : 'Command exports interviews, hard deadlines, and important milestones only, and only on request.' : 'Available after signing in.'}</div>
      {mode === 'live' && <div className="prefs-record-actions">{!calendar?.connected
        ? <button className="secondary-button" type="button" onClick={connect}>Connect Calendar</button>
        : <button className="secondary-button" type="button" onClick={() => setConfirmation('disconnect')}>Disconnect</button>}</div>}
    </div>

    <McpConnections session={mode === 'live' ? session : null} />

    <div className="prefs-record">
      <div className="prefs-record-head"><span>Export</span><em>{mode === 'live' ? 'Available' : 'Sign in required'}</em></div>
      <div className="prefs-record-line">Dynamic JSON of every registered type, or one CSV per type.</div>
      {mode === 'live' && <div className="prefs-record-actions">
        <button className="secondary-button" type="button" onClick={() => onExport('json')}>Export JSON</button>
        {entityTypes.map((type) => <button className="secondary-button" type="button" key={type.id} onClick={() => onExport('csv', type.typeKey)}>CSV · {type.pluralName}</button>)}
      </div>}
    </div>

    <div className="prefs-record">
      <div className="prefs-record-head"><span>Review</span><em>Sections 05 &amp; 06</em></div>
      <div className="prefs-record-line">This week&rsquo;s execution and the longer monthly readiness signals.</div>
      <div className="prefs-record-actions">
        <button className="secondary-button" type="button" onClick={onOpenWeek}>Open weekly review</button>
        <button className="secondary-button" type="button" onClick={onOpenRun}>Open monthly Run</button>
        {onOpenCalendar && <button className="secondary-button" type="button" onClick={onOpenCalendar}>Open Calendar</button>}
      </div>
    </div>

    <div className="prefs-record">
      <div className="prefs-record-head"><span>Account</span><em>{mode === 'live' ? 'Signed in' : 'Local prototype'}</em></div>
      <div className="prefs-record-line">{mode === 'live' ? session?.user?.email ?? '' : 'Edits stay in this browser.'}</div>
      <div className="prefs-record-actions"><button className="secondary-button" type="button" onClick={() => mode === 'live' ? onSignOut() : setConfirmation('reset')}>{mode === 'live' ? 'Sign out' : 'Reset prototype data'}</button></div>
    </div>
  </div>

  const tabs = <div className="prefs-tabs" role="tablist" aria-label="Preference sections">{(['targets', 'types', 'integrations'] as const).map((value) => (
    <button className={tab === value ? 'is-selected' : ''} role="tab" aria-selected={tab === value} type="button" key={value} onClick={() => setTab(value)}>{value}</button>
  ))}</div>

  const content = <div className="settings-content">
    {tab === 'targets' && targets}
    {tab === 'types' && types}
    {tab === 'integrations' && integrations}
  </div>

  return (
    <>
    {inline
      ? <main><ViewShell eyebrow="Section 07 · Registry & preferences" title="Preferences" aside={tabs}><div className="settings-page">{content}</div></ViewShell></main>
      : <Sheet title="Targets & data" eyebrow="Settings" onClose={onClose}>{content}</Sheet>}
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

import { useEffect, useState } from 'react'
import { AppHeader } from './AppHeader'
import { AuthScreen } from './AuthScreen'
import { OAuthConsentScreen } from './OAuthConsentScreen'
import { SettingsSheet } from './SettingsSheet'
import { dateKey, emptyLog } from './domain'
import { exportCsv, exportData, type CsvTable } from './lib/api'
import { useHashRoute, ViewNav } from './routes'
import type { Commitment, DailyLog, Entity } from './types'
import { Icon } from './ui'
import { useCommandData, type SyncState } from './useCommandData'
import { useIndiaToday } from './useIndiaToday'
import { CommitmentQueue, TodayView } from './views/TodayView'
import { DueView } from './views/DueView'
import { BrowseView } from './views/BrowseView'
import { ItemView } from './views/ItemView'
import { EntitySheet } from './views/EntitySheet'
import { OutcomeSheet, ScheduleSheet } from './views/CommitmentSheets'
import { DailyLogSheet } from './views/DailyLogSheet'

export function App() {
  const today = useIndiaToday()
  const command = useCommandData()
  const [route, navigate] = useHashRoute()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [captureType, setCaptureType] = useState<string | null>(null)
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [scheduling, setScheduling] = useState<{ entity: Entity; commitment: Commitment | null } | null>(null)
  const [outcome, setOutcome] = useState<Commitment | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [updateReady, setUpdateReady] = useState(false)
  const authorizationId = oauthAuthorizationId()

  useEffect(() => { document.documentElement.dataset.theme = command.settings.theme }, [command.settings.theme])
  useEffect(() => {
    function onUpdateReady() { setUpdateReady(true) }
    window.addEventListener('command:update-ready', onUpdateReady)
    return () => window.removeEventListener('command:update-ready', onUpdateReady)
  }, [])

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }

  function saveEntity(entity: Entity, firstCommitment: Commitment | null): boolean {
    if (!command.saveEntity(entity)) return false
    if (firstCommitment && !command.saveCommitment(firstCommitment)) return false
    showNotice(firstCommitment ? 'Record captured and scheduled' : 'Record saved')
    return true
  }

  function saveCommitment(commitment: Commitment): boolean {
    if (!command.saveCommitment(commitment)) return false
    showNotice(commitment.state === 'open' ? 'Commitment scheduled' : 'Outcome recorded')
    return true
  }

  function archive(entity: Entity) {
    if (command.archiveEntity(entity)) showNotice('Record archived')
  }

  function restore(entity: Entity) {
    if (command.restoreEntity(entity)) showNotice('Record restored')
  }

  function handleExport(kind: 'json' | 'csv', table?: string) {
    if (!command.data) return
    const content = kind === 'json'
      ? exportData(command.data, command.settings)
      : exportCsv(table as CsvTable, command.data)
    download(content, kind === 'json' ? `command-export-${dateKey(today)}.json` : `command-${table}.csv`, kind)
    showNotice('Export downloaded')
  }

  if (command.mode === 'configuring') return <AuthScreen />
  if (authorizationId && command.mode === 'live') return <OAuthConsentScreen authorizationId={authorizationId} />
  if (command.syncState === 'error' && !command.data) return <div className="loading-state loading-error"><p>{command.syncMessage}</p><button className="secondary-button" type="button" onClick={command.retrySync}>Retry</button></div>
  if (!command.ready || !command.data) return <div className="loading-state">Loading…</div>

  const data = command.data
  const todayLog = data.legacy.logs.find((log) => log.day === dateKey(today)) ?? emptyLog(dateKey(today))
  const openItem = (id: string) => navigate({ kind: 'item', id })
  const openCapture = (typeKey: string | null = null) => setCaptureType(typeKey ?? 'application')

  return <>
    <div className="app-shell" id="top">
      <AppHeader today={today} live={command.mode === 'live'} theme={command.settings.theme} onOpenSettings={() => setSettingsOpen(true)} onToggleTheme={() => command.saveSettings({ ...command.settings, theme: command.settings.theme === 'night' ? 'day' : 'night' })} />
      <ViewNav route={route} navigate={navigate} onCapture={() => openCapture()} onMore={() => setSettingsOpen(true)} />
      {route.kind === 'today' && <TodayView data={data} settings={command.settings} today={today} onLog={() => setLogOpen(true)} onCapture={() => openCapture()} onOutcome={setOutcome} onOpenItem={openItem} />}
      {route.kind === 'due' && <DueView data={data} today={today} window={route.window} typeKey={route.typeKey} onChange={(window, typeKey) => navigate({ kind: 'due', window, typeKey })} onOutcome={setOutcome} onOpenItem={openItem} onCapture={openCapture} />}
      {route.kind === 'browse' && <BrowseView data={data} typeKey={route.typeKey} onType={(typeKey) => navigate({ kind: 'browse', typeKey })} onOpenItem={openItem} onCapture={openCapture} onOpenSettings={() => setSettingsOpen(true)} />}
      {route.kind === 'item' && <ItemView data={data} entityId={route.id} onEdit={setEditingEntity} onSchedule={(entity, commitment = null) => setScheduling({ entity, commitment })} onOutcome={setOutcome} onArchive={archive} onRestore={restore} />}
      <footer><img src="./assets/command-mark.svg" alt="" /><span>Keep the centre clear.</span></footer>
    </div>

    {logOpen && <DailyLogSheet log={todayLog} settings={command.settings} onSave={(log: DailyLog) => { const saved = command.saveLog(log); if (saved) showNotice('Today saved'); return saved }} onClose={() => setLogOpen(false)} />}
    {captureType && <EntitySheet types={data.entityTypes} initialTypeKey={captureType} onSave={saveEntity} onClose={() => setCaptureType(null)} />}
    {editingEntity && <EntitySheet types={data.entityTypes} existing={editingEntity} onSave={saveEntity} onClose={() => setEditingEntity(null)} />}
    {scheduling && <ScheduleSheet entity={scheduling.entity} type={data.entityTypes.find((type) => type.id === scheduling.entity.entityTypeId)!} existing={scheduling.commitment} onSave={saveCommitment} onClose={() => setScheduling(null)} />}
    {outcome && <OutcomeSheet commitment={outcome} onSave={saveCommitment} onClose={() => setOutcome(null)} />}
    {settingsOpen && <SettingsSheet settings={command.settings} session={command.session} mode={command.mode} onSaveSettings={(settings) => { const saved = command.saveSettings(settings); if (saved) showNotice('Targets saved'); return saved }} onSignOut={() => { setSettingsOpen(false); command.signOut() }} onClose={() => setSettingsOpen(false)} onExport={handleExport} />}
    <SyncBanner state={command.syncState} message={command.syncMessage} onRetry={command.retrySync} />
    {updateReady && <div className="update-banner" role="status"><span>A new version is ready.</span><button className="secondary-button" type="button" onClick={() => window.location.reload()}>Refresh</button></div>}
    <div className={`toast ${notice ? 'is-visible' : ''}`} role="status" aria-live="polite">{notice}</div>
  </>
}

function SyncBanner({ state, message, onRetry }: { state: SyncState; message: string; onRetry: () => void }) {
  if (state === 'idle') return null
  const actionable = state === 'error' || state === 'offline' || state === 'stale'
  return <div className={`sync-banner sync-${state}`} role="status" aria-live="polite"><span>{message}</span>{actionable && <button type="button" onClick={onRetry}>Retry</button>}</div>
}

function download(content: string, filename: string, kind: 'json' | 'csv') {
  const url = URL.createObjectURL(new Blob([content], { type: kind === 'json' ? 'application/json' : 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function oauthAuthorizationId(): string | null {
  const current = new URLSearchParams(window.location.search).get('authorization_id')
  if (current) sessionStorage.setItem('command:oauth-authorization-id', current)
  return current ?? sessionStorage.getItem('command:oauth-authorization-id')
}

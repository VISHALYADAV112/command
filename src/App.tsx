import { useEffect, useState, type CSSProperties } from 'react'
import { AppHeader, gazetteIssueNumber } from './AppHeader'
import { AuthScreen } from './AuthScreen'
import { OAuthConsentScreen } from './OAuthConsentScreen'
import { SettingsSheet } from './SettingsSheet'
import { dateKey, emptyLog } from './domain'
import { exportData, exportTypeCsv } from './lib/api'
import { sealGlyph, useHashRoute, ViewNav } from './routes'
import type { Commitment, DailyLog, Entity } from './types'
import { useCommandData, type SyncState } from './useCommandData'
import { useIndiaToday } from './useIndiaToday'
import { TodayView } from './views/TodayView'
import { DueView } from './views/DueView'
import { BrowseView } from './views/BrowseView'
import { ItemView } from './views/ItemView'
import { EntitySheet } from './views/EntitySheet'
import { OutcomeSheet, ScheduleSheet } from './views/CommitmentSheets'
import { DailyLogSheet } from './views/DailyLogSheet'
import { AgentInboxSheet, pendingProposalCount } from './views/AgentInboxSheet'
import { WeekView } from './views/WeekView'
import { RunView } from './views/RunView'
import { CalendarView } from './views/CalendarView'
import { commitmentEventPayload, createCalendarEvent } from './lib/calendar'
import { dueItems } from './v3Selectors'
import { createGazettePreviewRun, createGazettePreviewWeek, isGazettePreview } from './gazettePreview'

export function App() {
  const today = useIndiaToday()
  const gazettePreview = isGazettePreview()
  const command = useCommandData()
  const [route, navigate] = useHashRoute()
  const [logOpen, setLogOpen] = useState(false)
  const [captureType, setCaptureType] = useState<string | null>(null)
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [scheduling, setScheduling] = useState<{ entity: Entity; commitment: Commitment | null } | null>(null)
  const [outcome, setOutcome] = useState<Commitment | null>(null)
  const [agentInboxOpen, setAgentInboxOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [updateReady, setUpdateReady] = useState(false)
  const authorizationId = oauthAuthorizationId()

  useEffect(() => { document.documentElement.dataset.theme = command.settings.theme }, [command.settings.theme])
  useEffect(() => {
    function onUpdateReady() { setUpdateReady(true) }
    window.addEventListener('command:update-ready', onUpdateReady)
    return () => window.removeEventListener('command:update-ready', onUpdateReady)
  }, [])
  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return
      if (event.key.toLocaleLowerCase() === 'c') setCaptureType('application')
      if (event.key.toLocaleLowerCase() === 'l') setLogOpen(true)
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }

  function saveEntity(entity: Entity, firstCommitment: Commitment | null): boolean {
    if (!command.saveCapture(entity, firstCommitment)) return false
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
    const type = table ? command.data.entityTypes.find((item) => item.typeKey === table) : null
    if (kind === 'csv' && !type) return showNotice('That type is no longer available')
    const content = kind === 'json' ? exportData(command.data, command.settings) : exportTypeCsv(type!, command.data)
    download(content, kind === 'json' ? `command-export-${dateKey(today)}.json` : `command-${table}.csv`, kind)
    showNotice('Export downloaded')
  }

  if (command.mode === 'configuring') return <AuthScreen />
  if (authorizationId && command.mode === 'live') return <OAuthConsentScreen authorizationId={authorizationId} />
  if (command.syncState === 'error' && !command.data) return <div className="loading-state loading-error"><p>{command.syncMessage}</p><button className="secondary-button" type="button" onClick={command.retrySync}>Retry</button></div>
  if (!command.ready || !command.data) return <div className="loading-state">Loading…</div>

  const data = command.data
  const todayLog = data.legacy.logs.find((log) => log.day === dateKey(today)) ?? emptyLog(dateKey(today))
  const outcomeEntity = outcome ? data.entities.find((entity) => entity.id === outcome.entityId) : null
  const outcomeType = outcomeEntity ? data.entityTypes.find((type) => type.id === outcomeEntity.entityTypeId) : null
  const openItem = (id: string) => navigate({ kind: 'item', id })
  const openCapture = (typeKey: string | null = null) => setCaptureType(typeKey ?? 'application')
  const urgentCount = dueItems(data, today).filter((item) => item.dueStatus !== 'upcoming').length
  const pendingAgents = pendingProposalCount(data)

  return <>
    <div className="app-shell" id="top" style={{ '--seal-glyph': `'${sealGlyph(route)}'` } as CSSProperties}>
      <AppHeader today={today} live={command.mode === 'live'} preview={gazettePreview} theme={command.settings.theme} data={data} settings={command.settings} onToggleTheme={() => command.saveSettings({ ...command.settings, theme: command.settings.theme === 'night' ? 'day' : 'night' })} />
      <ViewNav route={route} navigate={navigate} onCapture={() => openCapture()} onLog={() => setLogOpen(true)} onAgent={() => setAgentInboxOpen(true)} pendingAgents={pendingAgents} dueBadge={urgentCount} />
      {route.kind === 'today' && <TodayView data={data} settings={command.settings} today={today} preview={gazettePreview} onLog={() => setLogOpen(true)} onCapture={() => openCapture()} onOutcome={setOutcome} onOpenItem={openItem} onOpenAgentInbox={() => setAgentInboxOpen(true)} onOpenDue={() => navigate({ kind: 'due', window: 'all', typeKey: null })} onOpenWeek={() => navigate({ kind: 'week' })} />}
      {route.kind === 'due' && <DueView data={data} today={today} window={route.window} typeKey={route.typeKey} loadPage={command.mode === 'live' ? command.loadDuePage : undefined} onChange={(window, typeKey) => navigate({ kind: 'due', window, typeKey })} onOutcome={setOutcome} onOpenItem={openItem} onCapture={openCapture} />}
      {route.kind === 'calendar' && <CalendarView data={data} today={today} onOpenItem={openItem} onOutcome={setOutcome} />}
      {route.kind === 'browse' && <BrowseView data={data} typeKey={route.typeKey} loadPage={command.mode === 'live' ? command.loadBrowsePage : undefined} onType={(typeKey) => navigate({ kind: 'browse', typeKey })} onOpenItem={openItem} onCapture={openCapture} onOpenSettings={() => navigate({ kind: 'settings' })} />}
      {route.kind === 'item' && <ItemView data={data} entityId={route.id} today={today} onEdit={setEditingEntity} onSchedule={(entity, commitment = null) => setScheduling({ entity, commitment })} onOutcome={setOutcome} onArchive={archive} onRestore={restore} onCalendar={command.mode === 'live' && command.session ? async (commitment, entity, type) => {
        const payload = commitmentEventPayload(commitment, entity, type)
        if (!payload || !command.session) throw new Error('This commitment is not approved for Calendar export.')
        await createCalendarEvent(command.session, payload)
        command.refreshData()
        showNotice('Commitment added to Calendar')
      } : undefined} />}
      {route.kind === 'week' && <WeekView data={data} settings={command.settings} today={today} loadSummary={gazettePreview ? async () => createGazettePreviewWeek(today) : command.mode === 'live' ? command.loadWeek : undefined} />}
      {route.kind === 'run' && <RunView data={data} today={today} loadSummary={gazettePreview ? async () => createGazettePreviewRun(today) : command.mode === 'live' ? command.loadRun : undefined} />}
      {route.kind === 'settings' && <SettingsSheet inline settings={command.settings} entityTypes={data.entityTypes} session={command.session} mode={command.mode} onSaveSettings={(settings) => { const saved = command.saveSettings(settings); if (saved) showNotice('Targets saved'); return saved }} onSaveEntityType={(type) => { const saved = command.saveEntityType(type); if (saved) showNotice('Type saved'); return saved }} onSignOut={command.signOut} onClose={() => navigate({ kind: 'today' })} onOpenWeek={() => navigate({ kind: 'week' })} onOpenRun={() => navigate({ kind: 'run' })} onOpenCalendar={() => navigate({ kind: 'calendar' })} onExport={handleExport} />}
      <footer className="gazette-footer"><div lang="sa-Brah">𑀓 𑀫 𑀤 𑀯 𑀢 𑀭 𑀲</div><section><button className="log-button" type="button" onClick={() => setLogOpen(true)}>File evening practice log</button><span>Keys: C capture · L log · Esc close · No. {gazetteIssueNumber(today)}</span></section></footer>
    </div>

    {logOpen && <DailyLogSheet log={todayLog} settings={command.settings} onSave={(log: DailyLog) => { const saved = command.saveLog(log); if (saved) showNotice('Today saved'); return saved }} onClose={() => setLogOpen(false)} />}
    {captureType && <EntitySheet types={data.entityTypes} initialTypeKey={captureType} onSave={saveEntity} onClose={() => setCaptureType(null)} />}
    {editingEntity && <EntitySheet types={data.entityTypes} existing={editingEntity} onSave={saveEntity} onClose={() => setEditingEntity(null)} />}
    {scheduling && <ScheduleSheet entity={scheduling.entity} type={data.entityTypes.find((type) => type.id === scheduling.entity.entityTypeId)!} existing={scheduling.commitment} onSave={saveCommitment} onClose={() => setScheduling(null)} />}
    {outcome && outcomeEntity && outcomeType && <OutcomeSheet commitment={outcome} entity={outcomeEntity} type={outcomeType} onSave={command.saveOutcome} onClose={() => setOutcome(null)} />}
    {agentInboxOpen && <AgentInboxSheet data={data} onDecide={command.decideProposal} onClose={() => setAgentInboxOpen(false)} />}
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

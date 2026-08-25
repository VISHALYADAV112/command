import { useEffect, useState } from 'react'
import { AppHeader } from './AppHeader'
import { AuthScreen } from './AuthScreen'
import { CalendarStrip } from './CalendarStrip'
import { SettingsSheet } from './SettingsSheet'
import { applyRecall, dateKey, emptyLog } from './domain'
import { exportCsv, exportData, type CsvTable } from './lib/api'
import { applicationDeadlineEvent, createCalendarEvent, projectDeadlineEvent } from './lib/calendar'
import { ViewNav, useHashRoute, type AppRoute } from './routes'
import type { DailyLog, JobApplication, LearningItem, Project, Recall } from './types'
import { Icon } from './ui'
import { useCommandData, type SyncState } from './useCommandData'
import { useIndiaToday } from './useIndiaToday'
import { DailyLogSheet } from './views/DailyLogSheet'
import { DashboardView } from './views/DashboardView'
import { IdeasView } from './views/IdeasView'
import { JobsView, ApplicationSheet } from './views/JobsView'
import { LearningView } from './views/LearningView'
import { PeopleView } from './views/PeopleView'
import { ProjectsView } from './views/ProjectsView'
import { ReviewSheet } from './views/ReviewSheet'

export function App() {
  const today = useIndiaToday()
  const todayKey = dateKey(today)
  const command = useCommandData()
  const [route, navigate] = useHashRoute()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [applicationOpen, setApplicationOpen] = useState(false)
  const [editingApplication, setEditingApplication] = useState<JobApplication | null>(null)
  const [reviewItem, setReviewItem] = useState<LearningItem | null>(null)
  const [createTick, setCreateTick] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    function onUpdateReady() { setUpdateReady(true) }
    window.addEventListener('command:update-ready', onUpdateReady)
    return () => window.removeEventListener('command:update-ready', onUpdateReady)
  }, [])

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }

  function goCreate(next: AppRoute) {
    setCreateTick((tick) => tick + 1)
    navigate(next)
  }

  function report<T>(action: (value: T) => boolean, message: string): (value: T) => boolean {
    return (value) => {
      const accepted = action(value)
      if (accepted && command.mode === 'demo') showNotice(message)
      return accepted
    }
  }

  function saveDashboardApplication(application: JobApplication) {
    if (!command.saveApplication(application)) return
    setApplicationOpen(false)
    setEditingApplication(null)
  }

  function deleteDashboardApplication(id: string) {
    if (!command.deleteApplication(id)) return
    setApplicationOpen(false)
    setEditingApplication(null)
  }

  async function pushApplicationDeadline(app: JobApplication) {
    if (!command.session || !app.windowClosesOn) return
    await pushDeadline(() => createCalendarEvent(command.session!, applicationDeadlineEvent(app)))
  }

  async function pushProjectDeadline(project: Project) {
    if (!command.session || !project.deadlineOn) return
    await pushDeadline(() => createCalendarEvent(command.session!, projectDeadlineEvent(project)))
  }

  async function pushDeadline(action: () => Promise<void>) {
    try {
      await action()
      showNotice('Added to Calendar')
    } catch (error) {
      showNotice(`Calendar: ${explainCalendarError(error)}`)
    }
  }

  function completeRecall(recall: Recall) {
    if (!reviewItem) return
    const reviewed = applyRecall(reviewItem, recall, today)
    if (!command.completeReview(reviewed)) return
    setReviewItem(null)
    showNotice(reviewed.nextReviewOn ? `Next review ${reviewed.nextReviewOn}` : 'Item retired from rotation')
  }

  function handleExport(kind: 'json' | 'csv', table?: string) {
    if (!command.data) return
    const content = kind === 'json'
      ? exportData(command.data, command.settings)
      : exportCsv(table as CsvTable, command.data)
    download(content, kind === 'json' ? `command-export-${todayKey}.json` : `command-${table}.csv`, kind)
    showNotice('Export downloaded')
  }

  if (command.mode === 'configuring') return <AuthScreen />
  if (command.syncState === 'error' && !command.data) {
    return <div className="loading-state loading-error"><p>{command.syncMessage}</p><button className="secondary-button" type="button" onClick={command.retrySync}>Retry</button></div>
  }
  if (!command.ready || !command.data) return <div className="loading-state">Loading…</div>

  const data = command.data
  const live = command.mode === 'live'
  const todayLog = data.logs.find((log) => log.day === todayKey) ?? emptyLog(todayKey)
  const quickActions = (
    <div className="action-row" role="group" aria-label="Quick capture">
      <button className="secondary-button" type="button" onClick={() => setApplicationOpen(true)}><Icon name="plus" /><span>Application</span></button>
      <button className="secondary-button" type="button" onClick={() => goCreate('learning')}><Icon name="plus" /><span>Concept</span></button>
      <button className="secondary-button" type="button" onClick={() => goCreate('ideas')}><Icon name="plus" /><span>Idea</span></button>
    </div>
  )

  return (
    <>
      <div className="app-shell" id="top">
        <AppHeader today={today} live={live} onOpenSettings={() => setSettingsOpen(true)} />
        <ViewNav route={route} navigate={navigate} />
        {route === '' && <DashboardView data={data} settings={command.settings} today={today} onLog={() => setLogOpen(true)} onAddApplication={() => setApplicationOpen(true)} onEditApplication={setEditingApplication} onReview={setReviewItem} quickActions={quickActions} calendar={<CalendarStrip session={command.session} />} />}
        {route === 'jobs' && <main><JobsView applications={data.applications} people={data.people} today={today} onSave={report(command.saveApplication, 'Application saved')} onDelete={report(command.deleteApplication, 'Application removed')} onDeadlineToCalendar={live ? pushApplicationDeadline : undefined} /></main>}
        {route === 'people' && <main><PeopleView people={data.people} today={today} onSave={report(command.savePerson, 'Person saved')} onDelete={report(command.deletePerson, 'Person removed')} /></main>}
        {route === 'projects' && <main><ProjectsView projects={data.projects} today={today} createSignal={createTick} onSave={report(command.saveProject, 'Project saved')} onDelete={report(command.deleteProject, 'Project removed')} onDeadlineToCalendar={live ? pushProjectDeadline : undefined} /></main>}
        {route === 'ideas' && <main><IdeasView ideas={data.ideas} createSignal={createTick} onSave={report(command.saveIdea, 'Idea saved')} onDelete={report(command.deleteIdea, 'Idea removed')} /></main>}
        {route === 'learning' && <main><LearningView items={data.learning} today={today} createSignal={createTick} onCapture={report(command.captureConcept, 'Concept captured')} onDelete={report(command.deleteLearning, 'Concept removed')} /></main>}
        <footer><img src="./assets/command-mark.svg" alt="" /><span>Keep the centre clear.</span></footer>
      </div>

      {logOpen && <DailyLogSheet log={todayLog} settings={command.settings} onSave={report<DailyLog>(command.saveLog, 'Today saved')} onClose={() => setLogOpen(false)} />}
      {(applicationOpen || editingApplication) && <ApplicationSheet today={today} people={data.people} existing={editingApplication} onSave={saveDashboardApplication} onDelete={editingApplication ? deleteDashboardApplication : undefined} onDeadlineToCalendar={live ? pushApplicationDeadline : undefined} onClose={() => { setApplicationOpen(false); setEditingApplication(null) }} />}
      {reviewItem && <ReviewSheet item={reviewItem} onComplete={completeRecall} onClose={() => setReviewItem(null)} />}
      {settingsOpen && <SettingsSheet settings={command.settings} session={command.session} mode={command.mode} onSaveSettings={report(command.saveSettings, 'Targets saved')} onSignOut={() => { setSettingsOpen(false); command.signOut() }} onClose={() => setSettingsOpen(false)} onExport={handleExport} />}
      <SyncBanner state={command.syncState} message={command.syncMessage} onRetry={command.retrySync} />
      {updateReady && <div className="update-banner" role="status"><span>A new version is ready.</span><button className="secondary-button" type="button" onClick={() => window.location.reload()}>Refresh</button></div>}
      <div className={`toast ${notice ? 'is-visible' : ''}`} role="status" aria-live="polite">{notice}</div>
    </>
  )
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

function explainCalendarError(error: unknown): string {
  const raw = error instanceof Error ? error.message : ''
  try {
    const parsed = JSON.parse(raw) as { detail?: { error?: { message?: string }; message?: string }; error?: string }
    return parsed.detail?.error?.message ?? parsed.detail?.message ?? parsed.error ?? raw.slice(0, 140)
  } catch { return raw.slice(0, 140) || 'unreachable' }
}

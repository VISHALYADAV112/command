import { useEffect, useState } from 'react'
import { dateKey } from '../domain'
import { V3_PAGE_SIZE, type RemoteDueItem, type RemotePage } from '../lib/api'
import type { CommandData, Commitment } from '../types'
import type { DueWindow } from '../v3Selectors'
import { EmptyState, ViewShell } from '../ui'
import { dueItems, type DueItem } from '../v3Selectors'
import { CommitmentQueue } from './TodayView'

const windows: Array<{ key: DueWindow; label: string }> = [
  { key: 'overdue', label: 'Overdue' }, { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' }, { key: 'all', label: 'All' },
]
type DuePageLoader = (day: string, window: DueWindow, typeKey: string | null, offset: number) => Promise<RemotePage<RemoteDueItem>>

export function DueView({ data, today, window, typeKey, loadPage, onChange, onOutcome, onOpenItem, onCapture }: {
  data: CommandData
  today: Date
  window: DueWindow
  typeKey: string | null
  loadPage?: DuePageLoader
  onChange: (window: DueWindow, typeKey: string | null) => void
  onOutcome: (commitment: Commitment) => void
  onOpenItem: (id: string) => void
  onCapture: (typeKey: string | null) => void
}) {
  const [page, setPage] = useState(0)
  const [remote, setRemote] = useState<{ key: string; page: RemotePage<RemoteDueItem> } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const localItems = dueItems(data, today, window, typeKey)
  const pageCount = Math.max(1, Math.ceil(localItems.length / V3_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const remoteKey = `${dateKey(today)}:${window}:${typeKey ?? ''}:${page}`
  const remoteItems = remote?.key === remoteKey ? toDueItems(remote.page.items, data) : null
  const visibleItems = remoteItems ?? localItems.slice(currentPage * V3_PAGE_SIZE, (currentPage + 1) * V3_PAGE_SIZE)
  const hasNext = remoteItems ? Boolean(remote?.page.hasMore) : currentPage + 1 < pageCount
  const activeType = data.entityTypes.find((type) => type.typeKey === typeKey)
  const label = window === 'all' ? 'All open commitments' : windows.find((item) => item.key === window)?.label ?? 'Due'
  useEffect(() => setPage(0), [window, typeKey])
  useEffect(() => {
    if (!loadPage) return
    let active = true
    setLoadError(false)
    void loadPage(dateKey(today), window, typeKey, page * V3_PAGE_SIZE)
      .then((next) => { if (active) setRemote({ key: remoteKey, page: next }) })
      .catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [loadPage, page, remoteKey, today, typeKey, window])
  return <main><ViewShell eyebrow="Unified queue" title={label} aside={remoteItems ? `${visibleItems.length}${hasNext ? '+' : ''} on page` : `${localItems.length} open`}>
    <div className="filter-bar" aria-label="Due filters">
      <div className="filter-tabs" role="group" aria-label="Due window">{windows.map((item) => <button className={window === item.key ? 'is-selected' : ''} type="button" key={item.key} onClick={() => onChange(item.key, typeKey)}>{item.label}</button>)}</div>
      <label>Type<select aria-label="Type filter" value={typeKey ?? ''} onChange={(event) => onChange(window, event.target.value || null)}><option value="">All types</option>{data.entityTypes.filter((type) => type.isActive).map((type) => <option key={type.id} value={type.typeKey}>{type.pluralName}</option>)}</select></label>
    </div>
    {loadError && <p className="view-hint" role="status">Could not refresh this page. Showing the latest cached queue.</p>}
    {visibleItems.length === 0 ? <EmptyState message={typeKey ? `No ${activeType?.pluralName.toLocaleLowerCase() ?? 'records'} match this filter.` : 'Nothing is due in this window.'} /> : <CommitmentQueue items={visibleItems} today={today} onOutcome={onOutcome} onOpenItem={onOpenItem} />}
    {visibleItems.length === 0 && <div className="form-actions"><button className="secondary-button" type="button" onClick={() => onCapture(typeKey)}>Capture {activeType?.singularName ?? 'record'}</button></div>}
    {(page > 0 || hasNext) && <nav className="pagination" aria-label="Due pages"><button className="secondary-button" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1}{remoteItems ? '' : ` of ${pageCount}`}</span><button className="secondary-button" type="button" disabled={!hasNext} onClick={() => setPage(page + 1)}>Next</button></nav>}
  </ViewShell></main>
}

function toDueItems(items: RemoteDueItem[], data: CommandData): DueItem[] {
  return items.flatMap((item) => {
    const type = data.entityTypes.find((candidate) => candidate.id === item.entityTypeId || candidate.typeKey === item.typeKey)
    if (!type) return []
    const localEntity = data.entities.find((candidate) => candidate.id === item.entityId)
    const localCommitment = data.commitments.find((candidate) => candidate.id === item.commitmentId)
    if (localCommitment && localCommitment.state !== 'open') return []
    return [{
      type,
      entity: localEntity ?? {
        id: item.entityId, entityTypeId: type.id, title: item.entityTitle, fields: {},
        schemaVersion: type.schemaVersion, archivedAt: null,
        createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z',
      },
      commitment: localCommitment ?? {
        id: item.commitmentId, entityId: item.entityId, kind: item.kind as Commitment['kind'],
        action: item.action, dueOn: item.dueOn, state: 'open', outcome: null, completedAt: null,
        originSource: item.originSource as Commitment['originSource'],
      },
      dueStatus: item.dueStatus as DueItem['dueStatus'],
    }]
  })
}

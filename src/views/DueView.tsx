import type { CommandData, Commitment, EntityType } from '../types'
import type { DueWindow } from '../v3Selectors'
import { EmptyState, ViewShell } from '../ui'
import { dueItems } from '../v3Selectors'
import { CommitmentQueue } from './TodayView'

const windows: Array<{ key: DueWindow; label: string }> = [
  { key: 'overdue', label: 'Overdue' }, { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' }, { key: 'all', label: 'All' },
]

export function DueView({ data, today, window, typeKey, onChange, onOutcome, onOpenItem, onCapture }: {
  data: CommandData
  today: Date
  window: DueWindow
  typeKey: string | null
  onChange: (window: DueWindow, typeKey: string | null) => void
  onOutcome: (commitment: Commitment) => void
  onOpenItem: (id: string) => void
  onCapture: (typeKey: string | null) => void
}) {
  const items = dueItems(data, today, window, typeKey)
  const activeType = data.entityTypes.find((type) => type.typeKey === typeKey)
  const label = window === 'all' ? 'All open commitments' : windows.find((item) => item.key === window)?.label ?? 'Due'
  return <main><ViewShell eyebrow="Unified queue" title={label} aside={`${items.length} open`}>
    <div className="filter-bar" aria-label="Due filters">
      <div className="filter-tabs" role="group" aria-label="Due window">{windows.map((item) => <button className={window === item.key ? 'is-selected' : ''} type="button" key={item.key} onClick={() => onChange(item.key, typeKey)}>{item.label}</button>)}</div>
      <label>Type<select aria-label="Type filter" value={typeKey ?? ''} onChange={(event) => onChange(window, event.target.value || null)}><option value="">All types</option>{data.entityTypes.filter((type) => type.isActive).map((type) => <option key={type.id} value={type.typeKey}>{type.pluralName}</option>)}</select></label>
    </div>
    {items.length === 0 ? <EmptyState message={typeKey ? `No ${activeType?.pluralName.toLocaleLowerCase() ?? 'records'} match this filter.` : 'Nothing is due in this window.'} /> : <CommitmentQueue items={items.slice(0, 100)} today={today} onOutcome={onOutcome} onOpenItem={onOpenItem} />}
    {items.length === 0 && <div className="form-actions"><button className="secondary-button" type="button" onClick={() => onCapture(typeKey)}>Capture {activeType?.singularName ?? 'record'}</button></div>}
    {items.length > 100 && <p className="view-hint">Showing the first 100 commitments. Narrow the window or type to focus the queue.</p>}
  </ViewShell></main>
}

import { useState } from 'react'
import type { CommandData, EntityType } from '../types'
import { EmptyState, ViewShell } from '../ui'
import { browseEntities, displayFieldValue, openCommitmentCount } from '../v3Selectors'

export function BrowseView({ data, typeKey, onType, onOpenItem, onCapture, onOpenSettings }: {
  data: CommandData
  typeKey: string | null
  onType: (typeKey: string) => void
  onOpenItem: (id: string) => void
  onCapture: (typeKey: string) => void
  onOpenSettings: () => void
}) {
  const type = data.entityTypes.find((item) => item.typeKey === typeKey)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  if (!type) return <main><ViewShell eyebrow="Registry" title="Unknown type"><EmptyState message="This type is not available in your active registry." /><div className="form-actions"><button className="secondary-button" type="button" onClick={onOpenSettings}>Open Settings</button></div></ViewShell></main>
  const entities = browseEntities(data, type, query, filters)
  const visibleFields = type.fields.filter((field) => field.listVisible && !field.deprecated).slice(0, 3)
  const filterable = type.fields.filter((field) => field.filterable && field.options.length > 0 && !field.deprecated)

  return <main><ViewShell eyebrow="Registry browse" title={type.pluralName} aside={`${entities.length} records`}>
    <div className="browse-controls"><label>Type<select aria-label="Browse type" value={type.typeKey} onChange={(event) => { setFilters({}); onType(event.target.value) }}>{data.entityTypes.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.typeKey}>{item.pluralName}</option>)}</select></label><label className="browse-search">Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${type.pluralName.toLocaleLowerCase()}`} /></label><button className="primary-button" type="button" onClick={() => onCapture(type.typeKey)}>Capture {type.singularName}</button></div>
    {filterable.length > 0 && <div className="filter-bar browse-filters">{filterable.map((field) => <label key={field.key}>{field.label}<select value={filters[field.key] ?? ''} onChange={(event) => setFilters((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">All</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>)}</div>}
    {entities.length === 0 ? <EmptyState message={query || Object.values(filters).some(Boolean) ? 'No records match the current search and filters.' : `No ${type.pluralName.toLocaleLowerCase()} yet.`} /> : <div className="registry-list">{entities.slice(0, 100).map((entity) => <button type="button" className="registry-row" key={entity.id} onClick={() => onOpenItem(entity.id)}><strong>{entity.title}</strong>{visibleFields.map((field) => <span key={field.key}>{field.label}: {displayFieldValue(entity.fields[field.key])}</span>)}<small>{openCommitmentCount(data, entity.id)} open</small></button>)}</div>}
    {entities.length > 100 && <p className="view-hint">Showing the first 100 records. Search or filter to narrow the result.</p>}
  </ViewShell></main>
}

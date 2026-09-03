import { useEffect, useState } from 'react'
import { V3_PAGE_SIZE, type RemotePage } from '../lib/api'
import type { CommandData, EntityType } from '../types'
import { EmptyState, ViewShell } from '../ui'
import { browseEntities, displayFieldValue, openCommitmentCount } from '../v3Selectors'

type BrowsePageLoader = (type: EntityType, offset: number) => Promise<RemotePage<CommandData['entities'][number]>>

export function BrowseView({ data, typeKey, loadPage, onType, onOpenItem, onCapture, onOpenSettings }: {
  data: CommandData
  typeKey: string | null
  loadPage?: BrowsePageLoader
  onType: (typeKey: string) => void
  onOpenItem: (id: string) => void
  onCapture: (typeKey: string) => void
  onOpenSettings: () => void
}) {
  const type = data.entityTypes.find((item) => item.typeKey === typeKey)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [page, setPage] = useState(0)
  const [remote, setRemote] = useState<{ key: string; page: RemotePage<CommandData['entities'][number]> } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const useRemotePage = Boolean(loadPage && type) && !query && !Object.values(filters).some(Boolean)
  const remoteKey = `${type?.id ?? 'unknown'}:${page}`

  useEffect(() => {
    if (!loadPage || !type || !useRemotePage) return
    let active = true
    setLoadError(false)
    void loadPage(type, page * V3_PAGE_SIZE)
      .then((next) => { if (active) setRemote({ key: remoteKey, page: next }) })
      .catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [loadPage, page, remoteKey, type, useRemotePage])

  if (!type) return <main><ViewShell eyebrow="Registry" title="Unknown type"><EmptyState message="This type is not available in your active registry." /><div className="form-actions"><button className="secondary-button" type="button" onClick={onOpenSettings}>Open Settings</button></div></ViewShell></main>
  const entities = browseEntities(data, type, query, filters)
  const pageCount = Math.max(1, Math.ceil(entities.length / V3_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const remoteEntities = useRemotePage && remote?.key === remoteKey ? remote.page.items : null
  const visibleEntities = remoteEntities ?? entities.slice(currentPage * V3_PAGE_SIZE, (currentPage + 1) * V3_PAGE_SIZE)
  const hasNext = remoteEntities ? Boolean(remote?.page.hasMore) : currentPage + 1 < pageCount
  const visibleFields = type.fields.filter((field) => field.listVisible && !field.deprecated).slice(0, 3)
  const filterable = type.fields.filter((field) => field.filterable && field.options.length > 0 && !field.deprecated)

  return <main><ViewShell eyebrow="Registry browse" title={type.pluralName} aside={remoteEntities ? `${visibleEntities.length}${hasNext ? '+' : ''} on page` : `${entities.length} records`}>
    <div className="browse-controls"><label>Type<select aria-label="Browse type" value={type.typeKey} onChange={(event) => { setFilters({}); setQuery(''); setPage(0); onType(event.target.value) }}>{data.entityTypes.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.typeKey}>{item.pluralName}</option>)}</select></label><label className="browse-search">Search<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder={`Search ${type.pluralName.toLocaleLowerCase()}`} /></label><button className="primary-button" type="button" onClick={() => onCapture(type.typeKey)}>Capture {type.singularName}</button></div>
    {filterable.length > 0 && <div className="filter-bar browse-filters">{filterable.map((field) => <label key={field.key}>{field.label}<select value={filters[field.key] ?? ''} onChange={(event) => { setFilters((current) => ({ ...current, [field.key]: event.target.value })); setPage(0) }}><option value="">All</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>)}</div>}
    {loadError && <p className="view-hint" role="status">Could not refresh this page. Showing the latest cached records.</p>}
    {visibleEntities.length === 0 ? <EmptyState message={query || Object.values(filters).some(Boolean) ? 'No records match the current search and filters.' : `No ${type.pluralName.toLocaleLowerCase()} yet.`} /> : <div className="registry-list">
      <div className="registry-head" aria-hidden="true"><span>Record</span>{visibleFields.map((field) => <span key={field.key}>{field.label}</span>)}<span>Open</span></div>
      {visibleEntities.map((entity) => <button type="button" className="registry-row" key={entity.id} onClick={() => onOpenItem(entity.id)}><strong>{entity.title}</strong>{visibleFields.map((field) => <span data-label={field.label} key={field.key}>{displayFieldValue(entity.fields[field.key])}</span>)}<small>{openCommitmentCount(data, entity.id)} open</small></button>)}
    </div>}
    {(page > 0 || hasNext) && <nav className="pagination" aria-label="Browse pages"><button className="secondary-button" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1}{remoteEntities ? '' : ` of ${pageCount}`}</span><button className="secondary-button" type="button" disabled={!hasNext} onClick={() => setPage(page + 1)}>Next</button></nav>}
  </ViewShell></main>
}

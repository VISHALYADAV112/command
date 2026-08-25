import { useEffect, useState, type FormEvent } from 'react'
import type { Project } from '../types'
import { dateKey } from '../domain'
import { ConfirmSheet, EmptyState, Icon, Sheet, ViewShell, uid } from '../ui'

interface Props {
  projects: Project[]
  today: Date
  createSignal?: number
  onSave: (project: Project) => boolean
  onDelete: (id: string) => boolean
  onDeadlineToCalendar?: (project: Project) => Promise<void>
}

export function ProjectsView({ projects, today, createSignal = 0, onSave, onDelete, onDeadlineToCalendar }: Props) {
  const [editing, setEditing] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (createSignal > 0) setCreating(true)
  }, [createSignal])

  const sorted = [...projects].sort((a, b) => {
    const order = { active: 0, blocked: 1, review: 2, done: 3 } as const
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    return (a.deadlineOn ?? '9999').localeCompare(b.deadlineOn ?? '9999')
  })

  function blankProject(): Project {
    return { id: uid(), name: '', type: 'portfolio', status: 'active', client: '', paymentStatus: 'na', amount: null, currency: 'INR', isPublic: false, deadlineOn: null, repoUrl: '', demoUrl: '', driveFolderUrl: '', nextAction: '', content: '' }
  }

  return (
    <ViewShell
      eyebrow="Outer field · Work"
      title="Projects"
      aside={<button className="secondary-button" type="button" onClick={() => setCreating(true)}><Icon name="plus" /><span>Add project</span></button>}
    >
      <p className="portfolio-target portfolio-inline">
        <span>Public portfolio</span>
        <strong>{projects.filter((project) => project.status === 'done' && project.type === 'portfolio' && project.isPublic).length} / 3</strong>
      </p>
      {sorted.length === 0 ? (
        <EmptyState message="No projects yet. Ship one thing publicly." />
      ) : (
        <div className="item-list">
          {sorted.map((project) => (
            <article className="list-item" key={project.id}>
              <button type="button" className="item-button" onClick={() => setEditing(project)}>
                <div className="item-main">
                  <div><strong>{project.name}</strong><span>{project.type}</span></div>
                  <span className={`status-pill project-${project.status}`}>{project.status}</span>
                </div>
                <p>{project.nextAction}</p>
                {project.deadlineOn && <time dateTime={project.deadlineOn}>Due {project.deadlineOn.slice(5)}</time>}
              </button>
            </article>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProjectSheet
          project={editing ?? blankProject()}
          today={today}
          isNew={!editing}
          onSave={(next) => { if (onSave(next)) { setCreating(false); setEditing(null) } }}
          onDelete={editing ? () => { if (onDelete(editing.id)) setEditing(null) } : undefined}
          onDeadlineToCalendar={onDeadlineToCalendar}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}
    </ViewShell>
  )
}

function ProjectSheet({ project, today, isNew, onSave, onDelete, onDeadlineToCalendar, onClose }: {
  project: Project
  today: Date
  isNew: boolean
  onSave: (project: Project) => void
  onDelete?: () => void
  onDeadlineToCalendar?: (project: Project) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState(project)
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function addToCalendar() {
    if (!onDeadlineToCalendar || !draft.deadlineOn) return
    setCalendarBusy(true)
    try {
      await onDeadlineToCalendar(draft)
    } finally {
      setCalendarBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.name.trim() || (draft.status !== 'done' && !draft.nextAction.trim())) return
    onSave(draft)
  }

  return (
    <>
    <Sheet title={isNew ? 'New project' : draft.name} eyebrow="Work" onClose={onClose}>
      <form className="simple-form" onSubmit={submit}>
        <label>Name<input autoFocus required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <div className="form-pair">
          <label>Type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Project['type'] })}>
            <option value="portfolio">Portfolio</option>
            <option value="internship">Internship</option>
            <option value="freelance">Freelance</option>
          </select></label>
          <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Project['status'] })}>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select></label>
        </div>
        <div className="form-pair">
          <label>Client<input value={draft.client} onChange={(event) => setDraft({ ...draft, client: event.target.value })} /></label>
          <label>Payment<select value={draft.paymentStatus} onChange={(event) => setDraft({ ...draft, paymentStatus: event.target.value as Project['paymentStatus'] })}><option value="na">N/A</option><option value="unpaid">Unpaid</option><option value="invoiced">Invoiced</option><option value="paid">Paid</option></select></label>
        </div>
        <div className="form-pair">
          <label>Amount<input type="number" min="0" inputMode="decimal" value={draft.amount ?? ''} onChange={(event) => setDraft({ ...draft, amount: event.target.value ? Number(event.target.value) : null })} /></label>
          <label>Currency<input maxLength={3} value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} /></label>
        </div>
        <div className="form-pair">
          <label>Deadline<input type="date" min={dateKey(today)} value={draft.deadlineOn ?? ''} onChange={(event) => setDraft({ ...draft, deadlineOn: event.target.value || null })} /></label>
          {onDeadlineToCalendar && (
            <button
              type="button"
              className="secondary-button calendar-push"
              disabled={!draft.deadlineOn || calendarBusy}
              onClick={addToCalendar}
            >
              {calendarBusy ? 'Adding…' : 'Deadline → Calendar'}
            </button>
          )}
        </div>
        <label className="check-row"><input type="checkbox" checked={draft.isPublic} onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })} />Public and recruiter-visible</label>
        <div className="form-pair">
          <label>Repository URL<input type="url" value={draft.repoUrl} onChange={(event) => setDraft({ ...draft, repoUrl: event.target.value })} /></label>
          <label>Demo URL<input type="url" value={draft.demoUrl} onChange={(event) => setDraft({ ...draft, demoUrl: event.target.value })} /></label>
        </div>
        <label>Drive folder URL<input type="url" value={draft.driveFolderUrl} onChange={(event) => setDraft({ ...draft, driveFolderUrl: event.target.value })} /></label>
        {draft.driveFolderUrl && <a className="secondary-button drive-link" href={draft.driveFolderUrl} target="_blank" rel="noreferrer">Open folder in Drive</a>}
        <label>Next action<input required={draft.status !== 'done'} value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} placeholder="The next physical action" /></label>
        <label>Project notes<textarea rows={5} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Decisions, experiments, datasets, metrics." /></label>
        <div className="form-actions form-actions-split">
          {onDelete && <button className="danger-button" type="button" onClick={() => setConfirmingDelete(true)}>Delete</button>}
          <button className="primary-button" type="submit"><span>{isNew ? 'Add project' : 'Save'}</span><Icon name="check" /></button>
        </div>
      </form>
    </Sheet>
    {confirmingDelete && onDelete && <ConfirmSheet title={`Delete ${draft.name}?`} detail="The project and its linked Calendar deadline will be removed." onClose={() => setConfirmingDelete(false)} onConfirm={onDelete} />}
    </>
  )
}

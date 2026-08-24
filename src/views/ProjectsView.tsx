import { useEffect, useState, type FormEvent } from 'react'
import type { Project } from '../types'
import { dateKey } from '../domain'
import { EmptyState, Icon, Sheet, ViewShell, uid } from '../ui'

interface Props {
  projects: Project[]
  today: Date
  createSignal?: number
  onSave: (project: Project) => void
  onDelete: (id: string) => void
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
    return { id: uid('project'), name: '', type: 'portfolio', status: 'active', deadlineOn: null, nextAction: '' }
  }

  return (
    <ViewShell
      eyebrow="Outer field · Work"
      title="Projects"
      aside={<button className="secondary-button" type="button" onClick={() => setCreating(true)}><Icon name="plus" /><span>Add project</span></button>}
    >
      <p className="portfolio-target portfolio-inline">
        <span>Public portfolio</span>
        <strong>{projects.filter((project) => project.status === 'done' && project.type === 'portfolio').length} / 3</strong>
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
          onSave={(next) => { onSave(next); setCreating(false); setEditing(null) }}
          onDelete={editing ? () => { onDelete(editing.id); setEditing(null) } : undefined}
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
    if (!draft.name.trim()) return
    onSave(draft)
  }

  return (
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
        <label>Next action<input value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} placeholder="The next physical action" /></label>
        <div className="form-actions form-actions-split">
          {onDelete && <button className="danger-button" type="button" onClick={onDelete}>Delete</button>}
          <button className="primary-button" type="submit"><span>{isNew ? 'Add project' : 'Save'}</span><Icon name="check" /></button>
        </div>
      </form>
    </Sheet>
  )
}

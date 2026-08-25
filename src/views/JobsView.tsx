import { useEffect, useState, type FormEvent } from 'react'
import type { ApplicationChannel, ApplicationStatus, JobApplication, Person } from '../types'
import { ConfirmSheet, EmptyState, Icon, Sheet, ViewShell, uid } from '../ui'
import { dateKey } from '../domain'

const statusLabel: Record<ApplicationStatus, string> = {
  researching: 'Researching', applied: 'Applied', oa: 'OA', phone: 'Phone',
  onsite: 'Onsite', offer: 'Offer', rejected: 'Rejected',
}
const channelLabel: Record<ApplicationChannel, string> = {
  india_product: 'India product', gcc: 'GCC', remote_intl: 'Remote intl', services: 'Services',
}

interface Props {
  applications: JobApplication[]
  people: Person[]
  today: Date
  createSignal?: number
  onSave: (app: JobApplication) => boolean
  onDelete: (id: string) => boolean
  onDeadlineToCalendar?: (app: JobApplication) => Promise<void>
}

export function JobsView({ applications, people, today, createSignal = 0, onSave, onDelete, onDeadlineToCalendar }: Props) {
  const [editing, setEditing] = useState<JobApplication | null>(null)
  const [creating, setCreating] = useState(false)
  useEffect(() => { if (createSignal > 0) setCreating(true) }, [createSignal])
  const sorted = [...applications].sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || (a.followUpOn ?? '9999').localeCompare(b.followUpOn ?? '9999'))
  const active = sorted.filter((app) => app.status !== 'offer' && app.status !== 'rejected')
  const archive = sorted.filter((app) => app.status === 'offer' || app.status === 'rejected')
  return (
    <ViewShell eyebrow="Outer field · Pipeline" title="Applications" aside={<button className="secondary-button" type="button" onClick={() => setCreating(true)}><Icon name="plus" /><span>Add application</span></button>}>
      {sorted.length === 0 ? <EmptyState message="No applications yet. Research one real opening." /> : <ApplicationList applications={active} onEdit={setEditing} />}
      {archive.length > 0 && <><div className="subsection-heading"><span>Archive</span><small>{archive.length}</small></div><ApplicationList applications={archive} onEdit={setEditing} /></>}
      {(creating || editing) && <ApplicationSheet today={today} people={people} existing={editing} onSave={(app) => { if (onSave(app)) { setCreating(false); setEditing(null) } }} onDelete={editing ? (id) => { if (onDelete(id)) setEditing(null) } : undefined} onDeadlineToCalendar={onDeadlineToCalendar} onClose={() => { setCreating(false); setEditing(null) }} />}
    </ViewShell>
  )
}

function ApplicationList({ applications, onEdit }: { applications: JobApplication[]; onEdit: (app: JobApplication) => void }) {
  return <div className="item-list">{applications.map((app) => (
    <article className="list-item" key={app.id}><button type="button" className="item-button" onClick={() => onEdit(app)}>
      <div className="item-main"><div><strong>{app.company}</strong><span>{app.role} · {channelLabel[app.channel]}</span></div><span className={`status-pill status-${app.status}`}>{statusLabel[app.status]}</span></div>
      <p>{app.nextAction || 'Terminal outcome recorded'}</p>
      <small>{app.followUpOn ? `Follow up ${app.followUpOn.slice(5)}` : app.appliedOn ? `Applied ${app.appliedOn.slice(5)}` : 'Researching'}</small>
    </button></article>
  ))}</div>
}

export function ApplicationSheet({ today, people, existing, onSave, onDelete, onDeadlineToCalendar, onClose }: {
  today: Date
  people: Person[]
  existing?: JobApplication | null
  onSave: (app: JobApplication) => void
  onDelete?: (id: string) => void
  onDeadlineToCalendar?: (app: JobApplication) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<JobApplication>(existing ?? blankApplication(today))
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const terminal = draft.status === 'offer' || draft.status === 'rejected'

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.company.trim() || !draft.role.trim() || (!terminal && !draft.nextAction.trim())) return
    onSave({
      ...draft,
      appliedOn: draft.status !== 'researching' && !draft.appliedOn ? dateKey(today) : draft.appliedOn,
      hasReferral: draft.hasReferral || Boolean(draft.referrerId),
    })
  }

  async function addToCalendar() {
    if (!onDeadlineToCalendar || !draft.windowClosesOn) return
    setCalendarBusy(true)
    try { await onDeadlineToCalendar(draft) } finally { setCalendarBusy(false) }
  }

  return (
    <>
      <Sheet title={existing ? draft.company : 'New application'} eyebrow={existing ? `${statusLabel[draft.status]} · ${draft.role}` : 'Job hunt'} onClose={onClose}>
        <form className="simple-form" onSubmit={submit}>
          <div className="form-pair"><Text label="Company" value={draft.company} required onChange={(company) => setDraft({ ...draft, company })} /><Text label="Role" value={draft.role} required onChange={(role) => setDraft({ ...draft, role })} /></div>
          <div className="form-pair">
            <label>Lane<select value={draft.lane} onChange={(event) => setDraft({ ...draft, lane: event.target.value as JobApplication['lane'] })}><option value="sde">SDE</option><option value="ai_ml">AI / ML</option></select></label>
            <label>Channel<select value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value as ApplicationChannel })}>{Object.entries(channelLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <div className="form-pair"><label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ApplicationStatus })}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>CTC (LPA)<input type="number" min="0" step="0.5" inputMode="decimal" value={draft.ctcLpa ?? ''} onChange={(event) => setDraft({ ...draft, ctcLpa: event.target.value ? Number(event.target.value) : null })} /></label></div>
          <div className="form-pair"><DateField label="Applied on" value={draft.appliedOn} onChange={(appliedOn) => setDraft({ ...draft, appliedOn })} /><DateField label="Window closes" value={draft.windowClosesOn} onChange={(windowClosesOn) => setDraft({ ...draft, windowClosesOn })} /></div>
          {onDeadlineToCalendar && <button type="button" className="secondary-button calendar-push" disabled={!draft.windowClosesOn || calendarBusy} onClick={addToCalendar}>{calendarBusy ? 'Adding…' : 'Window → Calendar'}</button>}
          <div className="form-pair"><DateField label="Follow up on" value={draft.followUpOn} onChange={(followUpOn) => setDraft({ ...draft, followUpOn })} /><label>Referrer<select value={draft.referrerId ?? ''} onChange={(event) => setDraft({ ...draft, referrerId: event.target.value || null, hasReferral: Boolean(event.target.value) || draft.hasReferral })}><option value="">—</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div>
          <label className="check-row"><input type="checkbox" checked={draft.hasReferral} onChange={(event) => setDraft({ ...draft, hasReferral: event.target.checked })} />Referral secured</label>
          <Text label="Job link" type="url" value={draft.jobUrl} onChange={(jobUrl) => setDraft({ ...draft, jobUrl })} />
          <div className="form-pair"><Text label="Resume version" value={draft.resumeVersion} onChange={(resumeVersion) => setDraft({ ...draft, resumeVersion })} /><Text label="Resume Drive URL" type="url" value={draft.resumeDriveUrl} onChange={(resumeDriveUrl) => setDraft({ ...draft, resumeDriveUrl })} /></div>
          {draft.resumeDriveUrl && <a className="secondary-button drive-link" href={draft.resumeDriveUrl} target="_blank" rel="noreferrer">Open resume in Drive</a>}
          <Text label="Next action" value={draft.nextAction} required={!terminal} onChange={(nextAction) => setDraft({ ...draft, nextAction })} />
          <label>Notes<textarea rows={4} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          <div className="form-actions form-actions-split">{existing && onDelete && <button className="danger-button" type="button" onClick={() => setConfirmingDelete(true)}>Delete</button>}<button className="primary-button" type="submit"><span>{existing ? 'Save' : 'Add application'}</span><Icon name="check" /></button></div>
        </form>
      </Sheet>
      {confirmingDelete && onDelete && <ConfirmSheet title={`Delete ${draft.company}?`} detail="The application and its linked Calendar deadline will be removed." onClose={() => setConfirmingDelete(false)} onConfirm={() => onDelete(draft.id)} />}
    </>
  )
}

function blankApplication(today: Date): JobApplication {
  return { id: uid(), company: '', role: '', lane: 'sde', channel: 'india_product', status: 'researching', windowClosesOn: null, appliedOn: null, followUpOn: dateKey(today), hasReferral: false, ctcLpa: null, referrerId: null, jobUrl: '', resumeVersion: 'v1', resumeDriveUrl: '', nextAction: '', notes: '' }
}
function statusOrder(status: ApplicationStatus) { return ['researching', 'applied', 'oa', 'phone', 'onsite', 'offer', 'rejected'].indexOf(status) }
function Text({ label, value, onChange, required = false, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) { return <label>{label}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) { return <label>{label}<input type="date" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} /></label> }

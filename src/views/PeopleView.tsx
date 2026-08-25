import { useState, type FormEvent } from 'react'
import type { Person } from '../types'
import { dateKey } from '../domain'
import { ConfirmSheet, EmptyState, Icon, Sheet, ViewShell, uid } from '../ui'

const statusLabels: Record<Person['status'], string> = {
  to_reach_out: 'To reach out',
  talking: 'Talking',
  referred: 'Referred',
  cold: 'Cold',
}

interface Props {
  people: Person[]
  today: Date
  onSave: (person: Person) => boolean
  onDelete: (id: string) => boolean
}

export function PeopleView({ people, today, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<Person | null>(null)
  const [creating, setCreating] = useState(false)

  const sorted = [...people].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'to_reach_out' ? -1 : b.status === 'to_reach_out' ? 1 : 0
    return (a.nextFollowUpOn ?? '9999').localeCompare(b.nextFollowUpOn ?? '9999')
  })

  function blankPerson(): Person {
    return { id: uid(), name: '', company: '', email: '', linkedinUrl: '', howKnown: null, status: 'to_reach_out', lastContactOn: null, nextFollowUpOn: dateKey(today), notes: '' }
  }

  return (
    <ViewShell
      eyebrow="Outer field · Referrals"
      title="People"
      aside={<button className="secondary-button" type="button" onClick={() => setCreating(true)}><Icon name="plus" /><span>Add person</span></button>}
    >
      {sorted.length === 0 ? (
        <EmptyState message="No people yet. Referrals move applications." />
      ) : (
        <div className="item-list">
          {sorted.map((person) => (
            <article className="list-item" key={person.id}>
              <button type="button" className="item-button" onClick={() => setEditing(person)}>
                <div className="item-main">
                  <div><strong>{person.name}</strong><span>{person.company}</span></div>
                  <span className={`status-pill person-${person.status}`}>{statusLabels[person.status]}</span>
                </div>
                {person.nextFollowUpOn && (
                  <time dateTime={person.nextFollowUpOn}>Follow up {person.nextFollowUpOn.slice(5)}</time>
                )}
              </button>
            </article>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PeopleSheet
          person={editing ?? blankPerson()}
          isNew={!editing}
          onSave={(next) => { if (onSave(next)) { setCreating(false); setEditing(null) } }}
          onDelete={editing ? () => { if (onDelete(editing.id)) setEditing(null) } : undefined}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}
    </ViewShell>
  )
}

function PeopleSheet({ person, isNew, onSave, onDelete, onClose }: {
  person: Person
  isNew: boolean
  onSave: (person: Person) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(person)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.name.trim()) return
    onSave(draft)
  }

  return (
    <>
    <Sheet title={isNew ? 'New person' : draft.name} eyebrow="Referral network" onClose={onClose}>
      <form className="simple-form" onSubmit={submit}>
        <label>Name<input autoFocus required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <div className="form-pair">
          <label>Company<input value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} /></label>
          <label>Follow up on<input type="date" value={draft.nextFollowUpOn ?? ''} onChange={(event) => setDraft({ ...draft, nextFollowUpOn: event.target.value || null })} /></label>
        </div>
        <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Person['status'] })}>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <div className="form-pair">
          <label>Email<input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
          <label>LinkedIn URL<input type="url" value={draft.linkedinUrl} onChange={(event) => setDraft({ ...draft, linkedinUrl: event.target.value })} /></label>
        </div>
        <div className="form-pair">
          <label>How known<select value={draft.howKnown ?? ''} onChange={(event) => setDraft({ ...draft, howKnown: event.target.value ? event.target.value as Person['howKnown'] : null })}><option value="">—</option><option value="cold">Cold</option><option value="alumni">Alumni</option><option value="linkedin">LinkedIn</option><option value="ex_colleague">Ex-colleague</option><option value="referred_by">Referred by</option></select></label>
          <label>Last contact<input type="date" value={draft.lastContactOn ?? ''} onChange={(event) => setDraft({ ...draft, lastContactOn: event.target.value || null })} /></label>
        </div>
        <label>Notes<textarea rows={4} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
        <div className="form-actions form-actions-split">
          {onDelete && <button className="danger-button" type="button" onClick={() => setConfirmingDelete(true)}>Delete</button>}
          <button className="primary-button" type="submit"><span>{isNew ? 'Add person' : 'Save'}</span><Icon name="check" /></button>
        </div>
      </form>
    </Sheet>
    {confirmingDelete && onDelete && <ConfirmSheet title={`Delete ${draft.name}?`} detail="Applications will keep their history, but this person will no longer be linked as a referrer." onClose={() => setConfirmingDelete(false)} onConfirm={onDelete} />}
    </>
  )
}

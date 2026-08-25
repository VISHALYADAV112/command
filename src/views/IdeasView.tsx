import { useEffect, useState, type FormEvent } from 'react'
import type { Idea, IdeaStatus } from '../types'
import { ConfirmSheet, EmptyState, Icon, Sheet, ViewShell, uid } from '../ui'

const statusLabels: Record<IdeaStatus, string> = {
  captured: 'Captured',
  exploring: 'Exploring',
  validating: 'Validating',
  dropped: 'Dropped',
}

const nextStatus: Record<IdeaStatus, IdeaStatus> = {
  captured: 'exploring',
  exploring: 'validating',
  validating: 'dropped',
  dropped: 'captured',
}

interface Props {
  ideas: Idea[]
  createSignal?: number
  onSave: (idea: Idea) => boolean
  onDelete: (id: string) => boolean
}

export function IdeasView({ ideas, createSignal = 0, onSave, onDelete }: Props) {
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Idea | null>(null)

  useEffect(() => {
    if (createSignal > 0) setCreating(true)
  }, [createSignal])

  const active = ideas.filter((idea) => idea.status !== 'dropped')
  const dropped = ideas.filter((idea) => idea.status === 'dropped')

  return (
    <ViewShell
      eyebrow="Off-page · Capture only"
      title="Ideas"
      aside={<button className="secondary-button" type="button" onClick={() => setCreating(true)}><Icon name="plus" /><span>Capture</span></button>}
    >
      <p className="view-hint">Capture and close. Sunday decides what earns a week — one promotion maximum.</p>
      {active.length === 0 ? (
        <EmptyState message="Nothing captured. The space stays empty until an idea earns its place." />
      ) : (
        <div className="item-list">
          {active.map((idea) => (
            <article className="list-item idea-item" key={idea.id}>
              <div className="item-main">
                <div><strong>{idea.idea}</strong></div>
                <span className={`status-pill idea-${idea.status}`}>{statusLabels[idea.status]}</span>
              </div>
              {idea.nextAction && <p>{idea.nextAction}</p>}
              <div className="idea-actions">
                <button type="button" className="secondary-button" onClick={() => onSave({ ...idea, status: nextStatus[idea.status] })}>
                  {idea.status === 'validating' ? 'Drop' : `→ ${statusLabels[nextStatus[idea.status]]}`}
                </button>
                <button type="button" className="danger-button danger-quiet" onClick={() => setDeleting(idea)} aria-label={`Delete ${idea.idea}`}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {dropped.length > 0 && (
        <>
          <div className="subsection-heading"><span>Dropped</span><small>{dropped.length}</small></div>
          <div className="idea-graveyard">
            {dropped.map((idea) => (
              <div key={idea.id}><span>{idea.idea}</span><button type="button" onClick={() => onSave({ ...idea, status: 'captured' })}>Revive</button></div>
            ))}
          </div>
        </>
      )}

      {creating && (
        <IdeaSheet
          onSave={(idea) => { if (onSave(idea)) setCreating(false) }}
          onClose={() => setCreating(false)}
        />
      )}
      {deleting && <ConfirmSheet title="Delete this idea?" detail={deleting.idea} onClose={() => setDeleting(null)} onConfirm={() => { if (onDelete(deleting.id)) setDeleting(null) }} />}
    </ViewShell>
  )
}

function IdeaSheet({ onSave, onClose }: { onSave: (idea: Idea) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const [problem, setProblem] = useState('')
  const [targetMarket, setTargetMarket] = useState('')
  const [monetization, setMonetization] = useState('')
  const [nextAction, setNextAction] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    onSave({ id: uid(), idea: text.trim(), problem: problem.trim(), targetMarket: targetMarket.trim(), monetization: monetization.trim(), status: 'captured', nextAction: nextAction.trim() })
  }

  return (
    <Sheet title="Capture an idea" eyebrow="One line is enough" onClose={onClose}>
      <form className="simple-form" onSubmit={submit}>
        <label>Idea<textarea autoFocus required rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder="What's the itch?" /></label>
        <label>Problem<textarea rows={3} value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="Who has it, and how much does it hurt?" /></label>
        <div className="form-pair">
          <label>Target market<input value={targetMarket} onChange={(event) => setTargetMarket(event.target.value)} /></label>
          <label>Monetization<input value={monetization} onChange={(event) => setMonetization(event.target.value)} /></label>
        </div>
        <label>First action<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Smallest next step (optional)" /></label>
        <div className="form-actions"><button className="primary-button" type="submit"><span>Capture</span><Icon name="plus" /></button></div>
      </form>
    </Sheet>
  )
}

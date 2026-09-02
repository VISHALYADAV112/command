import { useEffect, useState, type FormEvent } from 'react'
import type { Commitment, Entity, EntityType, OutcomeSubmission, Recall } from '../types'
import { Icon, Sheet, uid } from '../ui'
import { behaviourPlugin } from '../v3Plugins'

interface ScheduleDraft {
  kind: Commitment['kind']
  action: string
  dueOn: string
}

export function ScheduleSheet({ entity, type, existing, onSave, onClose }: {
  entity: Entity
  type: EntityType
  existing?: Commitment | null
  onSave: (commitment: Commitment) => boolean
  onClose: () => void
}) {
  const key = `command.draft.schedule.${existing?.id ?? entity.id}`
  const [draft, setDraft] = useState(() => readScheduleDraft(key, entity, type, existing))
  const [error, setError] = useState('')
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(draft)) } catch { /* draft is best-effort */ } }, [draft, key])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.action.trim() || !draft.dueOn || !draft.kind) return setError('Kind, action, and due date are required.')
    const commitment: Commitment = {
      id: existing?.id ?? uid(), entityId: entity.id, kind: draft.kind, action: draft.action.trim(), dueOn: draft.dueOn,
      state: existing?.state ?? 'open', outcome: existing?.outcome ?? null, completedAt: existing?.completedAt ?? null,
      originSource: existing?.originSource ?? 'ui',
    }
    if (!onSave(commitment)) return
    try { localStorage.removeItem(key) } catch { /* draft is best-effort */ }
    onClose()
  }

  return <Sheet title={existing ? 'Reschedule commitment' : 'Schedule commitment'} eyebrow={type.singularName} onClose={onClose}>
    <form className="simple-form" onSubmit={submit}>
      <label>Kind<select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as Commitment['kind'] }))}>{type.allowedCommitmentKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
      <label>Action<input value={draft.action} onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value }))} /></label>
      <label>Due on<input type="date" value={draft.dueOn} onChange={(event) => setDraft((current) => ({ ...current, dueOn: event.target.value }))} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="primary-button" type="submit"><span>Save schedule</span><Icon name="check" /></button></div>
    </form>
  </Sheet>
}

export function OutcomeSheet({ commitment, entity, type, onSave, onClose }: {
  commitment: Commitment
  entity: Entity
  type: EntityType
  onSave: (submission: OutcomeSubmission) => boolean
  onClose: () => void
}) {
  const key = `command.draft.outcome.${commitment.id}`
  const [savedDraft] = useState(() => readOutcomeDraft(key))
  const [outcome, setOutcome] = useState(savedDraft.outcome)
  const [state, setState] = useState<'completed' | 'cancelled'>(savedDraft.state)
  const [recall, setRecall] = useState<Recall>(savedDraft.recall)
  const [completedAt] = useState(() => new Date())
  const plugin = behaviourPlugin(type.pluginKey)
  const supportsRecall = plugin?.validate(type, entity, commitment) === true
  const plan = supportsRecall ? plugin.schedule(entity, recall, completedAt) : null
  const [nextDueOn, setNextDueOn] = useState(savedDraft.nextDueOn || plan?.suggestedNextOn || '')
  const [error, setError] = useState('')
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify({ outcome, state, recall, nextDueOn })) } catch { /* draft is best-effort */ } }, [key, nextDueOn, outcome, recall, state])

  function chooseRecall(value: Recall) {
    setRecall(value)
    setNextDueOn(plugin?.schedule(entity, value, completedAt).suggestedNextOn ?? '')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!outcome.trim()) return setError('Record what happened before closing this commitment.')
    if (state === 'completed' && plan?.suggestedNextOn && !nextDueOn) return setError('Choose the next review date.')
    const next: Commitment = {
      ...commitment,
      state,
      outcome: outcome.trim(),
      completedAt: state === 'completed' ? completedAt.toISOString() : null,
    }
    const nextCommitment = state === 'completed' && plan?.suggestedNextOn ? {
      id: uid(), entityId: entity.id, kind: 'review' as const, action: commitment.action,
      dueOn: nextDueOn, state: 'open' as const, outcome: null, completedAt: null,
      originSource: 'ui' as const,
    } : null
    if (!onSave({
      commitment: next,
      recall: state === 'completed' && plan ? recall : null,
      entity: state === 'completed' && plan ? plan.entity : null,
      nextCommitment,
    })) return
    try { localStorage.removeItem(key) } catch { /* draft is best-effort */ }
    onClose()
  }

  return <Sheet title="Record outcome" eyebrow={commitment.kind} onClose={onClose}>
    <form className="simple-form" onSubmit={submit}>
      <p className="outcome-action">{commitment.action}</p>
      <label>What happened?<textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="A concise outcome keeps the history useful." /></label>
      <label>Close as<select value={state} onChange={(event) => setState(event.target.value as 'completed' | 'cancelled')}><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      {supportsRecall && state === 'completed' && <fieldset className="plugin-outcome"><legend>Recall</legend>
        <label>How did recall feel?<select value={recall} onChange={(event) => chooseRecall(event.target.value as Recall)}><option value="instant">Instant</option><option value="effort">With effort</option><option value="struggled">Struggled</option><option value="blank">Blank</option></select></label>
        {plan?.suggestedNextOn ? <label>Next review<input type="date" min={plan.reviewedOn} value={nextDueOn} onChange={(event) => setNextDueOn(event.target.value)} /><small>Suggested {plan.suggestedNextOn}; adjust it before saving if needed.</small></label> : <p className="settings-status">Mastered after this recall. No follow-on review will be created.</p>}
      </fieldset>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="primary-button" type="submit"><span>Save outcome</span><Icon name="check" /></button></div>
    </form>
  </Sheet>
}

function readScheduleDraft(key: string, entity: Entity, type: EntityType, existing?: Commitment | null): ScheduleDraft {
  const fallback: ScheduleDraft = {
    kind: existing?.kind ?? type.allowedCommitmentKinds[0] ?? 'follow-up',
    action: existing?.action ?? entity.title,
    dueOn: existing?.dueOn ?? '',
  }
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<ScheduleDraft> } } catch { return fallback }
}

function readOutcomeDraft(key: string): { outcome: string; state: 'completed' | 'cancelled'; recall: Recall; nextDueOn: string } {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}') as { outcome?: string; state?: string; recall?: string; nextDueOn?: string }
    const recall = ['instant', 'effort', 'struggled', 'blank'].includes(parsed.recall ?? '') ? parsed.recall as Recall : 'effort'
    return { outcome: parsed.outcome ?? '', state: parsed.state === 'cancelled' ? 'cancelled' : 'completed', recall, nextDueOn: parsed.nextDueOn ?? '' }
  } catch { return { outcome: '', state: 'completed', recall: 'effort', nextDueOn: '' } }
}

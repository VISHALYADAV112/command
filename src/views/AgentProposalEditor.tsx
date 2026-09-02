import { useState, type FormEvent } from 'react'
import type { AgentProposal, EntityFieldValue, EntityType } from '../types'
import type { AgentProposalDecision } from '../lib/api'

export function AgentProposalEditor({ proposal, type, busy, onSave, onCancel }: {
  proposal: AgentProposal
  type: EntityType
  busy: boolean
  onSave: (payload: Pick<AgentProposalDecision, 'entityPayload' | 'commitmentPayload'>) => void
  onCancel: () => void
}) {
  const entity = proposal.proposedEntity ?? {}
  const commitment = proposal.proposedCommitment ?? {}
  const [title, setTitle] = useState(String(entity.title ?? ''))
  const [fields, setFields] = useState<Record<string, EntityFieldValue>>(() => proposalFields(type, entity.fields))
  const [kind, setKind] = useState(String(commitment.kind ?? type.allowedCommitmentKinds[0] ?? ''))
  const [action, setAction] = useState(String(commitment.action ?? ''))
  const [dueOn, setDueOn] = useState(String(commitment.due_on ?? ''))
  const [outcome, setOutcome] = useState(String(commitment.outcome ?? ''))
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (proposal.operation === 'capture') {
      const missing = type.fields.find((field) => field.required && !field.deprecated
        && (fields[field.key] == null || fields[field.key] === ''))
      if (!title.trim() || missing) return setError(missing ? `${missing.label} is required.` : 'Title is required.')
      onSave({ entityPayload: { id: entity.id, title: title.trim(), fields, schema_version: type.schemaVersion } })
      return
    }
    if (proposal.operation === 'schedule') {
      if (!kind || !action.trim() || !dueOn) return setError('Kind, action, and due date are required.')
      onSave({ commitmentPayload: { id: commitment.id, kind, action: action.trim(), due_on: dueOn } })
      return
    }
    if (!outcome.trim()) return setError('An outcome is required.')
    onSave({ commitmentPayload: { outcome: outcome.trim() } })
  }

  return <form className="agent-editor simple-form" onSubmit={submit}>
    {proposal.operation === 'capture' && <>
      <label>Title<input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></label>
      <div className="entity-field-grid">{type.fields.filter((field) => !field.deprecated).map((field) => <ProposalField
        key={field.key} field={field} value={fields[field.key]}
        onChange={(value) => setFields((current) => ({ ...current, [field.key]: value }))}
      />)}</div>
    </>}
    {proposal.operation === 'schedule' && <>
      <label>Kind<select value={kind} onChange={(event) => setKind(event.target.value)}>{type.allowedCommitmentKinds.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Action<input value={action} maxLength={500} onChange={(event) => setAction(event.target.value)} /></label>
      <label>Due on<input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label>
    </>}
    {proposal.operation === 'complete' && <label>Outcome<textarea value={outcome} maxLength={5000} onChange={(event) => setOutcome(event.target.value)} /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions form-actions-split">
      <button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>Cancel edit</button>
      <button className="primary-button" type="submit" disabled={busy}><span>{busy ? 'Applying…' : 'Approve edited proposal'}</span></button>
    </div>
  </form>
}

function ProposalField({ field, value, onChange }: {
  field: EntityType['fields'][number]
  value: EntityFieldValue | undefined
  onChange: (value: EntityFieldValue) => void
}) {
  const label = <>{field.label}{field.required ? ' *' : ''}</>
  if (field.kind === 'textarea') return <label>{label}<textarea value={String(value ?? '')} maxLength={10_000} onChange={(event) => onChange(event.target.value)} /></label>
  if (field.kind === 'boolean') return <label className="check-row"><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />{label}</label>
  if (field.kind === 'single_select') return <label>{label}<select value={String(value ?? '')} onChange={(event) => onChange(event.target.value || null)}><option value="">Not set</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
  const maxLength = field.kind === 'text' ? 500 : field.kind === 'url' ? 2000 : undefined
  return <label>{label}<input type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : field.kind === 'url' ? 'url' : 'text'} maxLength={maxLength} value={String(value ?? '')} onChange={(event) => onChange(field.kind === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value)} /></label>
}

function proposalFields(type: EntityType, value: unknown): Record<string, EntityFieldValue> {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, EntityFieldValue> : {}
  return Object.fromEntries(type.fields.map((field) => [
    field.key, source[field.key] ?? (field.kind === 'boolean' ? false : null),
  ]))
}

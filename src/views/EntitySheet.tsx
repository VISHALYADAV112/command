import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Commitment, Entity, EntityFieldValue, EntityType } from '../types'
import { Icon, Sheet, uid } from '../ui'

interface EntityDraft {
  typeId: string
  title: string
  fields: Record<string, EntityFieldValue>
  addCommitment: boolean
  commitmentKind: Commitment['kind'] | ''
  commitmentAction: string
  commitmentDueOn: string
}

export function EntitySheet({
  types, existing, initialTypeKey, onSave, onClose,
}: {
  types: EntityType[]
  existing?: Entity | null
  initialTypeKey?: string | null
  onSave: (entity: Entity, firstCommitment: Commitment | null) => boolean
  onClose: () => void
}) {
  const initialType = existing
    ? types.find((type) => type.id === existing.entityTypeId)
    : types.find((type) => type.typeKey === initialTypeKey) ?? types[0]
  const [draft, setDraft] = useState<EntityDraft>(() => loadDraft(existing, initialType))
  const [error, setError] = useState('')
  const type = useMemo(() => types.find((item) => item.id === draft.typeId) ?? initialType, [draft.typeId, initialType, types])

  useEffect(() => {
    if (!type) return
    try { localStorage.setItem(draftKey(existing, type.id), JSON.stringify(draft)) } catch { /* drafts are best-effort */ }
  }, [draft, existing, type])

  if (!type) return null
  const activeType: EntityType = type

  function chooseType(typeId: string) {
    const next = types.find((item) => item.id === typeId)
    if (!next) return
    setError('')
    setDraft(loadDraft(null, next))
  }

  function setField(key: string, value: EntityFieldValue) {
    setDraft((current) => ({ ...current, fields: { ...current.fields, [key]: value } }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.title.trim()) return setError('Title is required.')
    const missing = activeType.fields.find((field) => field.required && (draft.fields[field.key] === null || draft.fields[field.key] === undefined || draft.fields[field.key] === ''))
    if (missing) return setError(`${missing.label} is required.`)
    if (draft.addCommitment && (!draft.commitmentKind || !draft.commitmentDueOn || !draft.commitmentAction.trim())) {
      return setError('A kind, action, and due date are required for the first commitment.')
    }
    const entity: Entity = {
      id: existing?.id ?? uid(),
      entityTypeId: activeType.id,
      title: draft.title.trim(),
      fields: draft.fields,
      schemaVersion: activeType.schemaVersion,
      archivedAt: existing?.archivedAt ?? null,
    }
    const firstCommitment = draft.addCommitment ? {
      id: uid(), entityId: entity.id, kind: draft.commitmentKind as Commitment['kind'],
      action: draft.commitmentAction.trim(), dueOn: draft.commitmentDueOn, state: 'open' as const,
      outcome: null, completedAt: null, originSource: 'ui' as const,
    } : null
    if (!onSave(entity, firstCommitment)) return
    try { localStorage.removeItem(draftKey(existing, activeType.id)) } catch { /* drafts are best-effort */ }
    onClose()
  }

  return (
    <Sheet title={existing ? `Edit ${activeType.singularName}` : `Capture ${activeType.singularName}`} eyebrow={existing ? 'Canonical record' : 'New canonical record'} onClose={onClose}>
      <form className="simple-form entity-form" onSubmit={submit}>
        {!existing && <label>Type<select aria-label="Type" value={activeType.id} onChange={(event) => chooseType(event.target.value)}>{types.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.singularName}</option>)}</select></label>}
        <label>Title<input aria-label="Title" value={draft.title} maxLength={200} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
        <div className="entity-field-grid">
          {activeType.fields.filter((field) => !field.deprecated).map((field) => <EntityField key={field.key} field={field} value={draft.fields[field.key]} onChange={(value) => setField(field.key, value)} />)}
        </div>
        {!existing && activeType.allowedCommitmentKinds.length > 0 && <fieldset className="first-commitment"><legend>First commitment</legend>
          <label className="check-row"><input type="checkbox" checked={draft.addCommitment} onChange={(event) => setDraft((current) => ({ ...current, addCommitment: event.target.checked }))} />Schedule this record now</label>
          {draft.addCommitment && <div className="form-pair">
            <label>Kind<select aria-label="Commitment kind" value={draft.commitmentKind} onChange={(event) => setDraft((current) => ({ ...current, commitmentKind: event.target.value as Commitment['kind'] }))}>{activeType.allowedCommitmentKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
            <label>Due on<input aria-label="Due on" type="date" value={draft.commitmentDueOn} onChange={(event) => setDraft((current) => ({ ...current, commitmentDueOn: event.target.value }))} /></label>
            <label className="wide-field">Action<input aria-label="Commitment action" value={draft.commitmentAction} onChange={(event) => setDraft((current) => ({ ...current, commitmentAction: event.target.value }))} /></label>
          </div>}
        </fieldset>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button className="primary-button" type="submit"><span>{existing ? 'Save changes' : 'Capture record'}</span><Icon name="check" /></button></div>
      </form>
    </Sheet>
  )
}

function EntityField({ field, value, onChange }: {
  field: EntityType['fields'][number]
  value: EntityFieldValue | undefined
  onChange: (value: EntityFieldValue) => void
}) {
  const label = <>{field.label}{field.required ? ' *' : ''}</>
  if (field.kind === 'textarea') return <label>{label}<textarea value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></label>
  if (field.kind === 'boolean') return <label className="check-row"><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />{label}</label>
  if (field.kind === 'single_select') return <label>{label}<select value={String(value ?? '')} onChange={(event) => onChange(event.target.value || null)}><option value="">Not set</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
  return <label>{label}<input type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : field.kind === 'url' ? 'url' : 'text'} value={String(value ?? '')} onChange={(event) => onChange(field.kind === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value)} /></label>
}

function loadDraft(existing: Entity | null | undefined, type: EntityType | undefined): EntityDraft {
  if (!type) return { typeId: '', title: '', fields: {}, addCommitment: false, commitmentKind: '', commitmentAction: '', commitmentDueOn: '' }
  const fallback: EntityDraft = {
    typeId: type.id,
    title: existing?.title ?? '',
    fields: existing?.fields ?? Object.fromEntries(type.fields.map((field) => [field.key, field.kind === 'boolean' ? false : null])),
    addCommitment: false,
    commitmentKind: type.allowedCommitmentKinds[0] ?? '',
    commitmentAction: '',
    commitmentDueOn: '',
  }
  try {
    const stored = localStorage.getItem(draftKey(existing, type.id))
    return stored ? { ...fallback, ...JSON.parse(stored) as Partial<EntityDraft> } : fallback
  } catch { return fallback }
}

function draftKey(existing: Entity | null | undefined, typeId: string): string {
  return existing ? `command.draft.entity.${existing.id}` : `command.draft.capture.${typeId}`
}

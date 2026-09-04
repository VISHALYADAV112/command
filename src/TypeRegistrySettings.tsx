import { useState, type FormEvent } from 'react'
import type { CommitmentKind, EntityFieldDefinition, EntityFieldKind, EntityType } from './types'
import { Sheet, uid } from './ui'
import { BEHAVIOUR_PLUGIN_LABELS, validSpacedRepetitionType } from './v3Plugins'

const FIELD_KINDS: EntityFieldKind[] = ['text', 'textarea', 'number', 'boolean', 'date', 'url', 'single_select']
const COMMITMENT_KINDS: CommitmentKind[] = ['follow-up', 'deadline', 'review', 'contact', 'drill', 'milestone']

export function TypeRegistrySettings({ types, onSave }: {
  types: EntityType[]
  onSave: (type: EntityType) => boolean
}) {
  const [editing, setEditing] = useState<{ type: EntityType; original: EntityType | null } | null>(null)

  function createType() {
    setEditing({
      original: null,
      type: {
        id: uid(), typeKey: '', singularName: '', pluralName: '', iconKey: 'generic', schemaVersion: 1,
        fields: [], defaultSortField: 'updated_at', defaultSortDirection: 'desc', groupByField: null,
        allowedCommitmentKinds: [], pluginKey: null, isActive: true,
      },
    })
  }

  return <>
    <div className="prefs-registry">
      {types.map((type) => <button className="prefs-record" type="button" key={type.id} onClick={() => setEditing({ type: structuredClone(type), original: type })}>
        <span className="prefs-record-head"><span>{type.pluralName}</span><em>{type.fields.filter((field) => !field.deprecated).length} fields · {type.typeKey}{type.isActive ? '' : ' · disabled'}</em></span>
        <span className="prefs-record-schema">{type.fields.filter((field) => !field.deprecated).map((field) => `${field.label} (${field.kind})`).join(' · ')}</span>
        <span className="prefs-record-kinds">Actions: {type.allowedCommitmentKinds.join(', ') || 'none'}{type.pluginKey ? ` · ${BEHAVIOUR_PLUGIN_LABELS[type.pluginKey]}` : ''}</span>
      </button>)}
      <div className="prefs-record-actions"><button className="secondary-button" type="button" onClick={createType}>Create data type</button></div>
    </div>
    {editing && <EntityTypeSheet value={editing.type} original={editing.original} onSave={onSave} onClose={() => setEditing(null)} />}
  </>
}

function EntityTypeSheet({ value, original, onSave, onClose }: {
  value: EntityType
  original: EntityType | null
  onSave: (type: EntityType) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  const originalFields = new Map((original?.fields ?? []).map((field) => [field.key, field]))
  const activeFields = draft.fields.filter((field) => !field.deprecated)

  function updateField(index: number, patch: Partial<EntityFieldDefinition>) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? normalizeField({ ...field, ...patch }) : field),
    }))
  }

  function addField() {
    setDraft((current) => ({
      ...current,
      fields: [...current.fields, {
        key: nextFieldKey(current.fields), label: 'New field', kind: 'text', required: false,
        listVisible: false, filterable: false, deprecated: false, options: [],
      }],
    }))
  }

  function removeField(index: number) {
    const field = draft.fields[index]
    if (originalFields.has(field.key)) return
    setDraft((current) => ({ ...current, fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index) }))
  }

  function toggleCommitment(kind: CommitmentKind, checked: boolean) {
    setDraft((current) => ({
      ...current,
      allowedCommitmentKinds: checked
        ? [...current.allowedCommitmentKinds, kind]
        : current.allowedCommitmentKinds.filter((item) => item !== kind),
    }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const typeKey = draft.typeKey.trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(typeKey)) return setError('Type key must start with a letter and use lowercase letters, numbers, or underscores.')
    if (!draft.singularName.trim() || !draft.pluralName.trim()) return setError('Singular and plural names are required.')
    if (draft.singularName.trim().length > 80 || draft.pluralName.trim().length > 80) return setError('Type names must be 80 characters or fewer.')
    if (draft.fields.length > 50) return setError('A type can have at most 50 fields.')
    const keys = draft.fields.map((field) => field.key)
    if (keys.some((key) => !/^[a-z][a-z0-9_]{0,62}$/.test(key)) || new Set(keys).size !== keys.length) return setError('Field keys must be unique lowercase identifiers.')
    if (draft.fields.some((field) => !field.label.trim() || field.label.trim().length > 80)) return setError('Every field needs a label of 80 characters or fewer.')
    if (draft.fields.some((field) => field.kind === 'single_select' && (field.options.length === 0 || field.options.length > 100 || field.options.some((option) => option.length > 100)))) return setError('Select fields need 1–100 unique options of 100 characters or fewer.')
    const activeKeys = new Set(draft.fields.filter((field) => !field.deprecated).map((field) => field.key))
    if (!['title', 'created_at', 'updated_at'].includes(draft.defaultSortField) && !activeKeys.has(draft.defaultSortField)) return setError('Sort by must use an active field.')
    if (draft.groupByField && !activeKeys.has(draft.groupByField)) return setError('Group by must use an active field.')
    const fieldsChanged = original !== null && JSON.stringify(draft.fields) !== JSON.stringify(original.fields)
    const next = {
      ...draft,
      typeKey,
      singularName: draft.singularName.trim(),
      pluralName: draft.pluralName.trim(),
      schemaVersion: original ? original.schemaVersion + (fieldsChanged ? 1 : 0) : 1,
    }
    if (next.pluginKey === 'spaced_repetition' && !validSpacedRepetitionType(next)) return setError('Spaced repetition requires review plus active confidence, mastery_hits, and last_reviewed_on fields.')
    if (!onSave(next)) return
    onClose()
  }

  return <Sheet title={original ? `Edit ${original.singularName}` : 'Create data type'} eyebrow="Type registry" onClose={onClose}>
    <form className="simple-form type-editor" onSubmit={submit}>
      <div className="form-pair">
        <label>Type key<input value={draft.typeKey} disabled={Boolean(original)} onChange={(event) => setDraft({ ...draft, typeKey: event.target.value })} /></label>
        <label>Icon<select value={draft.iconKey} onChange={(event) => setDraft({ ...draft, iconKey: event.target.value as EntityType['iconKey'] })}>{['generic', 'application', 'person', 'project', 'learning', 'note'].map((icon) => <option key={icon}>{icon}</option>)}</select></label>
        <label>Singular name<input maxLength={80} value={draft.singularName} onChange={(event) => setDraft({ ...draft, singularName: event.target.value })} /></label>
        <label>Plural name<input maxLength={80} value={draft.pluralName} onChange={(event) => setDraft({ ...draft, pluralName: event.target.value })} /></label>
      </div>

      <fieldset><legend>Fields · schema v{original ? original.schemaVersion : 1}</legend>
        <div className="type-fields">{draft.fields.map((field, index) => {
          const permanent = originalFields.get(field.key)
          return <div className="type-field" key={`${field.key}-${index}`}>
            <div className="form-pair">
              <label>Key<input value={field.key} disabled={Boolean(permanent)} onChange={(event) => updateField(index, { key: event.target.value.trim().toLowerCase().replace(/[\s-]+/g, '_') })} /></label>
              <label>Kind<select value={field.kind} disabled={Boolean(permanent)} onChange={(event) => updateField(index, { kind: event.target.value as EntityFieldKind })}>{FIELD_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select></label>
              <label className="wide-field">Label<input maxLength={80} value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} /></label>
              {field.kind === 'single_select' && <label className="wide-field">Options<input value={field.options.join(', ')} onChange={(event) => updateField(index, { options: uniqueOptions(event.target.value) })} placeholder="one, two, three" /></label>}
            </div>
            <div className="field-flags">
              <label className="check-row"><input type="checkbox" checked={field.required} disabled={field.deprecated} onChange={(event) => updateField(index, { required: event.target.checked })} />Required</label>
              <label className="check-row"><input type="checkbox" checked={field.listVisible} disabled={field.deprecated} onChange={(event) => updateField(index, { listVisible: event.target.checked })} />List visible</label>
              <label className="check-row"><input type="checkbox" checked={field.filterable} disabled={field.deprecated} onChange={(event) => updateField(index, { filterable: event.target.checked })} />Filterable</label>
              {permanent ? <label className="check-row"><input type="checkbox" checked={field.deprecated} onChange={(event) => updateField(index, { deprecated: event.target.checked })} />Deprecated</label> : <button className="secondary-button" type="button" onClick={() => removeField(index)}>Remove</button>}
            </div>
          </div>
        })}</div>
        <button className="secondary-button" type="button" disabled={draft.fields.length >= 50} onClick={addField}>Add field</button>
      </fieldset>

      <fieldset><legend>Browse defaults</legend><div className="form-pair">
        <label>Sort by<select value={draft.defaultSortField} onChange={(event) => setDraft({ ...draft, defaultSortField: event.target.value })}>{['updated_at', 'created_at', 'title', ...activeFields.map((field) => field.key)].map((field) => <option key={field}>{field}</option>)}</select></label>
        <label>Direction<select value={draft.defaultSortDirection} onChange={(event) => setDraft({ ...draft, defaultSortDirection: event.target.value as 'asc' | 'desc' })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
        <label>Group by<select value={draft.groupByField ?? ''} onChange={(event) => setDraft({ ...draft, groupByField: event.target.value || null })}><option value="">None</option>{activeFields.map((field) => <option key={field.key}>{field.key}</option>)}</select></label>
      </div></fieldset>

      <fieldset><legend>Commitments</legend><div className="field-flags">{COMMITMENT_KINDS.map((kind) => <label className="check-row" key={kind}><input type="checkbox" checked={draft.allowedCommitmentKinds.includes(kind)} onChange={(event) => toggleCommitment(kind, event.target.checked)} />{kind}</label>)}</div></fieldset>
      <label>Behaviour<select value={draft.pluginKey ?? ''} onChange={(event) => setDraft({ ...draft, pluginKey: event.target.value ? 'spaced_repetition' : null })}><option value="">Data only</option><option value="spaced_repetition">Spaced repetition</option></select></label>
      <label className="check-row"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />Active in Capture and Browse</label>
      {original && <p className="settings-hint">Existing field keys and kinds are permanent. Schema changes advance exactly one version; disable or deprecate instead of deleting data.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="primary-button" type="submit"><span>Save type</span></button></div>
    </form>
  </Sheet>
}

function normalizeField(field: EntityFieldDefinition): EntityFieldDefinition {
  if (field.deprecated) return { ...field, required: false, listVisible: false, filterable: false }
  if (field.kind !== 'single_select') return { ...field, options: [] }
  return field
}

function nextFieldKey(fields: EntityFieldDefinition[]): string {
  let number = fields.length + 1
  while (fields.some((field) => field.key === `field_${number}`)) number += 1
  return `field_${number}`
}

function uniqueOptions(value: string): string[] {
  return [...new Set(value.split(',').map((option) => option.trim()).filter(Boolean))]
}

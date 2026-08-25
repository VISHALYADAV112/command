import { useEffect, useState, type FormEvent } from 'react'
import type { LearningItem } from '../types'
import { addDays, dateKey } from '../domain'
import { EmptyState, Icon, Sheet, ViewShell, uid } from '../ui'

interface Props {
  items: LearningItem[]
  today: Date
  createSignal?: number
  onCapture: (item: LearningItem) => void
  onDelete: (id: string) => void
}

const trackLabels = { node: 'Node', dsa: 'DSA', math: 'Math' } as const

export function LearningView({ items, today, createSignal = 0, onCapture, onDelete }: Props) {
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (createSignal > 0) setCreating(true)
  }, [createSignal])

  const byTrack = (['dsa', 'node', 'math'] as const).map((track) => ({
    track,
    list: items
      .filter((item) => item.track === track)
      .sort((a, b) => a.confidence - b.confidence || (a.nextReviewOn ?? '').localeCompare(b.nextReviewOn ?? '')),
  }))

  return (
    <ViewShell
      eyebrow="Memory · Library"
      title="Learning"
      aside={<button className="secondary-button" type="button" onClick={() => setCreating(true)}><Icon name="plus" /><span>+ Concept</span></button>}
    >
      <p className="view-hint">The body of the note is where the value lives — write it for the version of you that has forgotten.</p>
      {items.length === 0 ? (
        <EmptyState message="Library is empty. Capture the first concept." />
      ) : (
        byTrack.map(({ track, list }) => list.length > 0 && (
          <div key={track}>
            <div className="subsection-heading"><span>{trackLabels[track]}</span><small>{list.length}</small></div>
            <div className="item-list">
              {list.map((item) => (
                <article className="list-item learning-item" key={item.id}>
                  <div className="item-main">
                    <div><strong>{item.concept}</strong><span>{item.itemType}</span></div>
                    <span className={`confidence c-${item.confidence}`}>C{item.confidence}</span>
                  </div>
                  <p>{item.content}</p>
                  <div className="learning-item-foot">
                    <time dateTime={item.nextReviewOn ?? ''}>
                      {item.nextReviewOn === null
                        ? 'Retired — mastered twice'
                        : `Review ${dateKey(today) === item.nextReviewOn ? 'today' : item.nextReviewOn.slice(5)}`}
                    </time>
                    <button
                      className="icon-button learning-delete"
                      type="button"
                      aria-label={`Delete ${item.concept}`}
                      onClick={() => onDelete(item.id)}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))
      )}

      {creating && (
        <ConceptSheet
          today={today}
          onSave={(item) => { onCapture(item); setCreating(false) }}
          onClose={() => setCreating(false)}
        />
      )}
    </ViewShell>
  )
}

function ConceptSheet({ today, onSave, onClose }: { today: Date; onSave: (item: LearningItem) => void; onClose: () => void }) {
  const [concept, setConcept] = useState('')
  const [track, setTrack] = useState<LearningItem['track']>('dsa')
  const [itemType, setItemType] = useState<LearningItem['itemType']>('concept')
  const [content, setContent] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!concept.trim()) return
    onSave({
      id: uid('learn'),
      concept: concept.trim(),
      track,
      itemType,
      confidence: 1,
      nextReviewOn: dateKey(addDays(today, 1)),
      masteryHits: 0,
      content: content.trim(),
    })
  }

  return (
    <Sheet title="+ Concept" eyebrow="Recall starts tomorrow" onClose={onClose}>
      <form className="simple-form" onSubmit={submit}>
        <label>Concept<input autoFocus required value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Name it precisely" /></label>
        <div className="form-pair">
          <label>Track<select value={track} onChange={(event) => setTrack(event.target.value as LearningItem['track'])}>
            <option value="dsa">DSA</option>
            <option value="node">Node</option>
            <option value="math">Math</option>
          </select></label>
          <label>Type<select value={itemType} onChange={(event) => setItemType(event.target.value as LearningItem['itemType'])}>
            <option value="concept">Concept</option>
            <option value="pattern">Pattern</option>
            <option value="snippet">Snippet</option>
            <option value="formula">Formula</option>
          </select></label>
        </div>
        <label>The note<textarea rows={4} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Explain it plainly — invariants, edge cases, why it works." /></label>
        <div className="form-actions"><button className="primary-button" type="submit"><span>Capture</span><Icon name="plus" /></button></div>
      </form>
    </Sheet>
  )
}

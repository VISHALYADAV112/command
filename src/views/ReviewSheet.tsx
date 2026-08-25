import { useState } from 'react'
import type { LearningItem, Recall } from '../types'
import { Sheet } from '../ui'

export function ReviewSheet({ item, onComplete, onClose }: {
  item: LearningItem
  onComplete: (recall: Recall) => void
  onClose: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <Sheet title={item.concept} eyebrow={`${item.track} · confidence ${item.confidence}`} onClose={onClose}>
      <div className="recall-body">
        {!revealed ? (
          <div className="recall-prompt">
            <span>Recall first</span>
            <p>Explain the idea, invariant, or formula without opening your notes.</p>
            <button className="secondary-button" type="button" onClick={() => setRevealed(true)}>Reveal answer</button>
          </div>
        ) : (
          <>
            <div className="answer-panel"><span>Your note</span><p>{item.content}</p></div>
            <fieldset className="recall-options">
              <legend>How did recall feel?</legend>
              <RecallButton label="Instant" detail="Review in 3 weeks" onClick={() => onComplete('instant')} />
              <RecallButton label="Some effort" detail="Review in 1 week" onClick={() => onComplete('effort')} />
              <RecallButton label="Struggled" detail="Review in 3 days" onClick={() => onComplete('struggled')} />
              <RecallButton label="Blank" detail="Review tomorrow" onClick={() => onComplete('blank')} />
            </fieldset>
          </>
        )}
      </div>
    </Sheet>
  )
}

function RecallButton({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick}><strong>{label}</strong><span>{detail}</span></button>
}

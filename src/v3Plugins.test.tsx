import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoData } from './data'
import type { Recall } from './types'
import { recallSchedule, spacedRepetitionPlan } from './v3Plugins'
import { OutcomeSheet } from './views/CommitmentSheets'

const today = new Date('2026-09-02T06:00:00.000Z')

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(today) })
afterEach(() => vi.useRealTimers())

describe('Phase 7 behaviour plugins', () => {
  it('preserves the existing 21/7/3/1-day recall schedule', () => {
    const expected: Record<Recall, string> = {
      instant: '2026-09-23', effort: '2026-09-09', struggled: '2026-09-05', blank: '2026-09-03',
    }
    for (const recall of Object.keys(expected) as Recall[]) {
      expect(recallSchedule(3, 0, recall, today).suggestedNextOn).toBe(expected[recall])
    }
  })

  it('updates generic plugin fields and retires the second instant mastery', () => {
    const data = createDemoData(today)
    const type = data.entityTypes.find((item) => item.typeKey === 'learning')!
    const entity = data.entities.find((item) => item.entityTypeId === type.id && item.fields.mastery_hits === 1)!
    const result = spacedRepetitionPlan({ ...entity, fields: { ...entity.fields, confidence: 4 } }, 'instant', today)
    expect(result).toMatchObject({ confidence: 5, masteryHits: 2, reviewedOn: '2026-09-02', suggestedNextOn: null })
    expect(result.entity.fields).toMatchObject({ confidence: 5, mastery_hits: 2, last_reviewed_on: '2026-09-02' })
  })

  it('lets Outcome adjust the proposed follow-on date before one save', () => {
    const data = createDemoData(today)
    const type = data.entityTypes.find((item) => item.typeKey === 'learning')!
    const entity = data.entities.find((item) => item.entityTypeId === type.id)!
    const commitment = data.commitments.find((item) => item.entityId === entity.id && item.kind === 'review')!
    const onSave = vi.fn().mockReturnValue(true)
    render(<OutcomeSheet commitment={commitment} entity={entity} type={type} onSave={onSave} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('What happened?'), { target: { value: 'Recalled the invariant.' } })
    fireEvent.change(screen.getByLabelText('How did recall feel?'), { target: { value: 'blank' } })
    expect(screen.getByLabelText(/Next review/)).toHaveValue('2026-09-03')
    fireEvent.change(screen.getByLabelText(/Next review/), { target: { value: '2026-09-04' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save outcome' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      recall: 'blank',
      entity: expect.objectContaining({ fields: expect.objectContaining({ last_reviewed_on: '2026-09-02' }) }),
      nextCommitment: expect.objectContaining({ kind: 'review', dueOn: '2026-09-04', state: 'open' }),
    }))
  })
})

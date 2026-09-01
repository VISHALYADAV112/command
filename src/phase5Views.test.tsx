import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createDemoData } from './data'
import type { Commitment, Entity } from './types'
import { BrowseView } from './views/BrowseView'
import { DueView } from './views/DueView'
import { TodayView } from './views/TodayView'
import { settings } from './domain'

const today = new Date('2026-08-25T06:00:00.000Z')

describe('Phase 5 bounded views', () => {
  it('paginates registry records instead of truncating them', () => {
    const data = createDemoData(today)
    const type = data.entityTypes.find((item) => item.typeKey === 'note')!
    const template = data.entities.find((item) => item.entityTypeId === type.id)!
    const extra: Entity[] = Array.from({ length: 30 }, (_, index) => ({
      ...template, id: crypto.randomUUID(), title: `Paged note ${String(index).padStart(2, '0')}`,
    }))
    data.entities = [...extra, ...data.entities]

    const { container } = render(<BrowseView data={data} typeKey="note" onType={vi.fn()} onOpenItem={vi.fn()} onCapture={vi.fn()} onOpenSettings={vi.fn()} />)
    expect(container.querySelectorAll('.registry-row')).toHaveLength(25)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(container.querySelectorAll('.registry-row')).toHaveLength(7)
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('paginates the unified commitment queue', () => {
    const data = createDemoData(today)
    const entity = data.entities[0]
    data.commitments = Array.from({ length: 30 }, (_, index): Commitment => ({
      id: crypto.randomUUID(), entityId: entity.id, kind: 'follow-up', action: `Paged commitment ${index}`,
      dueOn: '2026-08-25', state: 'open', outcome: null, completedAt: null, originSource: 'ui',
    }))

    const { container } = render(<DueView data={data} today={today} window="all" typeKey={null} onChange={vi.fn()} onOutcome={vi.fn()} onOpenItem={vi.fn()} onCapture={vi.fn()} />)
    expect(container.querySelectorAll('.commitment-row')).toHaveLength(25)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(container.querySelectorAll('.commitment-row')).toHaveLength(5)
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('keeps the practice-floor context beside a desktop overdue exception', () => {
    const data = createDemoData(today)
    render(<TodayView data={data} settings={settings} today={today} onLog={vi.fn()} onCapture={vi.fn()} onOutcome={vi.fn()} onOpenItem={vi.fn()} />)
    expect(document.querySelector('.urgent-lead')).toBeInTheDocument()
    expect(document.querySelector('.floor-field.is-after-exception')).toBeInTheDocument()
  })
})

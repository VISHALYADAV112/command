import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppHeader } from './AppHeader'
import { createDemoData } from './data'
import { settings } from './domain'

describe('AppHeader', () => {
  it('does not count open commitments belonging to archived records', () => {
    const today = new Date('2026-09-04T06:00:00.000Z')
    const data = createDemoData(today)
    const entity = data.entities[0]
    entity.archivedAt = today.toISOString()
    data.commitments = [{
      id: crypto.randomUUID(), entityId: entity.id, kind: 'deadline', action: 'Archived deadline',
      dueOn: '2026-09-03', state: 'open', outcome: null, completedAt: null, originSource: 'ui',
    }]

    render(<AppHeader today={today} live theme="day" data={data} settings={settings} onToggleTheme={() => undefined} />)

    expect(screen.getByText('0 open')).toBeInTheDocument()
    expect(screen.getByText('/ 0 overdue')).toBeInTheDocument()
  })
})

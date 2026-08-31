import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Sheet } from './ui'

function SheetHarness() {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open sheet</button>
    {open && <Sheet title="Test sheet" eyebrow="Test" onClose={() => setOpen(false)}><button type="button">Inside</button></Sheet>}
  </>
}

describe('shared Sheet primitive', () => {
  it('traps focus, closes on Escape, and restores focus to the opener', () => {
    render(<SheetHarness />)
    const opener = screen.getByRole('button', { name: 'Open sheet' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Test sheet' })
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()

    const inside = screen.getByRole('button', { name: 'Inside' })
    close.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(inside).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Test sheet' })).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})

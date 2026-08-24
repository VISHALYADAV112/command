import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'

describe('daily instrument', () => {
  beforeEach(() => localStorage.clear())

  it('opens and saves today without creating a second interaction path', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /today/i }))
    expect(screen.getByRole('dialog', { name: 'Log today' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add 15 minutes to Math' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save today' }))

    expect(screen.queryByRole('dialog', { name: 'Log today' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Today saved')
  })
})

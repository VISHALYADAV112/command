import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'

describe('daily instrument', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })

  it('opens and saves today without creating a second interaction path', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /(log|continue) today/i }))
    expect(screen.getByRole('dialog', { name: 'Log today' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add 15 minutes to Math' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save today' }))

    expect(screen.queryByRole('dialog', { name: 'Log today' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Today saved')
  })

  it('navigates to the ideas view and captures an idea', () => {
    render(<App />)

    const nav = document.querySelector('.view-nav') as HTMLElement
    fireEvent.click(nav.querySelectorAll('button')[3]!)
    expect(screen.getByRole('heading', { name: 'Ideas' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /capture/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByPlaceholderText("What's the itch?"), { target: { value: 'Test idea from spec' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Capture$/ }))

    expect(screen.getByText('Test idea from spec')).toBeInTheDocument()
  })

  it('shows the learning library and the quick-capture row on the dashboard', () => {
    render(<App />)

    const quickCapture = screen.getByRole('group', { name: 'Quick capture' })
    expect(quickCapture).toHaveTextContent('Application')
    expect(quickCapture).toHaveTextContent('Concept')
    expect(quickCapture).toHaveTextContent('Idea')

    const nav = document.querySelector('.view-nav') as HTMLElement
    fireEvent.click(nav.querySelectorAll('button')[4]!)
    expect(screen.getByRole('heading', { name: 'Learning' })).toBeInTheDocument()
    expect(screen.getAllByText(/Sliding window/).length).toBeGreaterThan(0)
  })
})

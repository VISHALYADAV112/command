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

    fireEvent.click(screen.getByRole('button', { name: 'Ideas' }))
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

    fireEvent.click(screen.getByRole('button', { name: 'Learning' }))
    expect(screen.getByRole('heading', { name: 'Learning' })).toBeInTheDocument()
    expect(screen.getAllByText(/Sliding window/).length).toBeGreaterThan(0)
  })

  it('captures a concept into the learning library', () => {
    render(<App />)

    fireEvent.click(within(screen.getByRole('group', { name: 'Quick capture' })).getByRole('button', { name: 'Concept' }))
    const dialog = screen.getByRole('dialog', { name: '+ Concept' })
    fireEvent.change(within(dialog).getByLabelText('Concept'), { target: { value: 'Monotonic stack invariant' } })
    fireEvent.change(within(dialog).getByLabelText('The note'), { target: { value: 'Pop candidates that can no longer answer later queries.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Capture' }))

    expect(screen.queryByRole('dialog', { name: '+ Concept' })).not.toBeInTheDocument()
    expect(screen.getByText('Monotonic stack invariant')).toBeInTheDocument()
  })

  it('shows jobs as a full pipeline and confirms destructive actions', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }))
    expect(screen.getByRole('heading', { name: 'Applications' })).toBeInTheDocument()
    expect(screen.getByText('Archive')).toBeInTheDocument()
    expect(screen.getByText('Example Systems')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Atlassian Graduate Software Engineer/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete Atlassian?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('dialog', { name: 'Delete Atlassian?' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Atlassian' })).toBeInTheDocument()
  })
})

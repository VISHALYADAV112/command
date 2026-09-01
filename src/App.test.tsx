import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'

describe('v3 core workflows', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/')
    window.location.hash = ''
  })

  it('keeps the daily log to the approved three practice floors', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /log today/i }))

    const dialog = screen.getByRole('dialog', { name: 'Log today' })
    expect(within(dialog).queryByText('Job hunt')).not.toBeInTheDocument()
    expect(within(dialog).getAllByRole('spinbutton')).toHaveLength(3)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save today' }))
    expect(screen.getByRole('status')).toHaveTextContent('Today saved')
  })

  it('captures a registry-driven person with its first commitment and completes it from Due', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Capture' }))
    let dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: '10000000-0000-4000-8000-000000000002' } })
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Mira Patel' } })
    fireEvent.change(within(dialog).getByLabelText(/Status/), { target: { value: 'talking' } })
    fireEvent.click(within(dialog).getByLabelText('Schedule this record now'))
    fireEvent.change(within(dialog).getByLabelText('Due on'), { target: { value: '2026-09-02' } })
    fireEvent.change(within(dialog).getByLabelText('Commitment action'), { target: { value: 'Send Mira a follow-up' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Capture record' }))

    fireEvent.click(screen.getByRole('button', { name: 'Due' }))
    fireEvent.change(screen.getByLabelText('Type filter'), { target: { value: 'person' } })
    expect(screen.getByText('Send Mira a follow-up')).toBeInTheDocument()
    fireEvent.click(within(screen.getByText('Send Mira a follow-up').closest('article')!).getByRole('button', { name: 'Outcome' }))
    dialog = screen.getByRole('dialog', { name: 'Record outcome' })
    fireEvent.change(within(dialog).getByLabelText('What happened?'), { target: { value: 'Sent a useful follow-up.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save outcome' }))
    expect(screen.queryByText('Send Mira a follow-up')).not.toBeInTheDocument()
  })

  it('browses, opens, archives, and restores canonical items', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))
    fireEvent.change(screen.getByLabelText('Browse type'), { target: { value: 'project' } })
    fireEvent.click(screen.getByRole('button', { name: /RAG evaluation workbench/ }))
    expect(screen.getByRole('heading', { name: 'RAG evaluation workbench' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(screen.getByText('Archived records are read-only until restored.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(screen.queryByText('Archived records are read-only until restored.')).not.toBeInTheDocument()
  })

  it('retains a capture draft after dismissal and clears it after a successful save', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Capture' }))
    let dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: '10000000-0000-4000-8000-000000000005' } })
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Draft idea' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: 'Capture' }))
    dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: '10000000-0000-4000-8000-000000000005' } })
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Draft idea')
    fireEvent.change(within(dialog).getByLabelText(/Tag/), { target: { value: 'idea' } })
    fireEvent.change(within(dialog).getByLabelText(/Status/), { target: { value: 'captured' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Capture record' }))
    expect(localStorage.getItem('command.draft.capture.10000000-0000-4000-8000-000000000005')).toBeNull()
  })

  it('maps useful legacy hashes to the registry route', () => {
    window.location.hash = '#/jobs'
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Applications' })).toBeInTheDocument()
  })
})

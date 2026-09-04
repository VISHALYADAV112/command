import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createDemoData } from './data'
import type { AgentProposal } from './types'
import { AgentInboxSheet, pendingProposalCount } from './views/AgentInboxSheet'
import { ItemView } from './views/ItemView'
import { TodayView } from './views/TodayView'
import { settings } from './domain'

const now = new Date('2026-09-02T06:00:00.000Z')

describe('Phase 6 agent review', () => {
  it('shows an indicator only for reviewable pending proposals', () => {
    const data = createDemoData(now)
    data.agentProposals = [proposal(data.entityTypes.find((type) => type.typeKey === 'note')!.id)]
    const open = vi.fn()
    render(<TodayView data={data} settings={settings} today={now} onLog={vi.fn()} onCapture={vi.fn()} onOutcome={vi.fn()} onOpenItem={vi.fn()} onOpenAgentInbox={open} />)
    fireEvent.click(screen.getByRole('button', { name: 'Agent inbox · 1' }))
    expect(open).toHaveBeenCalledOnce()

    data.agentProposals[0] = { ...data.agentProposals[0], expiresAt: '2026-09-01T00:00:00.000Z' }
    expect(pendingProposalCount(data, now)).toBe(0)
  })

  it('supports edit-and-approve, direct approval, rejection, and expired display', async () => {
    const data = createDemoData(now)
    const note = data.entityTypes.find((type) => type.typeKey === 'note')!
    const pending = proposal(note.id)
    const direct = withTitle(proposal(note.id), 'Direct approval')
    const rejected = withTitle(proposal(note.id), 'Reject proposal')
    data.agentProposals = [
      pending, direct, rejected,
      { ...proposal(note.id), id: crypto.randomUUID(), state: 'approved', decidedAt: now.toISOString() },
      { ...proposal(note.id), id: crypto.randomUUID(), state: 'rejected', decidedAt: now.toISOString() },
      { ...proposal(note.id), id: crypto.randomUUID(), expiresAt: '2026-09-01T00:00:00.000Z' },
    ]
    const decide = vi.fn().mockResolvedValue(true)
    render(<AgentInboxSheet data={data} onDecide={decide} onClose={vi.fn()} />)

    expect(screen.getByText('expired')).toBeInTheDocument()
    expect(screen.getByText('rejected')).toBeInTheDocument()
    expect(screen.getByText('approved')).toBeInTheDocument()
    const pendingCard = screen.getAllByText('Agent note')[0].closest('article')!
    fireEvent.click(within(pendingCard).getByRole('button', { name: 'Edit & approve' }))
    fireEvent.change(within(pendingCard).getByLabelText('Title'), { target: { value: 'Reviewed note' } })
    fireEvent.click(within(pendingCard).getByRole('button', { name: 'Approve edited proposal' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith(expect.objectContaining({
      proposalId: pending.id,
      decision: 'approve',
      decisionNote: 'Edited and approved in Command',
      entityPayload: expect.objectContaining({ title: 'Reviewed note', schema_version: 2 }),
    })))

    fireEvent.click(within(screen.getByText('Direct approval').closest('article')!).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith(expect.objectContaining({
      proposalId: direct.id, decision: 'approve', decisionNote: 'Approved in Command',
    })))
    fireEvent.click(within(screen.getByText('Reject proposal').closest('article')!).getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith(expect.objectContaining({
      proposalId: rejected.id, decision: 'reject', decisionNote: 'Rejected in Command',
    })))
  })

  it('shows MCP source and client provenance on Item', () => {
    const data = createDemoData(now)
    const entity = data.entities[0]
    data.activityEvents.unshift({
      id: crypto.randomUUID(), entityId: entity.id, commitmentId: null,
      eventType: 'entity.created', payload: {}, source: 'mcp', clientId: 'phase6-client',
      idempotencyKey: 'proposal-event-001', occurredAt: now.toISOString(), createdAt: now.toISOString(),
    })
    render(<ItemView data={data} entityId={entity.id} today={now} onEdit={vi.fn()} onSchedule={vi.fn()} onOutcome={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />)
    // The event ledger prints the writing surface beside the client that wrote it.
    expect(screen.getAllByText('mcp')[0]).toBeInTheDocument()
    expect(screen.getByText(/phase6-client/)).toBeInTheDocument()
  })
})

function proposal(entityTypeId: string): AgentProposal {
  return {
    id: crypto.randomUUID(), clientId: 'phase6-client', operation: 'capture', entityTypeId,
    targetEntityId: null, targetCommitmentId: null, targetUpdatedAt: null,
    proposedEntity: {
      id: crypto.randomUUID(), title: 'Agent note', fields: { tag: 'idea', status: 'captured' }, schema_version: 2,
    },
    proposedCommitment: null, state: 'pending', decisionNote: null,
    resultEntityId: null, resultCommitmentId: null, resultEventId: null,
    idempotencyKey: `proposal-${crypto.randomUUID()}`, expiresAt: '2026-09-09T00:00:00.000Z',
    decidedAt: null, createdAt: '2026-09-02T05:00:00.000Z',
  }
}

function withTitle(value: AgentProposal, title: string): AgentProposal {
  return { ...value, proposedEntity: { ...value.proposedEntity, title } }
}

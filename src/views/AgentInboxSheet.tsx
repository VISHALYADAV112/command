import { useMemo, useState } from 'react'
import type { AgentProposal, CommandData } from '../types'
import type { AgentProposalDecision } from '../lib/api'
import { EmptyState, Sheet } from '../ui'
import { AgentProposalEditor } from './AgentProposalEditor'

export function pendingProposalCount(data: CommandData, now = new Date()): number {
  return data.agentProposals.filter((proposal) => proposalState(proposal, now) === 'pending').length
}

export function AgentInboxSheet({ data, onDecide, onClose }: {
  data: CommandData
  onDecide: (decision: AgentProposalDecision) => Promise<boolean>
  onClose: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const now = useMemo(() => new Date(), [])
  const proposals = [...data.agentProposals]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 50)
  const pending = proposals.filter((proposal) => proposalState(proposal, now) === 'pending')
  const history = proposals.filter((proposal) => proposalState(proposal, now) !== 'pending')

  async function decide(proposal: AgentProposal, decision: AgentProposalDecision) {
    setBusy(proposal.id)
    setError('')
    const saved = await onDecide(decision)
    if (saved) setEditing(null)
    else setError('The proposal was not changed. Review its current state and try again.')
    setBusy(null)
  }

  return <Sheet title="Agent inbox" eyebrow="Review gate" onClose={onClose}>
    <p className="agent-inbox-intro">Nothing enters Command until you approve it. The client and proposed values stay visible during review.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <ProposalGroup title="Needs review" proposals={pending} empty="No proposals need review." data={data} now={now} editing={editing} busy={busy} onEdit={setEditing} onDecide={decide} />
    {history.length > 0 && <ProposalGroup title="Recent decisions" proposals={history} data={data} now={now} editing={editing} busy={busy} onEdit={setEditing} onDecide={decide} />}
  </Sheet>
}

function ProposalGroup({ title, proposals, empty, data, now, editing, busy, onEdit, onDecide }: {
  title: string
  proposals: AgentProposal[]
  empty?: string
  data: CommandData
  now: Date
  editing: string | null
  busy: string | null
  onEdit: (id: string | null) => void
  onDecide: (proposal: AgentProposal, decision: AgentProposalDecision) => void
}) {
  return <section className="agent-proposal-group"><h3>{title}</h3>
    {proposals.length === 0 ? <EmptyState message={empty ?? 'No recent proposals.'} /> : <div className="agent-proposal-list">{proposals.map((proposal) => {
      const type = data.entityTypes.find((item) => item.id === proposal.entityTypeId)
      const state = proposalState(proposal, now)
      const canEdit = state === 'pending' && type && ['capture', 'schedule', 'complete'].includes(proposal.operation)
      return <article className="agent-proposal" key={proposal.id}>
        <div className="agent-proposal-heading"><div><span className="status-pill agent-pill">{proposal.operation.replace('_', ' ')}</span><strong>{proposalTitle(proposal, data)}</strong></div><span className={`proposal-state is-${state}`}>{state}</span></div>
        <p>{type?.singularName ?? 'Record'} · client {proposal.clientId}</p>
        <time dateTime={proposal.createdAt}>{new Date(proposal.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</time>
        {editing === proposal.id && type ? <AgentProposalEditor proposal={proposal} type={type} busy={busy === proposal.id} onCancel={() => onEdit(null)} onSave={(payload) => onDecide(proposal, { proposalId: proposal.id, decision: 'approve', decisionNote: 'Edited and approved in Command', ...payload })} /> : state === 'pending' && <div className="agent-proposal-actions">
          <button className="primary-button" type="button" disabled={busy === proposal.id} onClick={() => onDecide(proposal, { proposalId: proposal.id, decision: 'approve', decisionNote: 'Approved in Command' })}><span>{busy === proposal.id ? 'Applying…' : 'Approve'}</span></button>
          {canEdit && <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={() => onEdit(proposal.id)}>Edit & approve</button>}
          <button className="danger-button danger-quiet" type="button" disabled={busy === proposal.id} onClick={() => onDecide(proposal, { proposalId: proposal.id, decision: 'reject', decisionNote: 'Rejected in Command' })}>Reject</button>
        </div>}
      </article>
    })}</div>}
  </section>
}

function proposalState(proposal: AgentProposal, now: Date): AgentProposal['state'] {
  return proposal.state === 'pending' && new Date(proposal.expiresAt) <= now ? 'expired' : proposal.state
}

function proposalTitle(proposal: AgentProposal, data: CommandData): string {
  if (proposal.operation === 'capture') return String(proposal.proposedEntity?.title ?? 'Untitled capture')
  const entity = data.entities.find((item) => item.id === proposal.targetEntityId)
  const detail = proposal.operation === 'schedule'
    ? proposal.proposedCommitment?.action : proposal.proposedCommitment?.outcome
  return `${entity?.title ?? 'Unavailable item'}${detail ? ` · ${String(detail)}` : ''}`
}

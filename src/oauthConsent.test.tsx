import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MCP_PERMISSION } from '../supabase/functions/_shared/mcp-permissions'
import { OAuthConsentScreen } from './OAuthConsentScreen'

const mocks = vi.hoisted(() => ({
  savePermissions: vi.fn().mockResolvedValue(undefined),
  approve: vi.fn(() => new Promise(() => undefined)),
  deny: vi.fn(() => new Promise(() => undefined)),
  details: vi.fn().mockResolvedValue({
    data: {
      authorization_id: 'authorization-123',
      client: { id: 'client-123', name: 'Test agent', uri: 'https://agent.example' },
      scope: 'email',
      user: { id: 'user-123', email: 'owner@example.test' },
    },
    error: null,
  }),
}))

vi.mock('./lib/supabase', () => ({
  getSupabase: () => ({ auth: { oauth: {
    getAuthorizationDetails: mocks.details,
    approveAuthorization: mocks.approve,
    denyAuthorization: mocks.deny,
  } } }),
}))
vi.mock('./lib/api', () => ({ saveMcpClientPermissions: mocks.savePermissions }))

describe('MCP OAuth consent', () => {
  it('stores explicit Command permissions while keeping people access opt-in', async () => {
    render(<OAuthConsentScreen authorizationId="authorization-123" />)
    expect(await screen.findByRole('heading', { name: 'Connect Test agent?' })).toBeInTheDocument()
    expect(screen.getByLabelText('Access person records')).not.toBeChecked()
    fireEvent.click(screen.getByLabelText('Access person records'))
    fireEvent.click(screen.getByRole('button', { name: 'Allow connection' }))
    await waitFor(() => expect(mocks.savePermissions).toHaveBeenCalledWith(
      expect.anything(), 'user-123', 'client-123', expect.arrayContaining([
        MCP_PERMISSION.typesRead, MCP_PERMISSION.dataRead,
        MCP_PERMISSION.proposalsWrite, MCP_PERMISSION.peopleData,
      ]),
    ))
    expect(mocks.approve).toHaveBeenCalledWith('authorization-123', { skipBrowserRedirect: true })
  })
})

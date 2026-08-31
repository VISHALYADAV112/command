import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommandData } from './types'
import { useRemoteSync } from './useRemoteSync'

const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value })
}

afterEach(() => {
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility)
  vi.restoreAllMocks()
})

describe('visibility refresh', () => {
  it('reloads live remote data when the app becomes visible', () => {
    const reload = vi.fn()
    setVisibility('hidden')
    renderHook(() => useRemoteSync({
      mode: 'live',
      dataRef: { current: null as CommandData | null },
      reload,
    }))

    setVisibility('visible')
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not reload demo data on visibility changes', () => {
    const reload = vi.fn()
    setVisibility('visible')
    renderHook(() => useRemoteSync({
      mode: 'demo',
      dataRef: { current: null as CommandData | null },
      reload,
    }))

    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(reload).not.toHaveBeenCalled()
  })

  it('does not replace an optimistic change while its failed write awaits retry', async () => {
    const reload = vi.fn()
    setVisibility('visible')
    const { result } = renderHook(() => useRemoteSync({
      mode: 'live',
      dataRef: { current: null as CommandData | null },
      reload,
    }))

    act(() => result.current.run(() => Promise.reject(new Error('write failed'))))
    await waitFor(() => expect(result.current.state).toBe('error'))
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(reload).not.toHaveBeenCalled()
  })
})

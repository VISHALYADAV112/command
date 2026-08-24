import type { Session } from '@supabase/supabase-js'
import { edgeBaseUrl } from './config'

const BASE = edgeBaseUrl()

async function call(session: Session, action: string, init?: { method?: string; body?: unknown }) {
  const response = await fetch(`${BASE}?action=${action}`, {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Calendar request failed (${response.status})`)
  }
  return response.json() as Promise<Record<string, any>>
}

export interface CalendarStatus {
  connected: boolean
  account: { provider: string; status: string; last_verified_at: string | null; scopes: string[] } | null
}

export interface CalendarEvent {
  id: string
  title: string
  start: string | null
  end: string | null
  url: string | null
}

export async function getCalendarStatus(session: Session): Promise<CalendarStatus> {
  const result = await call(session, 'status')
  return result as CalendarStatus
}

export async function startCalendarConnect(session: Session): Promise<void> {
  const { url } = await call(session, 'connect')
  window.location.assign(url)
}

export async function disconnectCalendar(session: Session): Promise<void> {
  await call(session, 'disconnect', { method: 'GET' })
}

export async function listTodayEvents(session: Session): Promise<CalendarEvent[]> {
  const result = await call(session, 'events')
  return (result.events ?? []) as CalendarEvent[]
}

export async function createCalendarEvent(
  session: Session,
  payload: { summary: string; description?: string; start: string; entity_type: string; entity_id: string; idempotency_key: string },
): Promise<void> {
  await call(session, 'event', { method: 'POST', body: payload })
}
import type { Session } from '@supabase/supabase-js'
import type { JobApplication, Project } from '../types'
import { edgeBaseUrl } from './config'

const BASE = edgeBaseUrl()

async function call<T>(session: Session, action: string, init?: { method?: string; body?: unknown }): Promise<T> {
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
  return response.json() as Promise<T>
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
  return call<CalendarStatus>(session, 'status')
}

export async function startCalendarConnect(session: Session): Promise<void> {
  const { url } = await call<{ url: string }>(session, 'connect')
  window.location.assign(url)
}

export async function disconnectCalendar(session: Session): Promise<void> {
  await call<{ ok: boolean }>(session, 'disconnect', { method: 'GET' })
}

export async function listTodayEvents(session: Session): Promise<CalendarEvent[]> {
  const result = await call<{ events?: CalendarEvent[] }>(session, 'events')
  return result.events ?? []
}

export interface DeadlineEventPayload {
  summary: string
  description: string
  start: string
  entity_type: 'project_deadline' | 'application_deadline'
  entity_id: string
  idempotency_key: string
  update_only?: boolean
}

export async function createCalendarEvent(session: Session, payload: DeadlineEventPayload): Promise<void> {
  await call<{ ok: boolean }>(session, 'event', { method: 'POST', body: payload })
}

// One shape per pushed deadline so the manual button and the automatic
// resync on date change stay in lockstep.
export function projectDeadlineEvent(project: Project): DeadlineEventPayload {
  return {
    summary: `${project.name} — deadline`,
    description: `${project.type} project deadline`,
    start: `${project.deadlineOn}T00:00:00`,
    entity_type: 'project_deadline',
    entity_id: project.id,
    idempotency_key: `project-${project.id}-${project.deadlineOn}`,
  }
}

export function applicationDeadlineEvent(app: JobApplication): DeadlineEventPayload {
  return {
    summary: `${app.company} — window closes`,
    description: `${app.role} application window closes today`,
    start: `${app.windowClosesOn}T00:00:00`,
    entity_type: 'application_deadline',
    entity_id: app.id,
    idempotency_key: `application-${app.id}-${app.windowClosesOn}`,
  }
}

export async function deleteCalendarEvent(
  session: Session,
  payload: { entity_type: 'project_deadline' | 'application_deadline'; entity_id: string },
): Promise<void> {
  await call<{ ok: boolean }>(session, 'event_delete', { method: 'POST', body: payload })
}

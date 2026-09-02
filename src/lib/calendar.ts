import type { Session } from '@supabase/supabase-js'
import type { Commitment, Entity, EntityType } from '../types'
import { calendarCommitmentEvent, isCalendarCommitment } from '../../supabase/functions/_shared/calendar'
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
  last_synced_at: string | null
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

export interface CommitmentEventPayload {
  entity_type: 'commitment'
  entity_id: string
  idempotency_key: string
  update_only?: boolean
}

export async function createCalendarEvent(session: Session, payload: CommitmentEventPayload): Promise<void> {
  await call<{ ok: boolean }>(session, 'event', { method: 'POST', body: payload })
}

export function commitmentEventPayload(
  commitment: Commitment,
  entity: Entity,
  type: EntityType,
  updateOnly = false,
): CommitmentEventPayload | null {
  const event = calendarCommitmentEvent({
    id: commitment.id,
    kind: commitment.kind,
    action: commitment.action,
    dueOn: commitment.dueOn,
    state: commitment.state,
    entityTitle: entity.title,
    typeName: type.singularName,
  })
  return event ? {
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    idempotency_key: event.idempotency_key,
    ...(updateOnly ? { update_only: true } : {}),
  } : null
}

export async function deleteCalendarEvent(
  session: Session,
  payload: { entity_type: 'commitment'; entity_id: string },
): Promise<void> {
  await call<{ ok: boolean }>(session, 'event_delete', { method: 'POST', body: payload })
}

export function canExportCommitment(commitment: Commitment): boolean {
  return isCalendarCommitment(commitment)
}

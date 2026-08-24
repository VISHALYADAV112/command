import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { listTodayEvents, type CalendarEvent } from './lib/calendar'

export function CalendarStrip({ session }: { session: Session | null }) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    listTodayEvents(session).then(setEvents).catch((err: Error) => setError(err.message))
  }, [session])

  if (!session) return null
  if (error) return <div className="calendar-strip calendar-error">{error}</div>
  if (events.length === 0) return null

  return (
    <div className="calendar-strip">
      <span className="closing-label">Today</span>
      {events.map((event) => (
        <a className="calendar-chip" href={event.url ?? undefined} key={event.id} target="_blank" rel="noreferrer">
          <span>{event.title}</span>
          <small>{formatStart(event.start)}</small>
        </a>
      ))}
    </div>
  )
}

function formatStart(start: string | null): string {
  if (!start) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return 'All day'
  const date = new Date(start)
  const hh = date.getHours().toString().padStart(2, '0')
  const mm = date.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}
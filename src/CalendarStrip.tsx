import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getCalendarStatus, listTodayEvents, type CalendarEvent } from './lib/calendar'

// The strip stays silent until Calendar is actually connected — "not
// connected" is a normal state, not an error worth surfacing on the
// dashboard (spec §13.3: failures are bounded, quiet by default).
export function CalendarStrip({ session }: { session: Session | null }) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    setFailure(null)
    getCalendarStatus(session)
      .then((status) => {
        if (cancelled) return
        if (!status.connected) return
        return listTodayEvents(session).then((next) => {
          if (!cancelled) setEvents(next)
        })
      })
      .catch((error: Error) => {
        if (!cancelled) setFailure(error.message.slice(0, 140))
      })
    return () => {
      cancelled = true
    }
  }, [session])

  if (!session || events.length === 0) {
    if (failure) return <div className="calendar-strip calendar-error">Calendar: {failure}</div>
    return null
  }

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

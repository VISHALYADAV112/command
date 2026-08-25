import { useEffect, useState } from 'react'
import { dateKey } from './domain'

// A long-lived installed PWA must roll over without requiring a refresh.
export function useIndiaToday(): Date {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date()
      if (dateKey(now) !== dateKey(today)) setToday(now)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [today])
  return today
}

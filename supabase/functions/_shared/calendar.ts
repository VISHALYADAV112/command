const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

export function randomUrlSafe(length = 64): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => URL_SAFE[byte % URL_SAFE.length]).join('')
}

export function pkceVerifier(): string {
  return randomUrlSafe(64)
}

export function oauthState(userId: string): string {
  return `${userId}.${randomUrlSafe(32)}`
}

export function allDayEvent(date: string, summary: string, description: string) {
  const start = new Date(`${date}T00:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return {
    summary,
    description,
    start: { date },
    end: { date: end.toISOString().slice(0, 10) },
  }
}

export function todayWindow(now = new Date()): { timeMin: string; timeMax: string } {
  const offset = 5.5 * 60 * 60 * 1000
  const localMidnight = new Date(now.getTime() + offset)
  localMidnight.setUTCHours(0, 0, 0, 0)
  const start = new Date(localMidnight.getTime() - offset)
  return {
    timeMin: start.toISOString(),
    timeMax: new Date(start.getTime() + 86_400_000).toISOString(),
  }
}

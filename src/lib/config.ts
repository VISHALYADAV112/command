// Runtime configuration from build-time environment (VITE_* only).
// No secrets — only the project URL and publishable (anon) key belong here.

function stringEnv(name: string): string {
  try {
    return (import.meta.env?.[name] as string | undefined) ?? ''
  } catch {
    return ''
  }
}

export const SUPABASE_URL = stringEnv('VITE_SUPABASE_URL')
export const SUPABASE_ANON_KEY = stringEnv('VITE_SUPABASE_ANON_KEY')

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

// The deployed public origin (used as the Calendar OAuth return target and
// as the base for edge-function calls). Falls back to the current origin.
export function appOrigin(): string {
  return stringEnv('VITE_APP_ORIGIN') || (() => {
    try {
      return window.location.origin
    } catch {
      return 'http://localhost:5173'
    }
  })()
}

export function edgeBaseUrl(): string {
  const project = SUPABASE_URL.replace(/^https?:\/\//, '').replace(/\.supabase\.co.*$/, '')
  return `https://${project}.supabase.co/functions/v1/google-calendar`
}
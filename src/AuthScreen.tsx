import { signInWithGoogle } from './lib/auth'
import { isSupabaseConfigured } from './lib/config'

export function AuthScreen() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function start() {
    setBusy(true)
    setError(null)
    void signInWithGoogle().catch((failure: unknown) => {
      setBusy(false)
      setError(failure instanceof Error ? failure.message : 'Sign-in could not start.')
    })
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img className="auth-mark" src="./assets/gazette-mark.svg" alt="" />
        <p className="eyebrow">The Command Gazette</p>
        <h1>This dashboard is private.</h1>
        <p className="auth-copy">
          Sign in with the owner Google account. The instance accepts only the
          email listed in Supabase authentication settings; everyone else is
          blocked at the door.
        </p>
        <button className="primary-button auth-button" type="button" onClick={start} disabled={!isSupabaseConfigured || busy}>
          <span>{busy ? 'Opening Google…' : 'Continue with Google'}</span>
        </button>
        {error && <p className="auth-error" role="status">{error}</p>}
        {!isSupabaseConfigured && (
          <p className="auth-error">
            Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> to your environment, or run without
            them to use the local prototype.
          </p>
        )}
      </div>
    </div>
  )
}
import { useState } from 'react'

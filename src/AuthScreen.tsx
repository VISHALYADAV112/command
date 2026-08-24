import { getSupabase } from './lib/supabase'
import { signInWithGoogle } from './lib/auth'
import { isSupabaseConfigured } from './lib/config'

export function AuthScreen() {
  function start() {
    const client = getSupabase()
    if (!client) return
    void signInWithGoogle(client)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img className="auth-mark" src="./assets/command-mark.svg" alt="" />
        <p className="eyebrow">Command</p>
        <h1>This dashboard is private.</h1>
        <p className="auth-copy">
          Sign in with the owner Google account. The instance accepts only the
          email listed in Supabase authentication settings; everyone else is
          blocked at the door.
        </p>
        <button className="primary-button auth-button" type="button" onClick={start} disabled={!isSupabaseConfigured}>
          <span>Continue with Google</span>
        </button>
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
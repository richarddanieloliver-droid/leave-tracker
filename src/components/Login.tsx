import { useState } from 'react'
import { supabase } from '../lib/store'

/**
 * Email sign-in. Supabase emails a one-time code (and a link). Typing the code works inside the
 * home-screen app on a phone, where tapping an email link would open the normal browser instead.
 */
export function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('leave-email') ?? '')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setBusy(true)
    setError(null)
    try {
      localStorage.setItem('leave-email', email)
    } catch { /* storage unavailable */ }
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.href.split('#')[0] },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function verify() {
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="login">
      <div className="card">
        <img className="logo" src="./icon.svg" alt="" />
        <h1>Leave Tracker</h1>
        {!sent ? (
          <>
            <p>Enter your email and we'll send you a sign-in code.</p>
            <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && send()} />
            <button className="btn primary" disabled={busy || !email} onClick={send}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <p>Check {email} for your code, then enter it here. You can also tap the link in the email.</p>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && code && verify()} />
            <button className="btn primary" disabled={busy || code.trim().length < 6} onClick={verify}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button className="btn ghost" onClick={() => { setSent(false); setCode('') }}>Use a different email</button>
          </>
        )}
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>
    </div>
  )
}

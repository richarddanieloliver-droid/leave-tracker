import { useState } from 'react'
import { supabase } from '../lib/store'

/**
 * Sign in with email + password, or with a one-time code emailed by Supabase. Codes (rather than
 * links) work inside the home-screen app on a phone, but Supabase's built-in email only sends a
 * couple per hour, so password sign-in is the default.
 */
export function Login() {
  const [mode, setMode] = useState<'password' | 'code'>('password')
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('leave-email') ?? ''
    } catch {
      return ''
    }
  })
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function rememberEmail() {
    try {
      localStorage.setItem('leave-email', email)
    } catch { /* storage unavailable */ }
  }

  async function attempt(fn: () => Promise<{ error: { message: string } | null }>, onOk?: () => void) {
    setBusy(true)
    setError(null)
    rememberEmail()
    const { error } = await fn()
    setBusy(false)
    if (error) setError(error.message)
    else onOk?.()
  }

  const signInWithPassword = () =>
    attempt(async () => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password })
      if (error?.message === 'Invalid login credentials') {
        return { error: { message: "Wrong email or password. If you haven't set a password yet, sign in with a code and set one under Data → Account." } }
      }
      return { error }
    })

  const sendCode = () =>
    attempt(
      () => supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.href.split('#')[0] } }),
      () => setSent(true),
    )

  const verifyCode = () => attempt(() => supabase!.auth.verifyOtp({ email, token: code.trim(), type: 'email' }))

  const switchMode = (m: typeof mode) => {
    setMode(m)
    setError(null)
    setSent(false)
    setCode('')
  }

  const emailInput = (onEnter: () => void) => (
    <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && onEnter()} />
  )

  return (
    <div className="login">
      <div className="card">
        <img className="logo" src="./icon.svg" alt="" />
        <h1>Leave Tracker</h1>

        <div className="seg">
          <button type="button" className={mode === 'password' ? 'on' : ''} onClick={() => switchMode('password')}>Password</button>
          <button type="button" className={mode === 'code' ? 'on' : ''} onClick={() => switchMode('code')}>Email code</button>
        </div>

        {mode === 'password' ? (
          <>
            {emailInput(() => password && signInWithPassword())}
            <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && password && signInWithPassword()} />
            <button className="btn primary" disabled={busy || !email || !password} onClick={signInWithPassword}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        ) : !sent ? (
          <>
            <p>We'll email you a sign-in code. Only a few codes can be sent per hour.</p>
            {emailInput(sendCode)}
            <button className="btn primary" disabled={busy || !email} onClick={sendCode}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <p>Check {email} for your code, then enter it here. You can also tap the link in the email.</p>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && code && verifyCode()} />
            <button className="btn primary" disabled={busy || code.trim().length < 6} onClick={verifyCode}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button className="btn ghost" onClick={() => switchMode('code')}>Use a different email</button>
          </>
        )}
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>
    </div>
  )
}

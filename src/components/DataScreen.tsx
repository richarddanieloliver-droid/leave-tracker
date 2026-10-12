import { useRef, useState } from 'react'
import { todayIso } from '../lib/dates'
import { entryDays, entryStatus, STATUS_LABEL } from '../lib/leave'
import { makeBackup, parseBackup, store, supabase } from '../lib/store'
import type { Backup, LeaveEntry, LeaveYear } from '../lib/types'

interface Props {
  years: LeaveYear[]
  entries: LeaveEntry[]
  email: string | null
  onReplace: (b: Backup) => Promise<void>
  onSignOut: () => void
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function toCsv(years: LeaveYear[], entries: LeaveEntry[]) {
  const q = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const yn = (b: boolean) => (b ? 'Y' : 'N')
  const lines = [['Year', 'Reason', 'From', 'To', 'AM/PM/All', 'Days', 'Status', 'Requested', 'Approved', 'Cancelled on', 'Notes']]
  const sorted = [...entries].sort((a, b) => a.year - b.year || (a.from_date ?? '9').localeCompare(b.from_date ?? '9'))
  for (const e of sorted) {
    lines.push([e.year, e.reason, e.from_date, e.to_date, e.part_of_day, entryDays(e), STATUS_LABEL[entryStatus(e)],
      yn(e.requested), yn(e.approved), e.cancelled_on, e.notes].map(q) as string[])
  }
  lines.push([])
  lines.push(['Year', 'Entitlement', 'Carried in', 'Adjustment', 'Adjustment note'])
  for (const y of years) lines.push([y.year, y.base_entitlement, y.carried_in, y.adjustment, y.adjustment_note].map(q) as string[])
  return '﻿' + lines.map((l) => l.join(',')).join('\r\n') // BOM so Excel reads it as UTF-8
}

/** Lets you sign in with a password on other devices instead of waiting for an email code. */
function SetPassword() {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const mismatch = pw2.length > 0 && pw !== pw2

  async function save() {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase!.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setMsg({ text: error.message, error: true })
    else {
      setMsg({ text: 'Password saved. Use it to sign in on your other devices.' })
      setPw('')
      setPw2('')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
      <span className="field-label">Set or change password</span>
      <div className="row2">
        <input type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input type="password" autoComplete="new-password" placeholder="Repeat it" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </div>
      {mismatch && <p style={{ color: 'var(--danger)' }}>The passwords don't match.</p>}
      <div>
        <button className="btn small" disabled={busy || pw.length < 8 || pw !== pw2} onClick={save}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
        {pw.length > 0 && pw.length < 8 && <small style={{ color: 'var(--muted)', marginLeft: 10 }}>At least 8 characters</small>}
      </div>
      {msg && <p style={{ color: msg.error ? 'var(--danger)' : 'var(--mint)' }}>{msg.text}</p>}
    </div>
  )
}

export function DataScreen({ years, entries, email, onReplace, onSignOut }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function importFile(file: File) {
    setMsg(null)
    try {
      const backup = parseBackup(await file.text())
      const ok = confirm(
        `Replace ALL your current data (${years.length} years, ${entries.length} entries) with this file ` +
          `(${backup.years.length} years, ${backup.entries.length} entries)?\n\nTip: export a backup first.`,
      )
      if (!ok) return
      setBusy(true)
      await onReplace(backup)
      setMsg(`Imported ${backup.entries.length} entries.`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="panel-grid">
      <div>
        <h1 className="page-title">Your data</h1>
        <p className="page-sub">Keep a copy of your leave history and take it with you.</p>
      </div>

      <div className="card panel">
        <h3>Back up</h3>
        <p>The backup file holds everything and can be imported again here. The Excel file is for reading.</p>
        <div className="actions" style={{ marginTop: 4 }}>
          <button className="btn" onClick={() => download(`leave-backup-${todayIso()}.json`, JSON.stringify(makeBackup(years, entries), null, 2), 'application/json')}>
            Download backup (.json)
          </button>
          <button className="btn" onClick={() => download(`leave-${todayIso()}.csv`, toCsv(years, entries), 'text/csv')}>
            Export for Excel (.csv)
          </button>
        </div>
      </div>

      <div className="card panel">
        <h3>Restore / import</h3>
        <p>Load a backup file, or the file made from your old spreadsheet. This replaces everything currently in the app.</p>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        <div className="actions" style={{ marginTop: 4 }}>
          <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Importing…' : 'Choose file…'}
          </button>
        </div>
        {msg && <p style={{ color: 'var(--text)' }}>{msg}</p>}
      </div>

      <div className="card panel">
        <h3>Account</h3>
        {store.mode === 'demo' ? (
          <p>
            <b style={{ color: 'var(--amber)' }}>Demo mode.</b> Data is only saved in this browser. Connect the app to
            Supabase to save it online.
          </p>
        ) : (
          <>
            <p>Signed in as {email}. Your data is stored in your own Supabase database.</p>
            <SetPassword />
            <div className="actions" style={{ marginTop: 4 }}>
              <button className="btn ghost" onClick={onSignOut}>Sign out</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

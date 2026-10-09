import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Dashboard } from './components/Dashboard'
import { DataScreen } from './components/DataScreen'
import { EntrySheet } from './components/EntrySheet'
import { BellIcon, DataIcon, HomeIcon, PlusIcon } from './components/icons'
import { Login } from './components/Login'
import { ReviewScreen } from './components/ReviewScreen'
import { YearSheet } from './components/YearSheet'
import { entryStatus, summarise } from './lib/leave'
import { store, supabase } from './lib/store'
import type { Backup, LeaveEntry, LeaveYear, NewEntry, NewYear } from './lib/types'

type Tab = 'home' | 'review' | 'data'
type SheetState = { kind: 'entry'; entry: LeaveEntry | null } | { kind: 'year' } | null

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="loading">Loading…</div>
  if (supabase && !session) return <Login />
  return <Tracker email={session?.user.email ?? null} />
}

function Tracker({ email }: { email: string | null }) {
  const [years, setYears] = useState<LeaveYear[]>([])
  const [entries, setEntries] = useState<LeaveEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
  const [year, setYear] = useState(new Date().getFullYear())
  const [sheet, setSheet] = useState<SheetState>(null)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error })
    setTimeout(() => setToast(null), error ? 6000 : 2500)
  }, [])

  const reload = useCallback(async () => {
    try {
      const d = await store.load()
      setYears(d.years)
      setEntries(d.entries)
    } catch (err) {
      notify(`Couldn't load your data: ${(err as Error).message}`, true)
    } finally {
      setLoaded(true)
    }
  }, [notify])

  useEffect(() => {
    reload()
  }, [reload])

  const run = async <T,>(fn: () => Promise<T>, done?: string) => {
    try {
      const out = await fn()
      if (done) notify(done)
      return out
    } catch (err) {
      notify(`Couldn't save: ${(err as Error).message}`, true)
      throw err
    }
  }

  async function saveEntry(e: NewEntry) {
    const row = await run(() => store.saveEntry(e), 'Saved')
    setEntries((list) => [...list.filter((x) => x.id !== row.id), row])
  }
  async function deleteEntry(e: LeaveEntry) {
    await run(() => store.deleteEntry(e.id), 'Deleted')
    setEntries((list) => list.filter((x) => x.id !== e.id))
  }
  async function approve(e: LeaveEntry) {
    await saveEntry({ ...e, requested: true, approved: true }).catch(() => {})
  }
  async function saveYear(y: NewYear) {
    const row = await run(() => store.saveYear(y), 'Saved')
    setYears((list) => [...list.filter((x) => x.year !== row.year), row].sort((a, b) => a.year - b.year))
  }
  async function replaceAll(b: Backup) {
    await run(() => store.replaceAll(b))
    await reload()
  }

  const yearRows = useMemo(() => new Map(years.map((y) => [y.year, y])), [years])
  const allYears = useMemo(
    () => [...new Set([...years.map((y) => y.year), ...entries.map((e) => e.year), year])].sort((a, b) => a - b),
    [years, entries, year],
  )
  const yearRow = yearRows.get(year)
  const summary = yearRow ? summarise(yearRow, entries, yearRows.get(year + 1)) : null
  const yearEntries = entries.filter((e) => e.year === year)
  const pendingCount = entries.filter((e) => entryStatus(e) === 'pending').length
  const todoCount = entries.filter((e) => entryStatus(e) === 'pending' || e.needs_review).length

  const prevRow = yearRows.get(year - 1)
  const prevRemaining = prevRow ? summarise(prevRow, entries, yearRow).remaining : null
  const newYearDefaults: NewYear = {
    year, base_entitlement: Number(prevRow?.base_entitlement ?? 25),
    carried_in: 0, adjustment: 0, adjustment_note: null,
  }

  if (!loaded) return <div className="loading">Loading your leave…</div>

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="./icon.svg" alt="" />
          LEAVE
          {store.mode === 'demo' && <span className="demo-tag">DEMO</span>}
        </div>
        {pendingCount > 0 && (
          <button className="pending-chip" onClick={() => setTab('review')}>
            <span className="pulse-dot" />
            {pendingCount} awaiting approval
          </button>
        )}
      </header>

      {tab === 'home' && (
        <Dashboard
          year={year}
          yearRow={yearRow}
          allYears={allYears}
          summary={summary}
          entries={yearEntries}
          onSelectYear={setYear}
          onEditYear={() => setSheet({ kind: 'year' })}
          onOpen={(e) => setSheet({ kind: 'entry', entry: e })}
          onApprove={approve}
          onAdd={() => setSheet({ kind: 'entry', entry: null })}
        />
      )}
      {tab === 'review' && (
        <ReviewScreen entries={entries} onOpen={(e) => setSheet({ kind: 'entry', entry: e })} onApprove={approve} />
      )}
      {tab === 'data' && (
        <DataScreen years={years} entries={entries} email={email} onReplace={replaceAll} onSignOut={() => supabase?.auth.signOut()} />
      )}

      <nav className="nav" aria-label="Main">
        <button className={tab === 'home' ? 'on' : ''} onClick={() => setTab('home')}>
          <HomeIcon />
          Home
        </button>
        <button className={tab === 'review' ? 'on' : ''} onClick={() => setTab('review')}>
          <BellIcon />
          To do
          {todoCount > 0 && <span className="count">{todoCount}</span>}
        </button>
        <button className="add" aria-label="Add leave" onClick={() => setSheet({ kind: 'entry', entry: null })}>
          <PlusIcon />
        </button>
        <button className={tab === 'data' ? 'on' : ''} onClick={() => setTab('data')}>
          <DataIcon />
          Data
        </button>
        <button
          onClick={() => {
            setTab('home')
            setYear(new Date().getFullYear())
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, lineHeight: '22px' }}>{String(new Date().getFullYear()).slice(2)}</span>
          This year
        </button>
      </nav>

      {sheet?.kind === 'entry' && (
        <EntrySheet
          entry={sheet.entry}
          defaultYear={year}
          yearOptions={allYears.includes(year + 1) ? allYears : [...allYears, year + 1]}
          onSave={saveEntry}
          onDelete={deleteEntry}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'year' && (
        <YearSheet
          year={yearRow ?? newYearDefaults}
          isNew={!yearRow}
          prevRemaining={prevRemaining}
          onSave={saveYear}
          onClose={() => setSheet(null)}
        />
      )}

      {toast && <div className={`toast${toast.error ? ' error' : ''}`} role="status">{toast.text}</div>}
    </div>
  )
}

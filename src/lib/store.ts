import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backup, LeaveEntry, LeaveYear, NewEntry, NewYear } from './types'

/** Where the data lives. Supabase when configured; otherwise a demo store in this browser. */
export interface Store {
  readonly mode: 'cloud' | 'demo'
  load(): Promise<{ years: LeaveYear[]; entries: LeaveEntry[] }>
  saveYear(y: NewYear): Promise<LeaveYear>
  saveEntry(e: NewEntry): Promise<LeaveEntry>
  deleteEntry(id: string): Promise<void>
  /** Replaces all data with the contents of a backup file. */
  replaceAll(b: Backup): Promise<void>
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

const YEAR_COLS = 'id,year,base_entitlement,carried_in,adjustment,adjustment_note'
const ENTRY_COLS =
  'id,year,reason,from_date,to_date,part_of_day,days_override,requested,approved,cancelled,cancelled_on,notes,needs_review,review_note'

function pick<T extends object>(row: T, cols: string): T {
  return Object.fromEntries(cols.split(',').filter((c) => c in row).map((c) => [c, row[c as keyof T]])) as T
}

function cloudStore(db: SupabaseClient): Store {
  const check = <T>({ data, error }: { data: T | null; error: { message: string } | null }) => {
    if (error) throw new Error(error.message)
    return data as T
  }
  return {
    mode: 'cloud',
    async load() {
      const [years, entries] = await Promise.all([
        db.from('leave_years').select(YEAR_COLS).order('year'),
        db.from('leave_entries').select(ENTRY_COLS),
      ])
      return { years: check(years) as LeaveYear[], entries: check(entries) as LeaveEntry[] }
    },
    async saveYear(y) {
      const row = pick(y, YEAR_COLS)
      return check(await db.from('leave_years').upsert(row, { onConflict: 'user_id,year' }).select(YEAR_COLS).single())
    },
    async saveEntry(e) {
      return check(await db.from('leave_entries').upsert(pick(e, ENTRY_COLS)).select(ENTRY_COLS).single())
    },
    async deleteEntry(id) {
      check(await db.from('leave_entries').delete().eq('id', id))
    },
    async replaceAll(b) {
      // Runs in one database transaction (see replace_all in schema.sql): all or nothing.
      check(await db.rpc('replace_all', { backup: b }))
    },
  }
}

function demoStore(): Store {
  const KEY = 'leave-tracker-demo'
  const read = (): { years: LeaveYear[]; entries: LeaveEntry[] } => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '') ?? { years: [], entries: [] }
    } catch {
      return { years: [], entries: [] }
    }
  }
  const write = (d: ReturnType<typeof read>) => localStorage.setItem(KEY, JSON.stringify(d))
  const withId = <T extends { id?: string }>(x: T) => ({ ...x, id: x.id ?? crypto.randomUUID() })
  return {
    mode: 'demo',
    load: async () => read(),
    async saveYear(y) {
      const d = read()
      const row = withId(y) as LeaveYear
      d.years = [...d.years.filter((x) => x.year !== row.year), row].sort((a, b) => a.year - b.year)
      write(d)
      return row
    },
    async saveEntry(e) {
      const d = read()
      const row = withId(e) as LeaveEntry
      d.entries = [...d.entries.filter((x) => x.id !== row.id), row]
      write(d)
      return row
    },
    async deleteEntry(id) {
      const d = read()
      d.entries = d.entries.filter((x) => x.id !== id)
      write(d)
    },
    async replaceAll(b) {
      write({ years: b.years.map(withId) as LeaveYear[], entries: b.entries.map(withId) as LeaveEntry[] })
    },
  }
}

export const store: Store = supabase ? cloudStore(supabase) : demoStore()

export function makeBackup(years: LeaveYear[], entries: LeaveEntry[]): Backup {
  return { format: 'leave-tracker/v1', exported_at: new Date().toISOString(), years, entries }
}

export function parseBackup(text: string): Backup {
  const b = JSON.parse(text)
  if (b?.format !== 'leave-tracker/v1' || !Array.isArray(b.years) || !Array.isArray(b.entries)) {
    throw new Error('This is not a Leave Tracker backup file.')
  }
  return b
}

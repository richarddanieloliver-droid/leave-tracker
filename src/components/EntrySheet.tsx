import { useMemo, useState } from 'react'
import { formatWeekday, todayIso } from '../lib/dates'
import { countWorkingDays, fmtDays, plural } from '../lib/leave'
import type { LeaveEntry, NewEntry, PartOfDay } from '../lib/types'
import { Sheet, Switch } from './Sheet'

interface Props {
  entry: LeaveEntry | null // null = new entry
  defaultYear: number
  yearOptions: number[]
  onSave: (e: NewEntry) => Promise<void>
  onDelete: (e: LeaveEntry) => Promise<void>
  onClose: () => void
}

export function blankEntry(year: number): NewEntry {
  return {
    year, reason: '', from_date: null, to_date: null, part_of_day: 'All', days_override: null,
    requested: false, approved: false, cancelled: false, cancelled_on: null, notes: null,
    needs_review: false, review_note: null,
  }
}

export function EntrySheet({ entry, defaultYear, yearOptions, onSave, onDelete, onClose }: Props) {
  const [e, setE] = useState<NewEntry>(() => entry ?? blankEntry(defaultYear))
  const [yearTouched, setYearTouched] = useState(!!entry)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<NewEntry>) => setE((cur) => ({ ...cur, ...patch }))

  const singleDay = !!e.from_date && (!e.to_date || e.to_date === e.from_date)
  const calc = useMemo(
    () => (e.from_date ? countWorkingDays(e.from_date, e.to_date, singleDay ? e.part_of_day : 'All') : null),
    [e.from_date, e.to_date, e.part_of_day, singleDay],
  )
  const overriding = e.days_override != null
  const years = [...new Set([...yearOptions, e.year])].sort()
  const badRange = !!e.from_date && !!e.to_date && e.to_date < e.from_date

  function setFrom(v: string) {
    const from = v || null
    const to = from && (!e.to_date || e.to_date < from) ? from : e.to_date
    set({ from_date: from, to_date: from ? to : null, ...(from && !yearTouched ? { year: Number(from.slice(0, 4)) } : {}) })
  }

  async function save(patch: Partial<NewEntry> = {}) {
    const out = { ...e, ...patch, reason: e.reason.trim() }
    if (!out.from_date) out.to_date = null
    if (out.from_date && out.to_date !== out.from_date) out.part_of_day = 'All'
    setBusy(true)
    try {
      await onSave(out)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={entry ? 'Edit leave' : 'Add leave'} onClose={onClose}>
      {e.needs_review && (
        <div className="review-box">
          <div><b>Check this entry:</b> {e.review_note}</div>
          <div>
            <button className="btn small" onClick={() => set({ needs_review: false, review_note: null })}>
              It's correct – clear the flag
            </button>
          </div>
        </div>
      )}

      <label className="field">
        <span>Reason</span>
        <input type="text" value={e.reason} placeholder="e.g. Ireland trip" onChange={(ev) => set({ reason: ev.target.value })} autoFocus={!entry} />
      </label>

      <div className="row2">
        <label className="field">
          <span>From</span>
          <input type="date" value={e.from_date ?? ''} onChange={(ev) => setFrom(ev.target.value)} />
        </label>
        <label className="field">
          <span>To</span>
          <input type="date" value={e.to_date ?? ''} min={e.from_date ?? undefined} disabled={!e.from_date} onChange={(ev) => set({ to_date: ev.target.value || e.from_date })} />
        </label>
      </div>

      <div className="field">
        <span className="field-label">Part of day</span>
        <div className="seg">
          {(['All', 'AM', 'PM'] as PartOfDay[]).map((p) => (
            <button
              key={p}
              type="button"
              className={(singleDay ? e.part_of_day : 'All') === p ? 'on' : ''}
              disabled={p !== 'All' && !singleDay}
              title={p !== 'All' && !singleDay ? 'Half days are for single-day leave' : undefined}
              onClick={() => set({ part_of_day: p })}
            >
              {p === 'All' ? 'All day' : p}
            </button>
          ))}
        </div>
      </div>

      <div className="calc">
        {badRange ? (
          <span>The To date is before the From date.</span>
        ) : overriding ? (
          <>
            <div className="row2" style={{ alignItems: 'center' }}>
              <label className="field" style={{ margin: 0 }}>
                <span>Days (set by hand)</span>
                <input type="number" step={0.5} min={0} value={e.days_override ?? 0} onChange={(ev) => set({ days_override: ev.target.value === '' ? 0 : Number(ev.target.value) })} />
              </label>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {calc && <>Dates cover {fmtDays(calc.days)} working {plural(calc.days)}. </>}
                <button type="button" className="link-btn" onClick={() => set({ days_override: null })}>
                  Use automatic
                </button>
              </div>
            </div>
          </>
        ) : calc ? (
          <>
            <span className="big">{fmtDays(calc.days)}</span> working {plural(calc.days)}
            {calc.skipped.length > 0 && (
              <ul>
                {calc.skipped.map((s) => (
                  <li key={s.date}>Skips {formatWeekday(s.date)} – {s.why}</li>
                ))}
              </ul>
            )}
            <div style={{ marginTop: 6 }}>
              <button type="button" className="link-btn" onClick={() => set({ days_override: calc.days })}>
                Set the days by hand
              </button>
            </div>
          </>
        ) : (
          <>
            No dates yet. This will be saved as an idea.{' '}
            <button type="button" className="link-btn" onClick={() => set({ days_override: 1 })}>
              Estimate days
            </button>
          </>
        )}
      </div>

      <label className="field">
        <span>Counts against leave year</span>
        <select value={e.year} onChange={(ev) => { setYearTouched(true); set({ year: Number(ev.target.value) }) }}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>

      <div className="toggle-row">
        <div>
          Requested
          <small>You've asked your line manager</small>
        </div>
        <Switch label="Requested" on={e.requested} onChange={(v) => set({ requested: v, approved: v ? e.approved : false })} />
      </div>
      <div className="toggle-row">
        <div>
          Approved
          <small>{e.requested && !e.approved ? 'Waiting on your line manager' : 'Your line manager has said yes'}</small>
        </div>
        <Switch label="Approved" amber={e.requested && !e.approved} on={e.approved} onChange={(v) => set({ approved: v, requested: v || e.requested })} />
      </div>

      <label className="field" style={{ marginTop: 14 }}>
        <span>Notes</span>
        <textarea value={e.notes ?? ''} onChange={(ev) => set({ notes: ev.target.value || null })} />
      </label>

      {e.cancelled && (
        <div className="review-box" style={{ borderColor: 'var(--line)', background: 'rgba(255,255,255,0.04)', color: 'var(--muted)' }}>
          Cancelled{e.cancelled_on ? ` on ${formatWeekday(e.cancelled_on)} ${e.cancelled_on.slice(0, 4)}` : ''}. It doesn't count towards your total.
        </div>
      )}

      <div className="actions">
        <button className="btn primary" disabled={busy || !e.reason.trim() || badRange} onClick={() => save()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {entry && !e.cancelled && (
          <button className="btn ghost" disabled={busy} onClick={() => save({ cancelled: true, cancelled_on: todayIso() })}>
            Cancel this leave
          </button>
        )}
        {entry && e.cancelled && (
          <button className="btn ghost" disabled={busy} onClick={() => save({ cancelled: false, cancelled_on: null })}>
            Restore
          </button>
        )}
        {entry && (
          <button
            className="btn danger"
            disabled={busy}
            onClick={async () => {
              if (!confirm(`Delete "${entry.reason}" permanently?`)) return
              setBusy(true)
              try {
                await onDelete(entry)
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            Delete
          </button>
        )}
      </div>
    </Sheet>
  )
}

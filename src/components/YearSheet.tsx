import { useState } from 'react'
import { fmtDays, plural } from '../lib/leave'
import type { NewYear } from '../lib/types'
import { Sheet } from './Sheet'

interface Props {
  year: NewYear
  isNew: boolean
  prevRemaining: number | null // what was left in the previous year, as a hint for carry-over
  onSave: (y: NewYear) => Promise<void>
  onClose: () => void
}

export function YearSheet({ year, isNew, prevRemaining, onSave, onClose }: Props) {
  const [y, setY] = useState(year)
  const [busy, setBusy] = useState(false)
  const num = (v: string) => (v === '' ? 0 : Number(v))
  const total = Number(y.base_entitlement) + Number(y.carried_in) + Number(y.adjustment)
  // prevRemaining already has this year's saved carry-over taken off; add it back to show what was unused
  const unused = prevRemaining == null ? null : prevRemaining + Number(year.carried_in)

  return (
    <Sheet title={isNew ? `Set up ${y.year}` : `${y.year} allowance`} onClose={onClose}>
      <label className="field">
        <span>Annual entitlement (days)</span>
        <input type="number" step={0.5} min={0} value={y.base_entitlement} onChange={(e) => setY({ ...y, base_entitlement: num(e.target.value) })} />
      </label>

      <label className="field">
        <span>Carried over from {y.year - 1}</span>
        <input type="number" step={0.5} min={0} value={y.carried_in} onChange={(e) => setY({ ...y, carried_in: num(e.target.value) })} />
        {unused != null && (
          <small style={{ color: 'var(--muted)' }}>
            {y.year - 1} has {fmtDays(unused)} {plural(unused)} not planned or used. Days carried over are taken off{' '}
            {y.year - 1}'s total.
          </small>
        )}
      </label>

      <div className="row2">
        <label className="field">
          <span>Other adjustment</span>
          <input type="number" step={0.5} value={y.adjustment} onChange={(e) => setY({ ...y, adjustment: num(e.target.value) })} />
        </label>
        <label className="field">
          <span>Reason</span>
          <input type="text" placeholder="e.g. borrowed 1 day" value={y.adjustment_note ?? ''} onChange={(e) => setY({ ...y, adjustment_note: e.target.value || null })} />
        </label>
      </div>

      <div className="calc">
        Total allowance for {y.year}: <span className="big">{fmtDays(total)}</span> {plural(total)}
      </div>

      <div className="actions">
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave(y)
              onClose()
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Sheet>
  )
}

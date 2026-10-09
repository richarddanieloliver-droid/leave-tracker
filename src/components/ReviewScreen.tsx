import { entryStatus, sortEntries } from '../lib/leave'
import type { LeaveEntry } from '../lib/types'
import { EntryCard } from './EntryCard'

interface Props {
  entries: LeaveEntry[]
  onOpen: (e: LeaveEntry) => void
  onApprove: (e: LeaveEntry) => void
}

/** Everything that needs action, across all years. */
export function ReviewScreen({ entries, onOpen, onApprove }: Props) {
  const pending = sortEntries(entries.filter((e) => entryStatus(e) === 'pending'))
  const flagged = sortEntries(entries.filter((e) => e.needs_review && entryStatus(e) !== 'pending'))
  const card = (e: LeaveEntry) => <EntryCard key={e.id} entry={e} onOpen={onOpen} onApprove={onApprove} showYear />

  return (
    <div className="panel-grid" style={{ maxWidth: 760 }}>
      <div>
        <h1 className="page-title">To do</h1>
        <p className="page-sub">Leave waiting for your line manager, and entries that need checking.</p>
      </div>

      <div className="section-title amber"><span>Awaiting approval</span><span>{pending.length}</span></div>
      {pending.length ? <div className="list">{pending.map(card)}</div> : <div className="card empty">Nothing waiting for approval.</div>}

      <div className="section-title"><span>Needs checking</span><span>{flagged.length}</span></div>
      {flagged.length ? (
        <div className="list">{flagged.map(card)}</div>
      ) : (
        <div className="card empty">Nothing to check.</div>
      )}
    </div>
  )
}

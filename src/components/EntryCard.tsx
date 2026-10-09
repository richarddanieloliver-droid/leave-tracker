import { dayOfMonth, formatRange, monthAbbr } from '../lib/dates'
import { entryDays, entryStatus, fmtDays, isTaken, plural, STATUS_LABEL } from '../lib/leave'
import type { LeaveEntry } from '../lib/types'

interface Props {
  entry: LeaveEntry
  onOpen: (e: LeaveEntry) => void
  onApprove: (e: LeaveEntry) => void
  showYear?: boolean
}

export function EntryCard({ entry, onOpen, onApprove, showYear }: Props) {
  const status = entryStatus(entry)
  const days = entryDays(entry)
  const taken = isTaken(entry)
  const part = entry.part_of_day !== 'All' ? ` · ${entry.part_of_day}` : ''

  return (
    <div
      role="button"
      tabIndex={0}
      className={`entry ${status}${taken ? ' taken' : ''}`}
      onClick={() => onOpen(entry)}
      onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onOpen(entry))}
    >
      {entry.from_date ? (
        <div className="tile">
          <small>{monthAbbr(entry.from_date)}</small>
          <b>{dayOfMonth(entry.from_date)}</b>
        </div>
      ) : (
        <div className="tile undated">?</div>
      )}

      <div style={{ minWidth: 0 }}>
        <div className="entry-title">{entry.reason}</div>
        <div className="entry-sub">
          {showYear && <span className="year-tag">{entry.year}</span>}
          {entry.from_date ? formatRange(entry.from_date, entry.to_date) + part : 'No dates yet'}
          {taken && ' · taken'}
          {status === 'pending' && <span className="flag"> · awaiting approval</span>}
          {entry.needs_review && <span className="flag"> · needs checking</span>}
        </div>
      </div>

      <div className="entry-right">
        {!entry.from_date && entry.days_override == null ? (
          <div className="entry-days"><small>Days TBC</small></div>
        ) : (
          <div className="entry-days">
            {fmtDays(days)}
            <small>{plural(days)}</small>
          </div>
        )}
        {status === 'pending' ? (
          <button
            className="approve-btn"
            title="Mark as approved"
            onClick={(ev) => {
              ev.stopPropagation()
              onApprove(entry)
            }}
          >
            Approve ✓
          </button>
        ) : (
          <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
        )}
      </div>
    </div>
  )
}

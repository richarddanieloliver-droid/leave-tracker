import { entryStatus, fmtDays, isTaken, plural, sortEntries, type YearSummary } from '../lib/leave'
import type { LeaveEntry, LeaveYear } from '../lib/types'
import { EntryCard } from './EntryCard'
import { ChevronIcon, GearIcon } from './icons'

interface Props {
  year: number
  yearRow: LeaveYear | undefined
  allYears: number[]
  summary: YearSummary | null
  entries: LeaveEntry[]
  onSelectYear: (y: number) => void
  onEditYear: () => void
  onOpen: (e: LeaveEntry) => void
  onApprove: (e: LeaveEntry) => void
  onAdd: () => void
}

function Ring({ remaining, allowance }: { remaining: number; allowance: number }) {
  const r = 52, c = 2 * Math.PI * r
  const frac = allowance > 0 ? Math.max(0, Math.min(1, remaining / allowance)) : 0
  return (
    <svg className="ring" viewBox="0 0 128 128" role="img" aria-label={`${fmtDays(remaining)} days left of ${fmtDays(allowance)}`}>
      <circle cx="64" cy="64" r={r} fill="rgba(13,7,22,0.35)" stroke="rgba(255,255,255,0.22)" strokeWidth="10" />
      <circle
        cx="64" cy="64" r={r} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 64 64)"
      />
      <text x="64" y="66" textAnchor="middle" fontSize="34" fontWeight="700">{fmtDays(remaining)}</text>
      <text x="64" y="88" textAnchor="middle" fontSize="11" letterSpacing="2" opacity="0.85">DAYS LEFT</text>
    </svg>
  )
}

const Mountains = () => (
  <svg className="mountains" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd0ec" stopOpacity="0.55" />
        <stop offset="1" stopColor="#b44cff" stopOpacity="0.1" />
      </linearGradient>
      <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7b2ff7" stopOpacity="0.9" />
        <stop offset="1" stopColor="#2a0e5c" stopOpacity="0.95" />
      </linearGradient>
    </defs>
    <path d="M0 110 L70 50 L120 85 L190 20 L260 80 L310 45 L400 100 L400 160 L0 160Z" fill="url(#m1)" />
    <path d="M0 140 L60 95 L110 120 L170 70 L240 125 L300 85 L360 115 L400 95 L400 160 L0 160Z" fill="url(#m2)" />
  </svg>
)

export function Dashboard(p: Props) {
  const { summary: s } = p
  const sorted = sortEntries(p.entries)
  const pending = sorted.filter((e) => entryStatus(e) === 'pending')
  const upcoming = sorted.filter((e) => entryStatus(e) === 'approved' && !isTaken(e))
  const taken = sorted.filter((e) => isTaken(e))
  const ideas = sorted.filter((e) => entryStatus(e) === 'idea')
  const cancelled = sorted.filter((e) => e.cancelled)
  const idx = p.allYears.indexOf(p.year)

  const card = (e: LeaveEntry) => <EntryCard key={e.id} entry={e} onOpen={p.onOpen} onApprove={p.onApprove} />
  const section = (title: string, list: LeaveEntry[], amber = false) =>
    list.length > 0 && (
      <>
        <div className={`section-title${amber ? ' amber' : ''}`}>
          <span>{title}</span>
          <span>{list.length}</span>
        </div>
        <div className="list">{list.map(card)}</div>
      </>
    )

  const pct = (n: number) => `${s && s.allowance > 0 ? Math.max(0, (n / s.allowance) * 100) : 0}%`

  return (
    <div className="dash">
      <div className="side">
        <div className="years">
          <button className="icon-btn" aria-label="Previous year" disabled={idx <= 0} onClick={() => p.onSelectYear(p.allYears[idx - 1])}>
            <ChevronIcon dir="left" />
          </button>
          <div className="scroll">
            {p.allYears.map((y) => (
              <button
                key={y}
                className={`year-pill${y === p.year ? ' on' : ''}`}
                ref={y === p.year ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined}
                onClick={() => p.onSelectYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          <button className="icon-btn" aria-label="Next year" onClick={() => p.onSelectYear(idx < p.allYears.length - 1 ? p.allYears[idx + 1] : p.year + 1)}>
            <ChevronIcon dir="right" />
          </button>
        </div>

        <div className="hero">
          <Mountains />
          <div className="hero-top">
            <div>
              <div className="hero-label">Leave year</div>
              <div className="hero-year">{p.year}</div>
            </div>
            <button className="icon-btn" onClick={p.onEditYear} aria-label="Edit allowance">
              <GearIcon />
            </button>
          </div>
          {s ? (
            <div className="hero-body">
              <Ring remaining={s.remaining} allowance={s.allowance} />
              <div className="hero-note">
                <strong>{fmtDays(s.allowance)} {plural(s.allowance)}</strong> allowance
                {p.yearRow && Number(p.yearRow.carried_in) > 0 && <><br />incl. {fmtDays(Number(p.yearRow.carried_in))} carried over</>}
                {s.pending > 0 && <><br /><span className="warn">{fmtDays(s.pending)} {plural(s.pending)} awaiting approval</span></>}
                {s.remaining < 0 && <><br /><span className="warn">Over by {fmtDays(-s.remaining)} {plural(-s.remaining)}</span></>}
              </div>
            </div>
          ) : (
            <div className="hero-body">
              <div className="hero-note">
                No allowance set for {p.year} yet.
                <br />
                <button className="btn small" style={{ marginTop: 10 }} onClick={p.onEditYear}>
                  Set up {p.year}
                </button>
              </div>
            </div>
          )}
        </div>

        {s && (
          <div className="card">
            <div className="stats">
              <div className="stat taken"><b>{fmtDays(s.taken)}</b><span>Taken</span></div>
              <div className="stat booked"><b>{fmtDays(s.booked)}</b><span>Booked</span></div>
              <div className="stat pending"><b>{fmtDays(s.pending)}</b><span>Awaiting</span></div>
              <div className="stat ideas"><b>{fmtDays(s.ideas)}</b><span>Ideas</span></div>
            </div>
            <div className="bar" aria-hidden="true">
              <i className="taken" style={{ width: pct(s.taken) }} />
              <i className="booked" style={{ width: pct(s.booked) }} />
              <i className="pending" style={{ width: pct(s.pending) }} />
              <i className="ideas" style={{ width: pct(s.ideas) }} />
              <i className="carried" style={{ width: pct(s.carriedOut) }} />
            </div>
            {s.carriedOut > 0 && (
              <div className="allowance-line">{fmtDays(s.carriedOut)} {plural(s.carriedOut)} carried over to {p.year + 1}</div>
            )}
          </div>
        )}
      </div>

      <div className="main">
        {p.entries.length === 0 ? (
          <div className="card empty">
            No leave recorded for {p.year}.
            <div style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={p.onAdd}>Add leave</button>
            </div>
          </div>
        ) : (
          <>
            {section('Awaiting approval', pending, true)}
            {section('Coming up', upcoming)}
            {section('Ideas', ideas)}
            {section('Taken', taken)}
            {cancelled.length > 0 && (
              <details className="cancelled-list">
                <summary>Show {cancelled.length} cancelled</summary>
                <div className="list">{cancelled.map(card)}</div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  )
}

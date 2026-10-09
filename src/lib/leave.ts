import { bankHolidayName } from './bankHolidays'
import { addDays, toDate, toIso, todayIso } from './dates'
import type { LeaveEntry, LeaveYear, PartOfDay, Status } from './types'

export interface DayCount {
  days: number
  skipped: { date: string; why: string }[]
}

/** Working days between two dates (inclusive), skipping weekends and England & Wales bank holidays. */
export function countWorkingDays(from: string, to: string | null, part: PartOfDay): DayCount {
  const end = to && to >= from ? to : from
  const skipped: DayCount['skipped'] = []
  let days = 0
  for (let d = toDate(from); toIso(d) <= end; d = addDays(d, 1)) {
    const iso = toIso(d)
    const bh = bankHolidayName(iso)
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6
    if (bh) skipped.push({ date: iso, why: bh })
    else if (!weekend) days++
  }
  if (from === end && part !== 'All' && days === 1) days = 0.5
  return { days, skipped }
}

export function entryDays(e: Pick<LeaveEntry, 'cancelled' | 'days_override' | 'from_date' | 'to_date' | 'part_of_day'>) {
  if (e.cancelled) return 0
  if (e.days_override != null) return Number(e.days_override)
  if (!e.from_date) return 0
  return countWorkingDays(e.from_date, e.to_date, e.part_of_day).days
}

export function entryStatus(e: Pick<LeaveEntry, 'cancelled' | 'requested' | 'approved'>): Status {
  if (e.cancelled) return 'cancelled'
  if (e.approved) return 'approved'
  if (e.requested) return 'pending'
  return 'idea'
}

export const STATUS_LABEL: Record<Status, string> = {
  idea: 'Idea',
  pending: 'Awaiting approval',
  approved: 'Approved',
  cancelled: 'Cancelled',
}

export const isTaken = (e: LeaveEntry, today = todayIso()) =>
  entryStatus(e) === 'approved' && !!e.from_date && (e.to_date ?? e.from_date) < today

export interface YearSummary {
  allowance: number
  carriedOut: number
  taken: number // approved and already in the past
  booked: number // approved, still to come (or undated)
  pending: number
  ideas: number
  remaining: number // allowance minus everything not cancelled, minus days carried into next year
}

export function summarise(year: LeaveYear, entries: LeaveEntry[], nextYear?: LeaveYear): YearSummary {
  const allowance = Number(year.base_entitlement) + Number(year.carried_in) + Number(year.adjustment)
  const carriedOut = nextYear ? Number(nextYear.carried_in) : 0
  const s = { taken: 0, booked: 0, pending: 0, ideas: 0 }
  const today = todayIso()
  for (const e of entries) {
    if (e.year !== year.year) continue
    const d = entryDays(e)
    const st = entryStatus(e)
    if (st === 'approved') s[isTaken(e, today) ? 'taken' : 'booked'] += d
    else if (st === 'pending') s.pending += d
    else if (st === 'idea') s.ideas += d
  }
  return { allowance, carriedOut, ...s, remaining: allowance - s.taken - s.booked - s.pending - s.ideas - carriedOut }
}

/** Display order: dated entries by date, then undated ideas, cancelled last. */
export function sortEntries(list: LeaveEntry[]) {
  const rank = (e: LeaveEntry) => (e.cancelled ? 2 : e.from_date ? 0 : 1)
  return [...list].sort(
    (a, b) => rank(a) - rank(b) || (a.from_date ?? '').localeCompare(b.from_date ?? '') || a.reason.localeCompare(b.reason),
  )
}

export const fmtDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
export const plural = (n: number) => (n === 1 ? 'day' : 'days')

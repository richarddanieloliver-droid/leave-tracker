import { describe, expect, it } from 'vitest'
import { bankHolidays } from './bankHolidays'
import { countWorkingDays, entryStatus, summarise } from './leave'
import type { LeaveEntry, LeaveYear } from './types'

describe('bank holidays', () => {
  it('matches gov.uk for awkward years', () => {
    expect([...bankHolidays(2022).keys()].sort()).toEqual([
      '2022-01-03', '2022-04-15', '2022-04-18', '2022-05-02', '2022-06-02', '2022-06-03',
      '2022-08-29', '2022-09-19', '2022-12-26', '2022-12-27',
    ])
    expect([...bankHolidays(2027).keys()].sort()).toEqual([
      '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30',
      '2027-12-27', '2027-12-28',
    ])
  })
})

describe('countWorkingDays', () => {
  it('skips weekends and bank holidays', () => {
    // Thu 24 – Thu 31 Dec 2026: Fri 25th and Mon 28th (substitute Boxing Day) are holidays
    expect(countWorkingDays('2026-12-24', '2026-12-31', 'All').days).toBe(4)
  })
  it('counts half days', () => {
    expect(countWorkingDays('2026-03-05', '2026-03-05', 'PM').days).toBe(0.5)
    expect(countWorkingDays('2026-03-07', '2026-03-07', 'PM').days).toBe(0) // Saturday
  })
})

describe('summarise', () => {
  const year: LeaveYear = { id: 'y', year: 2026, base_entitlement: 25, carried_in: 2, adjustment: 0, adjustment_note: null }
  const base: LeaveEntry = {
    id: '', year: 2026, reason: '', from_date: '2026-01-05', to_date: '2026-01-06', part_of_day: 'All',
    days_override: null, requested: true, approved: true, cancelled: false, cancelled_on: null, notes: null,
    needs_review: false, review_note: null,
  }
  it('adds up by status and deducts carry-over into next year', () => {
    const entries = [
      base,
      { ...base, approved: false },
      { ...base, requested: false, approved: false, days_override: 3 },
      { ...base, cancelled: true },
    ]
    const s = summarise(year, entries, { ...year, year: 2027, carried_in: 1 })
    expect(s.allowance).toBe(27)
    expect(s.taken + s.booked).toBe(2)
    expect(s.pending).toBe(2)
    expect(s.ideas).toBe(3)
    expect(s.remaining).toBe(27 - 7 - 1)
    expect(entryStatus({ ...base, approved: false })).toBe('pending')
  })
})

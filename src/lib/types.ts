export type PartOfDay = 'All' | 'AM' | 'PM'
export type Status = 'idea' | 'pending' | 'approved' | 'cancelled'

export interface LeaveYear {
  id: string
  year: number
  base_entitlement: number
  carried_in: number
  adjustment: number
  adjustment_note: string | null
}

export interface LeaveEntry {
  id: string
  year: number
  reason: string
  from_date: string | null // ISO yyyy-mm-dd
  to_date: string | null
  part_of_day: PartOfDay
  days_override: number | null
  requested: boolean
  approved: boolean
  cancelled: boolean
  cancelled_on: string | null
  notes: string | null
  needs_review: boolean
  review_note: string | null
}

export type NewYear = Omit<LeaveYear, 'id'> & { id?: string }
export type NewEntry = Omit<LeaveEntry, 'id'> & { id?: string }

/** Shape of an export / import file. */
export interface Backup {
  format: 'leave-tracker/v1'
  exported_at?: string
  years: NewYear[]
  entries: NewEntry[]
}

import { addDays, toIso } from './dates'

// England & Wales bank holidays, calculated from the standard rules plus known one-off changes.
// Checked against https://www.gov.uk/bank-holidays.json for 2019–2028.

function easterSunday(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(y, month - 1, day))
}

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

function firstMonday(y: number, m: number) {
  const d = utc(y, m, 1)
  return addDays(d, (8 - d.getUTCDay()) % 7)
}

function lastMonday(y: number, m: number) {
  const d = utc(y, m + 1, 0)
  return addDays(d, -((d.getUTCDay() + 6) % 7))
}

const ONE_OFF: Record<number, { remove?: string[]; add?: string[] }> = {
  2020: { remove: ['2020-05-04'], add: ['2020-05-08'] }, // VE Day
  2022: { remove: ['2022-05-30'], add: ['2022-06-02', '2022-06-03', '2022-09-19'] }, // Jubilee, State funeral
  2023: { add: ['2023-05-08'] }, // Coronation
}

// Substitute days: New Year on a weekend moves to Monday; Christmas/Boxing Day move past the weekend.
const NEW_YEAR_SHIFT: Record<number, number> = { 6: 2, 0: 1 }
const XMAS_DAYS: Record<number, [number, number]> = { 5: [25, 28], 6: [27, 28], 0: [26, 27] }

const cache = new Map<number, Map<string, string>>()

/** Map of ISO date -> holiday name for the given year. */
export function bankHolidays(y: number): Map<string, string> {
  const hit = cache.get(y)
  if (hit) return hit
  const out = new Map<string, string>()
  const ny = utc(y, 1, 1)
  out.set(toIso(addDays(ny, NEW_YEAR_SHIFT[ny.getUTCDay()] ?? 0)), "New Year's Day")
  const easter = easterSunday(y)
  out.set(toIso(addDays(easter, -2)), 'Good Friday')
  out.set(toIso(addDays(easter, 1)), 'Easter Monday')
  out.set(toIso(firstMonday(y, 5)), 'Early May bank holiday')
  out.set(toIso(lastMonday(y, 5)), 'Spring bank holiday')
  out.set(toIso(lastMonday(y, 8)), 'Summer bank holiday')
  const [xmas, boxing] = XMAS_DAYS[utc(y, 12, 25).getUTCDay()] ?? [25, 26]
  out.set(toIso(utc(y, 12, xmas)), 'Christmas Day')
  out.set(toIso(utc(y, 12, boxing)), 'Boxing Day')
  ONE_OFF[y]?.remove?.forEach((d) => out.delete(d))
  ONE_OFF[y]?.add?.forEach((d) => out.set(d, 'Bank holiday'))
  cache.set(y, out)
  return out
}

export const bankHolidayName = (iso: string) => bankHolidays(Number(iso.slice(0, 4))).get(iso)

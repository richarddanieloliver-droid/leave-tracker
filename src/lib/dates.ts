// All dates are ISO 'yyyy-mm-dd' strings handled in UTC so time zones never shift a day.

export const toDate = (iso: string) => new Date(iso + 'T00:00:00Z')
export const toIso = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)
export const todayIso = () => {
  const n = new Date()
  return toIso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())))
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts })
const weekday = fmt({ weekday: 'short', day: 'numeric', month: 'short' })
const month = fmt({ month: 'short' })

export const formatWeekday = (iso: string) => weekday.format(toDate(iso)) // "Tue 13 Oct"
export const formatFull = (iso: string) => `${formatWeekday(iso)} ${iso.slice(0, 4)}` // "Tue 13 Oct 2026"
export const monthAbbr = (iso: string) => month.format(toDate(iso)).toUpperCase()
export const dayOfMonth = (iso: string) => toDate(iso).getUTCDate()

export function formatRange(from: string, to: string | null) {
  if (!to || to === from) return formatFull(from)
  if (from.slice(0, 4) !== to.slice(0, 4)) return `${formatFull(from)} – ${formatFull(to)}`
  return `${formatWeekday(from)} – ${formatFull(to)}`
}

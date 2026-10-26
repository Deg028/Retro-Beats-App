// What was listened to, by month, and what a month or a year of it comes to. No screens or storage in here.

/** What one song added up to in one month: seconds heard and the names it had then (so the recap survives a rescan). */
export type Stat = { s: number; t: string; a: string; al?: string | null }
/** "2026-10" -> song id -> stat */
export type ListeningLog = Record<string, Record<string, Stat>>

export type Period = { kind: "month" | "year"; key: string }
export type Ranked = { name: string; detail?: string; seconds: number }
export type Summary = {
  seconds: number
  /** Different songs heard */
  songCount: number
  songs: Ranked[]
  artists: Ranked[]
  albums: Ranked[]
}

const UNKNOWN_ARTIST = "Artista desconocido"
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
export const yearKey = (d: Date) => String(d.getFullYear())

/** Adds seconds of a song to the log, in the month of `when`. Returns the same log. */
export function addListening(log: ListeningLog, song: { id: number; title: string; artist: string; album?: string | null }, seconds: number, when: Date): ListeningLog {
  if (!(seconds > 0)) return log
  const month = (log[monthKey(when)] ??= {})
  const stat = (month[song.id] ??= { s: 0, t: song.title, a: song.artist })
  stat.s += seconds
  // Names are kept as of the latest listen, in case a lookup fixed them
  stat.t = song.title
  stat.a = song.artist
  if (song.album) stat.al = song.album
  return log
}

const inPeriod = (monthKeyOf: string, period: Period) => (period.kind === "month" ? monthKeyOf === period.key : monthKeyOf.startsWith(`${period.key}-`))

/** The totals and rankings of a month or a year. Songs are ranked by time heard. */
export function summarize(log: ListeningLog, period: Period): Summary {
  const songs = new Map<string, Ranked>()
  const artists = new Map<string, Ranked>()
  const albums = new Map<string, Ranked>()
  let seconds = 0
  const bump = (map: Map<string, Ranked>, key: string, name: string, detail: string | undefined, s: number) => {
    const found = map.get(key)
    if (found) found.seconds += s
    else map.set(key, { name, detail, seconds: s })
  }
  for (const [month, stats] of Object.entries(log)) {
    if (!inPeriod(month, period)) continue
    for (const [id, stat] of Object.entries(stats)) {
      seconds += stat.s
      bump(songs, id, stat.t, stat.a, stat.s)
      if (stat.a && stat.a !== UNKNOWN_ARTIST) bump(artists, stat.a.toLowerCase().trim(), stat.a, undefined, stat.s)
      if (stat.al) bump(albums, `${stat.al.toLowerCase().trim()}|${stat.a.toLowerCase().trim()}`, stat.al, stat.a, stat.s)
    }
  }
  const rank = (map: Map<string, Ranked>) => [...map.values()].sort((a, b) => b.seconds - a.seconds)
  return { seconds, songCount: songs.size, songs: rank(songs), artists: rank(artists), albums: rank(albums) }
}

/** Months that have anything recorded, oldest first. */
export const monthsWithData = (log: ListeningLog) => Object.keys(log).filter((m) => Object.values(log[m]).some((s) => s.s > 0)).sort()

/** The month or year before or after a period (`step` -1 or 1). */
export function shiftPeriod(period: Period, step: number): Period {
  if (period.kind === "year") return { kind: "year", key: String(Number(period.key) + step) }
  const [y, m] = period.key.split("-").map(Number)
  return { kind: "month", key: monthKey(new Date(y, m - 1 + step, 1)) }
}

export const periodOf = (kind: Period["kind"], d: Date): Period => ({ kind, key: kind === "month" ? monthKey(d) : yearKey(d) })

export function periodLabel(period: Period): string {
  if (period.kind === "year") return period.key
  const [y, m] = period.key.split("-").map(Number)
  return `${MONTHS[m - 1]} de ${y}`
}

/** "2 h 05 min", "35 min", "40 s". */
export function formatListening(seconds: number): string {
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`
  if (m > 0) return `${m} min`
  return `${total} s`
}

/** The last month or year that ended and has something recorded, for the "your recap is ready" notice. */
export function finishedPeriods(log: ListeningLog, now: Date): Period[] {
  const out: Period[] = []
  const thisMonth = periodOf("month", now)
  const lastMonth = shiftPeriod(thisMonth, -1)
  if (summarize(log, lastMonth).seconds > 0) out.push(lastMonth)
  const lastYear = shiftPeriod(periodOf("year", now), -1)
  if (summarize(log, lastYear).seconds > 0) out.push(lastYear)
  return out
}

import type { LyricLine } from "../data"
import { normalize, SearchTerms } from "../library/names"
import { getJson } from "./http"

/** duration: length in seconds of the recording these lyrics were timed against */
export type Lyrics = {
  synced: LyricLine[] | null
  plain: string | null
  duration?: number
  /** Romanised reading of each synced line, in the same order ("" where a line has no Japanese) */
  romaji?: string[]
}

type Hit = {
  trackName: string
  artistName: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

// A line that only says "Chorus": the writer typed the words once and left a label wherever the chorus comes back
const MARKER = /^[[(]?\s*(?:chorus|coro|estribillo|refr[aã]o|refrain|hook)(?:\s*(?:x\s*)?\d+)?\s*[\])]?\s*:?$/i
const isMarker = (text: string) => MARKER.test(text.trim())
// More than this between two lines of a chorus means a new part has started
const PART_GAP = 5.5

// Some files carry one line three times, tagged by arrows: the original (↓), its romanisation (→) and a translation (↑)
const TAG = /^[↓→↑←]\s*|\s*[↓→↑←]$/g
const tagOf = (text: string) => text.trim().match(/^[↓→↑←]|[↓→↑←]$/)?.[0]
const untag = (text: string) => text.trim().replace(TAG, "").trim()

/** One version of each line: the original, with the romanisation (when the file has one) kept alongside; translations are left out. */
export function singleLanguage(synced: LyricLine[]): LyricLine[] {
  if (!synced.some((l) => tagOf(l.text))) return synced
  const out: LyricLine[] = []
  for (let i = 0; i < synced.length; ) {
    let j = i
    while (j < synced.length && synced[j].t - synced[i].t < 0.3) j++
    const group = synced.slice(i, j)
    const original = group.find((l) => tagOf(l.text) === "↓")
    const reading = group.find((l) => /[→←]/.test(tagOf(l.text) ?? ""))
    const pick = original ?? reading ?? group.find((l) => tagOf(l.text) !== "↑") ?? group[0]
    out.push({ t: pick.t, text: untag(pick.text), ...(original && reading ? { r: untag(reading.text) } : null) })
    i = j
  }
  return out
}

/** The plain text of such a file with only the romanised lines. */
export function singleLanguagePlain(plain: string): string {
  const rows = plain.split(/\r?\n/)
  if (!rows.some((r) => tagOf(r))) return plain
  return rows.filter((r) => !r.trim() || /[→←]/.test(tagOf(r) ?? "")).map(untag).join("\n").replace(/\n{3,}/g, "\n\n")
}

/** Writes the chorus out wherever it is only labelled, with the timings of the first time it was sung. */
export function expandChorus(synced: LyricLine[], plain: string | null): LyricLine[] {
  if (!synced.some((l) => isMarker(l.text))) return synced
  // A marker is "bare" when the words that follow it are not the chorus itself: nothing, another label, or a long silence
  const bare = (i: number) => !synced[i + 1] || isMarker(synced[i + 1].text) || synced[i + 1].t - synced[i].t > 4
  const source = synced.findIndex((l, i) => isMarker(l.text) && !bare(i))
  if (source === -1) return synced.filter((l) => !isMarker(l.text))
  // How many lines the chorus has: the plain text separates parts with a blank line; otherwise the gaps in time do
  let size = 0
  const rows = (plain ?? "").split(/\r?\n/).map((r) => r.trim())
  const at = rows.findIndex((r) => isMarker(r))
  if (at !== -1) for (let j = at + 1; j < rows.length && rows[j] && !isMarker(rows[j]); j++) size++
  const block: LyricLine[] = []
  for (let j = source + 1; j < synced.length && !isMarker(synced[j].text); j++) {
    if (size ? block.length >= size : j > source + 1 && synced[j].t - synced[j - 1].t > PART_GAP) break
    block.push(synced[j])
  }
  const out: LyricLine[] = []
  synced.forEach((l, i) => {
    if (!isMarker(l.text)) return void out.push(l)
    if (i === source || !bare(i)) return
    // Only as many lines as fit before the next words of the song
    const next = synced.slice(i + 1).find((x) => !isMarker(x.text))
    for (const b of block) {
      const t = l.t + (b.t - synced[source].t)
      if (next && t >= next.t - 0.3) break
      out.push({ ...b, t })
    }
  })
  return out.sort((a, b) => a.t - b.t)
}

/** The plain text with each bare label replaced by the chorus words. */
export function expandPlainChorus(plain: string): string {
  const rows = plain.split(/\r?\n/)
  const bare = (i: number) => !rows[i + 1]?.trim() || isMarker(rows[i + 1])
  const source = rows.findIndex((r, i) => isMarker(r) && !bare(i))
  if (source === -1) return plain
  const block: string[] = []
  for (let j = source + 1; j < rows.length && rows[j].trim() && !isMarker(rows[j]); j++) block.push(rows[j])
  return rows.flatMap((r, i) => (!isMarker(r) ? [r] : i !== source && bare(i) ? block : [])).join("\n")
}

/** Lines of an .lrc text: "[01:23.45] words". A line can carry several time tags; tags like [ar:Name] are ignored. */
export function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const times: number[] = []
    const words = raw.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, (_, m: string, s: string, f?: string) => {
      times.push(Number(m) * 60 + Number(s) + (f ? Number(f) / 10 ** f.length : 0))
      return ""
    })
    const line = words.trim()
    if (!times.length || !line) continue
    for (const t of times) lines.push({ t, text: line })
  }
  return lines.sort((a, b) => a.t - b.t)
}

// Seconds of difference in length up to which timed lyrics are still taken over untimed ones
const SYNC_TOLERANCE = 12

const same = (a: string, b: string) => !!a && !!b && (a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))))

/** Rates a search result for this song; -1 means it is a different song. */
function score(hit: Hit, terms: SearchTerms, duration: number) {
  const title = normalize(hit.trackName)
  const wanted = normalize(terms.title)
  if (!(terms.artist ? same(title, wanted) : title === wanted)) return -1
  if (terms.artist && !same(normalize(hit.artistName), normalize(terms.artist))) return -1
  let s = 0
  if (duration > 0 && hit.duration > 0) {
    const gap = Math.abs(hit.duration - duration)
    // A very different length is a different version (live, extended), whose timings would not fit
    if (gap > 15) return -1
    // Timed lyrics from a version a few seconds off still follow the song (the person can nudge them), which
    // plain words never do: they win over untimed ones even when those match the length exactly
    s += hit.syncedLyrics ? (gap <= SYNC_TOLERANCE ? 10 : 3) : 0
    // The closer the length, the likelier the timings fit this very recording
    s += Math.max(0, 8 - gap)
  } else if (!terms.artist) {
    // Without an artist or a length there is nothing to tell two songs with the same title apart
    return -1
  }
  if (!(duration > 0 && hit.duration > 0)) s += hit.syncedLyrics ? 3 : 0
  return s
}

/** Applies the clean-ups to lyrics saved by an older version of the app. Safe to run on lyrics already cleaned. */
export function tidyLyrics(l: Lyrics): Lyrics {
  return {
    ...l,
    synced: l.synced ? expandChorus(singleLanguage(l.synced), l.plain) : null,
    plain: l.plain ? expandPlainChorus(singleLanguagePlain(l.plain)) : null,
  }
}

export type LyricsMatch = { lyrics: Lyrics; artist: string; title: string; terms: SearchTerms }

/** Looks for lyrics on LRCLIB with each guess in turn and returns the first real match, or null. */
export async function findLyrics(attempts: SearchTerms[], duration: number): Promise<LyricsMatch | null> {
  for (const terms of attempts) {
    const q = terms.artist
      ? `track_name=${encodeURIComponent(terms.title)}&artist_name=${encodeURIComponent(terms.artist)}`
      : `q=${encodeURIComponent(terms.title)}`
    const hits = (await getJson<Hit[]>(`https://lrclib.net/api/search?${q}`)) ?? []
    let best: { hit: Hit; score: number } | null = null
    for (const hit of hits) {
      if (hit.instrumental || (!hit.syncedLyrics && !hit.plainLyrics)) continue
      const s = score(hit, terms, duration)
      if (s >= 0 && (!best || s > best.score)) best = { hit, score: s }
    }
    if (!best) continue
    const plain = best.hit.plainLyrics?.trim() || null
    const lines = best.hit.syncedLyrics ? expandChorus(singleLanguage(parseLrc(best.hit.syncedLyrics)), plain) : []
    const synced = lines.map(({ t, text }) => ({ t, text }))
    // The reading some files carry for each line, in the same order as the lines
    const romaji = lines.some((l) => l.r) ? lines.map((l) => l.r ?? "") : undefined
    return {
      lyrics: { synced: synced.length ? synced : null, plain: plain ? expandPlainChorus(singleLanguagePlain(plain)) : null, duration: best.hit.duration || undefined, romaji },
      artist: best.hit.artistName,
      title: best.hit.trackName,
      terms,
    }
  }
  return null
}

import { normalize, SearchTerms } from "../library/names"
import { exists, getJson, sleep } from "./http"

type Recording = {
  title: string
  score: number
  "artist-credit"?: { name: string; joinphrase?: string }[]
  releases?: {
    id: string
    title: string
    date?: string
    status?: string
    "release-group"?: { "primary-type"?: string; "secondary-types"?: string[] }
  }[]
}

export type Release = {
  /** The names the database uses for this recording */
  artist: string
  title: string
  album: string | null
  /** Front cover of the album, or null if no release of the song has one */
  coverUrl: string | null
  terms: SearchTerms
}

// MusicBrainz allows one request per second per app; every caller reserves its own slot in line
let nextSlot = 0
async function gate() {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + 1100
  if (at > now) await sleep(at - now)
}

// Kinds of release that are not the song as the artist put it out (a live recording has no cover of its own)
const NOT_STUDIO = new Set(["Live", "Compilation", "DJ-mix", "Remix", "Demo", "Mixtape/Street", "Spokenword", "Audiobook", "Interview", "Broadcast"])
const NEVER = new Set(["Live", "Demo", "Interview", "Audiobook", "Spokenword"])

const credit = (r: Recording) => (r["artist-credit"] ?? []).map((c) => c.name + (c.joinphrase ?? "")).join("").trim()
const clean = (s: string) => s.replace(/["\\]/g, " ").trim()
export const sameTitle = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a)))

/** Recordings of this song that the database is sure about. */
async function search(terms: SearchTerms): Promise<Recording[]> {
  const query = terms.artist ? `recording:"${clean(terms.title)}" AND artist:"${clean(terms.artist)}"` : `recording:"${clean(terms.title)}"`
  await gate()
  const found = await getJson<{ recordings?: Recording[] }>(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=30`)
  const wanted = normalize(terms.title)
  const good = (found?.recordings ?? []).filter((r) => r.score >= 90 && sameTitle(normalize(r.title), wanted))
  if (terms.artist) return good
  // With no artist given, only trust a title that points to one artist almost every time
  const counts = new Map<string, number>()
  for (const r of good) counts.set(normalize(credit(r)), (counts.get(normalize(credit(r))) ?? 0) + 1)
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0]
  return n >= 3 && n / good.length >= 0.6 ? good.filter((r) => normalize(credit(r)) === top) : []
}

/** First album release of these recordings that has a front cover, trying studio releases before the rest. */
async function findCover(recordings: Recording[]) {
  const tiers: { id: string; title: string; date: string; single: boolean }[][] = [[], []]
  for (const rec of recordings) {
    for (const rel of rec.releases ?? []) {
      const group = rel["release-group"] ?? {}
      const kinds = group["secondary-types"] ?? []
      const item = { id: rel.id, title: rel.title, date: rel.date ?? "9999", single: group["primary-type"] === "Single" }
      if (rel.status === "Official" && !kinds.some((k) => NOT_STUDIO.has(k))) tiers[0].push(item)
      else if (!kinds.some((k) => NEVER.has(k))) tiers[1].push(item)
    }
  }
  const tried = new Set<string>()
  for (const tier of tiers) {
    // Albums before singles, oldest first: the original issue, not a later compilation
    tier.sort((a, b) => Number(a.single) - Number(b.single) || a.date.localeCompare(b.date))
    for (const rel of tier.slice(0, 5)) {
      if (tried.has(rel.id) || tried.size >= 8) continue
      tried.add(rel.id)
      const url = `https://coverartarchive.org/release/${rel.id}/front-500`
      if (await exists(url)) return { url, album: rel.title }
    }
  }
  return null
}

/** Looks the song up in MusicBrainz with each guess in turn: its names, its album and the album's cover. */
export async function findRelease(attempts: SearchTerms[]): Promise<Release | null> {
  for (const terms of attempts) {
    const recordings = await search(terms)
    if (!recordings.length) continue
    const best = recordings[0]
    const cover = await findCover(recordings)
    return { artist: credit(best), title: best.title, album: cover?.album ?? null, coverUrl: cover?.url ?? null, terms }
  }
  return null
}

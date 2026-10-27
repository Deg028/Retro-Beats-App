import { normalize, SearchTerms } from "../library/names"
import { getJson, sleep } from "./http"
import { Release, sameTitle } from "./musicbrainz"

type Hit = { title?: string; title_short?: string; duration?: number; artist?: { name?: string }; album?: { title?: string; cover_xl?: string } }

// The public search allows about fifty requests in five seconds; one every 250 ms stays well under it
let nextSlot = 0
async function gate() {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + 250
  if (at > now) await sleep(at - now)
}

const sameArtist = (a: string, b: string) => !!a && !!b && (a === b || a.includes(b) || b.includes(a))

/**
 * Album art from Deezer's public catalogue search, which has many songs the Apple catalogue lacks (anime, game
 * and internet music). The same rules as there: an artist that matches, or the exact title and the same length.
 */
export async function findDeezerCover(attempts: SearchTerms[], duration: number): Promise<Release | null> {
  for (const terms of attempts) {
    if (!terms.artist && !(duration > 0)) continue
    const title = normalize(terms.title)
    const artist = terms.artist ? normalize(terms.artist) : ""
    await gate()
    const q = terms.artist ? `${terms.artist} ${terms.title}` : terms.title
    const found = await getJson<{ data?: Hit[] }>(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=25`)
    const gap = (h: Hit) => (duration > 0 && h.duration ? Math.abs(h.duration - duration) : 0)
    const hits = (found?.data ?? []).filter((h) => {
      const name = normalize(h.title_short || h.title || "")
      if (!h.album?.cover_xl || !name || !h.artist?.name) return false
      if (terms.artist) return sameTitle(name, title) && sameArtist(normalize(h.artist.name), artist)
      return name === title && !!h.duration && gap(h) <= 3
    })
    hits.sort((a, b) => gap(a) - gap(b))
    const best = hits[0]
    if (!best) continue
    return { artist: best.artist!.name!, title: best.title_short || best.title!, album: best.album!.title ?? null, coverUrl: best.album!.cover_xl!, terms }
  }
  return null
}

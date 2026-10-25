import { normalize, SearchTerms } from "../library/names"
import { getJson, sleep } from "./http"
import { Release, sameTitle } from "./musicbrainz"

type Hit = { trackName?: string; artistName?: string; collectionName?: string; artworkUrl100?: string; trackTimeMillis?: number }

// The service allows about twenty searches a minute; every caller reserves its own slot in line
let nextSlot = 0
async function gate() {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + 3000
  if (at > now) await sleep(at - now)
}

// Albums that gather songs from others, or sell a song as a film's: not the cover the song first had
const REISSUE = /hits|greatest|best of|essential|collection|soundtrack|anthology|ultimate|live|remix|karaoke|tribute|covers?|playlist|mix$/i

const sameArtist = (a: string, b: string) => !!a && !!b && (a === b || a.includes(b) || b.includes(a))

/**
 * Official album art from the public Apple Music catalogue search: one quick request, and it knows far more
 * songs than MusicBrainz does. Needs the artist, because a title alone would pick a cover for the wrong song.
 */
export async function findStoreCover(attempts: SearchTerms[], duration: number): Promise<Release | null> {
  for (const terms of attempts) {
    // No artist known: the title alone is only trusted when the length matches this file's almost to the second
    if (!terms.artist && !(duration > 0)) continue
    const title = normalize(terms.title)
    const artist = terms.artist ? normalize(terms.artist) : ""
    // The combined search is fuzzy and sometimes buries the song; the title alone, wider, catches those
    for (const [query, limit] of (terms.artist ? [[`${terms.artist} ${terms.title}`, 10], [terms.title, 50]] : [[terms.title, 50]]) as [string, number][]) {
      await gate()
      const found = await getJson<{ results?: Hit[] }>(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`)
      const hits = (found?.results ?? []).filter(
        (h) => h.artworkUrl100 && h.trackName && h.artistName && (terms.artist
            ? sameTitle(normalize(h.trackName), title) && sameArtist(normalize(h.artistName), artist)
            : normalize(h.trackName) === title && !!h.trackTimeMillis && Math.abs(h.trackTimeMillis / 1000 - duration) <= 3),
      )
      // The album the song came out on before a "greatest hits", then the recording whose length matches this file
      const gap = (h: Hit) => (duration > 0 && h.trackTimeMillis ? Math.abs(h.trackTimeMillis / 1000 - duration) : 0)
      const reissue = (h: Hit) => Number(REISSUE.test(h.collectionName ?? ""))
      hits.sort((a, b) => reissue(a) - reissue(b) || gap(a) - gap(b))
      const best = hits[0]
      if (!best) continue
      return {
        artist: best.artistName!,
        title: best.trackName!,
        album: best.collectionName ?? null,
        coverUrl: best.artworkUrl100!.replace(/\/\d+x\d+(bb)?\.(jpg|png)$/, "/600x600bb.jpg"),
        terms,
      }
    }
  }
  return null
}

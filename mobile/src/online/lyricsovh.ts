import { SearchTerms } from "../library/names"
import { getJson, NetworkError } from "./http"
import { expandPlainChorus, LyricsMatch, singleLanguagePlain } from "./lrclib"

// The service is run by volunteers and is down now and then: after a failure it is left alone for a while,
// so a run over the whole library does not wait on it for every song
const REST_MS = 10 * 60_000
let restUntil = 0

/**
 * Plain lyrics (no timing) from lyrics.ovh, asked only when LRCLIB has none. It searches by artist and title
 * exactly, so guesses without an artist are skipped. Returns null when it has none or cannot be reached.
 */
export async function findPlainLyrics(attempts: SearchTerms[]): Promise<LyricsMatch | null> {
  if (Date.now() < restUntil) return null
  for (const terms of attempts) {
    if (!terms.artist) continue
    try {
      const found = await getJson<{ lyrics?: string }>(`https://api.lyrics.ovh/v1/${encodeURIComponent(terms.artist)}/${encodeURIComponent(terms.title)}`)
      // The first line is sometimes a heading like "Paroles de la chanson X par Y"
      const text = found?.lyrics?.replace(/^Paroles de la chanson.*\r?\n/i, "").replace(/\r\n/g, "\n").trim()
      if (!text || text.length < 40) continue
      return { lyrics: { synced: null, plain: expandPlainChorus(singleLanguagePlain(text)) }, artist: terms.artist, title: terms.title, terms }
    } catch (e) {
      if (!(e instanceof NetworkError)) throw e
      restUntil = Date.now() + REST_MS
      return null
    }
  }
  return null
}

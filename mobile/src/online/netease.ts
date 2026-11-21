import type { LyricLine } from "../data"
import { normalize, SearchTerms } from "../library/names"
import { expandChorus, LyricsMatch, parseLrc, singleLanguage } from "./lrclib"
import { NetworkError } from "./http"

// NetEase Cloud Music has no official public API: these are the same address the web player uses, open to anyone
// and without a key. It is only asked when LRCLIB has nothing, and left alone for a while after a failure.
const REST_MS = 10 * 60_000
const TIMEOUT_MS = 10_000
// Seconds of difference in length up to which a result is taken for the same recording
const GAP = 6
let restUntil = 0

type Hit = { id: number; name: string; duration: number; artists: { name: string }[] }

async function get<T>(url: string): Promise<T | null> {
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { Referer: "https://music.163.com/", "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36" }, signal: stop.signal })
    if (!res.ok) throw new NetworkError(`El servidor respondió ${res.status}`)
    return (await res.json()) as T
  } catch (e) {
    throw e instanceof NetworkError ? e : new NetworkError("Sin conexión o el servidor no responde")
  } finally {
    clearTimeout(timer)
  }
}

const same = (a: string, b: string) => !!a && !!b && (a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))))

// Credits that the timed text starts with ("作词 : …", "Composed by …") and notes for instrumentals
const CREDIT = /^\s*(作词|作曲|编曲|制作人|混音|母带|录音|监制|词|曲|lyrics?|music|composer|arranger|producer|words)\s*[:：]/i
const INSTRUMENTAL = /纯音乐|没有填词|暂无歌词|no lyrics/i

/** Rates a result for this song; -1 means it is a different song or recording. */
function score(hit: Hit, terms: SearchTerms, duration: number) {
  if (!same(normalize(hit.name), normalize(terms.title))) return -1
  if (terms.artist && !hit.artists.some((a) => same(normalize(a.name), normalize(terms.artist ?? "")))) return -1
  // Without a length, or without an artist, there is nothing to tell two songs of the same name apart
  if (!(duration > 0)) return terms.artist ? 0 : -1
  const gap = Math.abs(hit.duration / 1000 - duration)
  if (gap > (terms.artist ? GAP : 4)) return -1
  return 10 - gap
}

// `normalize` keeps only Latin letters, so it would turn a Japanese title into nothing: compare these with width and case folded and no spaces or punctuation
const plainTitle = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s_\-・:!?。、,.\x27"()\[\]]+/g, "")

/**
 * The Japanese text of a song whose lyrics the person only has as romaji. NetEase lists Japanese songs by their Japanese
 * title, so each Japanese part of the file name is searched as the title, and a result is taken when its title is the
 * same and its length is within 15 s (the person's recording may be a cover or a re-release; only the words are used,
 * the times stay the person's). Returns the lines with NetEase's times and its length, null when there is none, and
 * "offline" when the service could not be reached.
 */
export async function findJapaneseText(segments: string[], duration: number): Promise<{ lines: LyricLine[]; duration: number } | null | "offline"> {
  if (Date.now() < restUntil) return "offline"
  try {
    for (const title of segments) {
      const found = await get<{ result?: { songs?: Hit[] } }>(`https://music.163.com/api/search/get?s=${encodeURIComponent(title)}&type=1&offset=0&limit=8`)
      let best: { hit: Hit; gap: number } | null = null
      for (const hit of found?.result?.songs ?? []) {
        if (!same(plainTitle(hit.name), plainTitle(title))) continue
        const gap = duration > 0 ? Math.abs(hit.duration / 1000 - duration) : 0
        if (gap <= 15 && (!best || gap < best.gap)) best = { hit, gap }
      }
      if (!best) continue
      const data = await get<{ lrc?: { lyric?: string } }>(`https://music.163.com/api/song/lyric?id=${best.hit.id}&lv=1&kv=1&tv=-1`)
      const raw = data?.lrc?.lyric ?? ""
      if (INSTRUMENTAL.test(raw)) continue
      const lines = singleLanguage(parseLrc(raw)).filter((l) => !CREDIT.test(l.text))
      if (lines.length >= 4) return { lines: lines.map(({ t, text }) => ({ t, text })), duration: best.hit.duration / 1000 }
    }
    return null
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e
    restUntil = Date.now() + REST_MS
    return "offline"
  }
}

/**
 * Timed lyrics from NetEase Cloud Music, for songs LRCLIB doesn't have (covers, anime and game songs, remixes).
 * Each guess is searched in turn and only a result of the same title, artist and length is taken. Returns null when
 * there is none or the service cannot be reached.
 */
export async function findNeteaseLyrics(attempts: SearchTerms[], duration: number): Promise<LyricsMatch | null> {
  if (Date.now() < restUntil) return null
  try {
    for (const terms of attempts) {
      const q = encodeURIComponent(`${terms.artist ? `${terms.artist} ` : ""}${terms.title}`)
      const found = await get<{ result?: { songs?: Hit[] } }>(`https://music.163.com/api/search/get?s=${q}&type=1&offset=0&limit=8`)
      let best: { hit: Hit; score: number } | null = null
      for (const hit of found?.result?.songs ?? []) {
        const s = score(hit, terms, duration)
        if (s >= 0 && (!best || s > best.score)) best = { hit, score: s }
      }
      if (!best) continue
      const data = await get<{ lrc?: { lyric?: string } }>(`https://music.163.com/api/song/lyric?id=${best.hit.id}&lv=1&kv=1&tv=-1`)
      const raw = data?.lrc?.lyric ?? ""
      if (INSTRUMENTAL.test(raw)) continue
      const lines = singleLanguage(parseLrc(raw)).filter((l) => !CREDIT.test(l.text))
      if (lines.length < 4) continue
      const plain = lines.map((l) => l.text).join("\n")
      const synced = expandChorus(lines, plain).map(({ t, text }) => ({ t, text }))
      return {
        lyrics: { synced, plain, duration: best.hit.duration / 1000 },
        artist: best.hit.artists.map((a) => a.name).join(", "),
        title: best.hit.name,
        terms,
      }
    }
    return null
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e
    restUntil = Date.now() + REST_MS
    return null
  }
}


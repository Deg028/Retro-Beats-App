import type { LyricLine } from "./data"

/**
 * Pictures shown in the timed lyrics during a song's parts without singing: from `start` to `end` (seconds of the
 * recording) an animated picture takes the place of a lyric line, then the lyrics go on. Only the songs listed here
 * get one. A song is recognised by a piece of its title, artist or file name (any of `match`, compared without case):
 * the title is cleaned when the library is read (a «Cover» tail is dropped), but the file name keeps it, and a title
 * fixed in «Datos» still matches while one of the pieces stays.
 */
type Size = { width: number; height: number }
/**
 * `moveLyrics`: the lyric file sings inside the span but this recording does not (the file follows another cut of the
 * song), so the lines from the first one inside the span onwards move later by the same amount and come after the
 * picture, instead of being dropped.
 */
type Interlude = { match: string[]; ranges: { start: number; end: number; image: number; size?: Size; moveLyrics?: boolean }[] }

const INTERLUDES: Interlude[] = [
  // Creepy Nuts - オトノケ (Otonoke), the music video version in SnapTube Audio (3:17)
  { match: ["オトノケ", "otonoke"], ranges: [{ start: 165, end: 175, image: require("../assets/interludes/otonoke.gif") }] },
  // Adrián Barba - La Última Batalla (Ver. Full), the SnapTube file. Pixel-art sprite (580x354, art pixels of 2x2) shown
  // at 222x135 dp: 2 device pixels per art pixel on a phone of density 2.6. LRCLIB's lyrics (258 s) sing «Nada puede
  // detenerme…» from 2:23, inside the instrumental part of this recording, and have nothing after 2:38.
  { match: ["la última batalla", "la ultima batalla"], ranges: [{ start: 139, end: 161, image: require("../assets/interludes/ultima-batalla.gif"), size: { width: 222, height: 135 }, moveLyrics: true }] },
]

/** `image` is a bundled picture (`require`) */
export type InterludeLine = LyricLine & { image?: number; size?: Size }

export type InterludeSong = { title: string; artist?: string; uri?: string }

const decoded = (uri = "") => {
  try {
    return decodeURIComponent(uri)
  } catch {
    return uri
  }
}

const forSong = (song: InterludeSong) => {
  const name = [song.title, song.artist ?? "", decoded(song.uri)].join(" ").toLowerCase()
  return INTERLUDES.find((i) => i.match.some((m) => name.includes(m.toLowerCase())))
}

/** The picture for `song` at second `time`, if the song has one there (for songs with no lyrics to put it in) */
export function interludeAt(song: InterludeSong, time: number, offset = 0) {
  return forSong(song)?.ranges.find((r) => time >= r.start + offset && time < r.end + offset)
}

/** Whether the song has any picture at all */
export const hasInterludes = (song: InterludeSong) => !!forSong(song)

/**
 * The lyric lines of `song` with its pictures put in at their times (`offset` is the person's lyric
 * adjustment, so the picture stays on the recording's seconds). Lines sung inside a picture's span are dropped (or moved
 * after it, see `moveLyrics`), and an empty line ends the picture when the next line comes later. `romaji` is rebuilt to keep matching the lines.
 */
export function withInterludes(song: InterludeSong, lines: LyricLine[], offset: number, romaji?: string[]) {
  const interlude = forSong(song)
  if (!interlude) return { lines: lines as InterludeLine[], romaji }
  let rows = lines.map((line, i) => ({ line: line as InterludeLine, reading: romaji?.[i] }))
  for (const { start, end, image, size, moveLyrics } of interlude.ranges) {
    const from = start + offset
    const to = end + offset
    const first = rows.find(({ line }) => line.t >= from && line.t < to)
    if (moveLyrics && first) {
      const delay = to - first.line.t
      rows = rows.map((r) => (r.line.t >= first.line.t ? { ...r, line: { ...r.line, t: r.line.t + delay } } : r))
    }
    rows = rows.filter(({ line }) => line.t < from || line.t >= to)
    rows.push({ line: { t: from, text: "", image, size }, reading: undefined })
    if (!rows.some(({ line }) => line.t === to)) rows.push({ line: { t: to, text: "" }, reading: undefined })
  }
  rows.sort((a, b) => a.line.t - b.line.t)
  return { lines: rows.map((r) => r.line), romaji: romaji && rows.map((r) => r.reading ?? "") }
}

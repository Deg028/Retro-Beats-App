import type { LyricLine } from "./data"

/**
 * Pictures shown in the timed lyrics during a song's parts without singing: from `start` to `end` (seconds of the
 * recording) an animated picture takes the place of a lyric line, then the lyrics go on. Only the songs listed here
 * get one. A song is recognised by a piece of its title, artist or file name (any of `match`, compared without case):
 * the title is cleaned when the library is read (a «Cover» tail is dropped), but the file name keeps it, and a title
 * fixed in «Datos» still matches while one of the pieces stays.
 */
type Size = { width: number; height: number }
type Interlude = { match: string[]; ranges: { start: number; end: number; image: number; size?: Size }[] }

const INTERLUDES: Interlude[] = [
  // Creepy Nuts - オトノケ (Otonoke), the music video version in SnapTube Audio (3:17)
  { match: ["オトノケ", "otonoke"], ranges: [{ start: 165, end: 175, image: require("../assets/interludes/otonoke.gif") }] },
  // Ultimate Battle - Dragon Ball Super | Epic Reforged Power Metal Cover, the SnapTube file. Pixel-art sprite (580x354,
  // art pixels of 2x2) shown at 222x135 dp: 2 device pixels per art pixel on a phone of density 2.6.
  { match: ["epic reforged power metal"], ranges: [{ start: 139, end: 161, image: require("../assets/interludes/ultima-batalla.gif"), size: { width: 222, height: 135 } }] },
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
 * adjustment, so the picture stays on the recording's seconds). Lines sung inside a picture's span are dropped, and
 * an empty line ends the picture when the next line comes later. `romaji` is rebuilt to keep matching the lines.
 */
export function withInterludes(song: InterludeSong, lines: LyricLine[], offset: number, romaji?: string[]) {
  const interlude = forSong(song)
  if (!interlude) return { lines: lines as InterludeLine[], romaji }
  let rows = lines.map((line, i) => ({ line: line as InterludeLine, reading: romaji?.[i] }))
  for (const { start, end, image, size } of interlude.ranges) {
    const from = start + offset
    const to = end + offset
    rows = rows.filter(({ line }) => line.t < from || line.t >= to)
    rows.push({ line: { t: from, text: "", image, size }, reading: undefined })
    if (!rows.some(({ line }) => line.t === to)) rows.push({ line: { t: to, text: "" }, reading: undefined })
  }
  rows.sort((a, b) => a.line.t - b.line.t)
  return { lines: rows.map((r) => r.line), romaji: romaji && rows.map((r) => r.reading ?? "") }
}

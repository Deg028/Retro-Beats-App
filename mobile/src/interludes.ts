import type { LyricLine } from "./data"

/**
 * Pictures shown in the timed lyrics during a song's parts without singing: from `start` to `end` (seconds of the
 * recording) an animated picture takes the place of a lyric line, then the lyrics go on. Only the songs listed here
 * get one. A song is recognised by a piece of its title (any of `title`, compared without case), so a renamed file
 * or a title fixed in «Datos» still matches as long as that piece stays.
 */
type Size = { width: number; height: number }
type Interlude = { title: string[]; ranges: { start: number; end: number; image: number; size?: Size }[] }

const INTERLUDES: Interlude[] = [
  // Creepy Nuts - オトノケ (Otonoke), the music video version in SnapTube Audio (3:17)
  { title: ["オトノケ", "otonoke"], ranges: [{ start: 165, end: 175, image: require("../assets/interludes/otonoke.gif") }] },
  // Dragon Ball Super - Ultimate Battle (Intense Symphonic Metal Cover), the file in Music/Telegram whose title is read
  // from its tag (artist unknown there). Wide picture: the GIF is 300x169.
  { title: ["dragon ball super - ultimate battle"], ranges: [{ start: 139, end: 161, image: require("../assets/interludes/ultima-batalla.gif"), size: { width: 260, height: 146 } }] },
]

/** `image` is a bundled picture (`require`) */
export type InterludeLine = LyricLine & { image?: number; size?: Size }

const forSong = (title: string) => {
  const name = title.toLowerCase()
  return INTERLUDES.find((i) => i.title.some((t) => name.includes(t.toLowerCase())))
}

/** The picture for `title` at second `time`, if the song has one there (for songs with no lyrics to put it in) */
export function interludeAt(title: string, time: number, offset = 0) {
  return forSong(title)?.ranges.find((r) => time >= r.start + offset && time < r.end + offset)
}

/** Whether the song has any picture at all */
export const hasInterludes = (title: string) => !!forSong(title)

/**
 * The lyric lines of the song called `title` with its pictures put in at their times (`offset` is the person's lyric
 * adjustment, so the picture stays on the recording's seconds). Lines sung inside a picture's span are dropped, and
 * an empty line ends the picture when the next line comes later. `romaji` is rebuilt to keep matching the lines.
 */
export function withInterludes(title: string, lines: LyricLine[], offset: number, romaji?: string[]) {
  const interlude = forSong(title)
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

import type { ImageSourcePropType } from "react-native"
import type { LyricLine } from "./data"

/**
 * Pictures shown in the timed lyrics during a song's parts without singing: from `start` to `end` (seconds of the
 * recording) an animated picture takes the place of a lyric line, then the lyrics go on. Only the songs listed here
 * get one. A song is recognised by a piece of its title (any of `title`, compared without case), so a renamed file
 * or a title fixed in «Datos» still matches as long as that piece stays.
 */
type Interlude = { title: string[]; ranges: { start: number; end: number; image: ImageSourcePropType }[] }

const INTERLUDES: Interlude[] = [
  // Creepy Nuts - オトノケ (Otonoke), the music video version in SnapTube Audio (3:17)
  { title: ["オトノケ", "otonoke"], ranges: [{ start: 165, end: 175, image: require("../assets/interludes/otonoke.gif") }] },
]

export type InterludeLine = LyricLine & { image?: ImageSourcePropType }

const forSong = (title: string) => {
  const name = title.toLowerCase()
  return INTERLUDES.find((i) => i.title.some((t) => name.includes(t.toLowerCase())))
}

/**
 * The lyric lines of the song called `title` with its pictures put in at their times (`offset` is the person's lyric
 * adjustment, so the picture stays on the recording's seconds). Lines sung inside a picture's span are dropped, and
 * an empty line ends the picture when the next line comes later. `romaji` is rebuilt to keep matching the lines.
 */
export function withInterludes(title: string, lines: LyricLine[], offset: number, romaji?: string[]) {
  const interlude = forSong(title)
  if (!interlude) return { lines: lines as InterludeLine[], romaji }
  let rows = lines.map((line, i) => ({ line: line as InterludeLine, reading: romaji?.[i] }))
  for (const { start, end, image } of interlude.ranges) {
    const from = start + offset
    const to = end + offset
    rows = rows.filter(({ line }) => line.t < from || line.t >= to)
    rows.push({ line: { t: from, text: "", image }, reading: undefined })
    if (!rows.some(({ line }) => line.t === to)) rows.push({ line: { t: to, text: "" }, reading: undefined })
  }
  rows.sort((a, b) => a.line.t - b.line.t)
  return { lines: rows.map((r) => r.line), romaji: romaji && rows.map((r) => r.reading ?? "") }
}

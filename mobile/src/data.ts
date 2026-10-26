/** `r`: the romanised reading, carried along while the lyrics are cleaned up and kept apart from the line afterwards */
export type LyricLine = { t: number; text: string; r?: string }

export type Song = {
  id: number
  title: string
  artist: string
  /** Seconds; 0 until known (folder scans can't read it, so the player fills it in the first time the song loads) */
  duration: number
  /** Address of the audio file on the phone */
  uri: string
  /** The file's name, with its extension */
  file?: string
  /** A lyrics file saved next to the song (SnapTube leaves one as "name_private.lrc") */
  lyricsUri?: string
  /** Lyrics with time stamps, found online */
  lyrics?: LyricLine[]
  /** Romanised reading of each timed line, same order as `lyrics` */
  romaji?: string[]
  /** Album the song belongs to, when it was found online */
  album?: string
  /** Lyrics with no timing, when that is all there is */
  plain?: string
  /** Seconds the lyrics are moved by, set by the person when they don't line up */
  lyricsOffset?: number
  /** Where the album cover was saved on the phone */
  cover?: string
  plays: number
  fav: boolean
  lastPlayed: number
  addedAt: number
  added: boolean
}

export const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** " · 3:42" for a song list line, or nothing while the length isn't known yet. */
export const lengthSuffix = (seconds: number) => (seconds > 0 ? ` · ${fmt(seconds)}` : "")

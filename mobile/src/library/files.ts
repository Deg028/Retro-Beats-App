import type { Song } from "../data"
import { parseName } from "./names"

/** One audio file as reported by the system's media index, before we decide what to do with it. */
export type RawFile = {
  /** On Android this is the file's `content://` address, which the player can open directly */
  uri: string
  name: string
  /** Seconds, or null when the index has no duration for the file */
  duration: number | null
  /** Milliseconds since 1970 */
  added: number | null
  /** Found by listing a folder: the length is unknown until the song plays, which is fine */
  unknownDuration?: boolean
  /** A lyrics file found beside this one */
  lyricsUri?: string
}

export type SkipReason = "format" | "empty" | "short"

export type SkippedFile = { name: string; reason: SkipReason }

export const SKIP_LABEL: Record<SkipReason, { title: string; hint: string }> = {
  format: { title: "Formato que el reproductor no abre", hint: "Conviértelos a MP3, M4A, FLAC u OGG para escucharlos aquí." },
  empty: { title: "Vacíos o dañados", hint: "El teléfono no sabe cuánto duran; suelen estar incompletos." },
  short: { title: "Muy cortos", hint: "Parecen tonos o sonidos del sistema. Puedes incluirlos si son música." },
}

/** Where the files go in the library; sorted newest first by `added`. */
export type DeviceTrack = Pick<Song, "title" | "artist" | "duration" | "uri" | "file" | "lyricsUri"> & { id: number; added: number }

/** Audio file extensions worth listing when walking a folder (anything else is not music and is ignored). */
export const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "m4b", "aac", "flac", "ogg", "oga", "opus", "wav", "mka", "wma", "ape", "wv", "mpc", "amr", "3gp"])

// Formats Android's media player is known not to open
const UNSUPPORTED = new Set(["wma", "ape", "dsf", "dff", "wv", "mpc", "tak", "tta", "ra", "rm"])

/** Device songs live above this number so they never collide with the demo songs (ids 1 to 11). */
export const DEVICE_ID_BASE = 1_000_000

export const extensionOf = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "")

/** Stable number for a file: MediaStore's own id when the address ends in one, otherwise a hash. */
function numericId(uri: string) {
  const last = uri.split("/").pop() ?? ""
  if (/^\d{1,9}$/.test(last)) return Number(last)
  let h = 0
  for (let i = 0; i < uri.length; i++) h = (h * 31 + uri.charCodeAt(i)) % 900_000_000
  return h
}

export type Classified = { tracks: DeviceTrack[]; skipped: SkippedFile[] }

/** Splits the raw list into playable tracks and the files left out, each with its reason. */
export function classify(files: RawFile[], minSeconds: number): Classified {
  const tracks: DeviceTrack[] = []
  const skipped: SkippedFile[] = []
  const used = new Set<number>()
  for (const f of files) {
    const reason: SkipReason | null = UNSUPPORTED.has(extensionOf(f.name))
      ? "format"
      : f.unknownDuration
        ? null
        : !f.duration || f.duration <= 0
          ? "empty"
          : f.duration < minSeconds
            ? "short"
            : null
    if (reason) {
      skipped.push({ name: f.name, reason })
      continue
    }
    // Two volumes can share a MediaStore number; step to the next free one so both stay in the library
    let id = DEVICE_ID_BASE + numericId(f.uri)
    while (used.has(id)) id++
    used.add(id)
    tracks.push({ id, uri: f.uri, file: f.name, lyricsUri: f.lyricsUri, ...parseName(f.name), duration: f.duration ?? 0, added: f.added ?? 0 })
  }
  tracks.sort((a, b) => a.added - b.added)
  return { tracks, skipped }
}

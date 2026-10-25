import { Platform } from "react-native"
import { Directory, File, Paths } from "expo-file-system"
import { SearchTerms, searchAttempts, UNKNOWN_ARTIST } from "../library/names"
import { NetworkError } from "./http"
import { findLyrics, Lyrics } from "./lrclib"
import { findStoreCover } from "./itunes"
import { findRelease, Release } from "./musicbrainz"

export type Want = { lyrics: boolean; cover: boolean }

export type Found = {
  /** undefined: not asked or the server could not be reached. null: asked, and there is no lyrics for this song. */
  lyrics?: Lyrics | null
  release?: Release | null
  /** Names from the databases, only when the file name gave a wrong or missing artist */
  fix?: { artist: string; title: string }
  error?: string
}

/** The album's cover from the store catalogue when it has it (quick), otherwise from MusicBrainz, which also gives the names. */
async function findAlbum(attempts: SearchTerms[], duration: number, storeFirst: boolean): Promise<Release | null> {
  let storeError: unknown
  if (storeFirst) {
    try {
      const store = await findStoreCover(attempts, duration)
      if (store) return store
    } catch (e) {
      storeError = e
    }
  }
  try {
    return await findRelease(attempts)
  } catch (e) {
    throw storeError ?? e
  }
}

const reason = (r: PromiseRejectedResult) => (r.reason instanceof NetworkError ? r.reason.message : "No se pudo completar la búsqueda")

/**
 * Looks a song up online: lyrics on LRCLIB, and its names, album and cover on MusicBrainz and the Cover Art Archive.
 * The two run side by side. One failing (no connection) never hides what the other found.
 */
export async function lookup(song: { artist: string; title: string; duration: number }, want: Want): Promise<Found> {
  const attempts = searchAttempts(song.artist, song.title)
  const unknownArtist = song.artist === UNKNOWN_ARTIST
  const [lyricsRun, releaseRun] = await Promise.allSettled([
    want.lyrics ? findLyrics(attempts, song.duration) : Promise.resolve(undefined),
    want.cover || unknownArtist ? findAlbum(attempts, song.duration, want.cover) : Promise.resolve(undefined),
  ])
  const found: Found = {}
  if (releaseRun.status === "fulfilled") found.release = releaseRun.value
  else found.error = reason(releaseRun)

  let lyricsMatch = lyricsRun.status === "fulfilled" ? lyricsRun.value : undefined
  if (lyricsRun.status === "rejected") found.error = reason(lyricsRun)
  // The file name gave no usable artist, but the database knows it: ask for the lyrics again with its names
  if (want.lyrics && lyricsRun.status === "fulfilled" && !lyricsMatch && found.release) {
    try {
      lyricsMatch = await findLyrics([{ artist: found.release.artist, title: found.release.title }], song.duration)
    } catch (e) {
      found.error = e instanceof NetworkError ? e.message : found.error
    }
  }
  if (want.lyrics && lyricsRun.status === "fulfilled") found.lyrics = lyricsMatch?.lyrics ?? null
  // The lyrics revealed who the artist is: look for the album cover again with that name
  if (want.cover && unknownArtist && !found.release && lyricsMatch) {
    try {
      found.release = await findRelease(searchAttempts(lyricsMatch.artist, lyricsMatch.title))
    } catch (e) {
      found.error = e instanceof NetworkError ? e.message : found.error
    }
  }

  // Take the database's names only where the file's were missing or in the wrong order
  const named = found.release ?? (lyricsMatch ? { artist: lyricsMatch.artist, title: lyricsMatch.title, terms: lyricsMatch.terms } : null)
  const swapped = named && song.artist !== UNKNOWN_ARTIST && named.terms.title === song.artist
  if (named && (unknownArtist || swapped)) found.fix = { artist: named.artist, title: named.title }
  return found
}

/** Downloads a cover into the app's own storage so it still shows without a connection. Returns where it was saved. */
export async function saveCover(id: number, url: string): Promise<string> {
  // A browser has no storage to write to; the address itself is shown
  if (Platform.OS === "web") return url
  const dir = new Directory(Paths.document, "covers")
  dir.create({ intermediates: true, idempotent: true })
  const file = new File(dir, `${id}.jpg`)
  try {
    await File.downloadFileAsync(url, file, { idempotent: true })
    return file.uri
  } catch {
    // A failed download can leave half a file behind
    try {
      file.delete()
    } catch {
      // nothing to remove
    }
    throw new NetworkError("No se pudo descargar la carátula")
  }
}

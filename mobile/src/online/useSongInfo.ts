import { useEffect, useEffectEvent, useRef, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Directory, File, Paths } from "expo-file-system"
import { Song } from "../data"
import { pickFolder } from "../library/scan"
import { readPicture } from "../library/tags"
import { readLyricsFile } from "./local"
import { lyricsHaveJapanese, romanise } from "./romaji"
import { sleep } from "./http"
import { lookup, saveCover } from "./lookup"
import { readThumbnails, saveThumbnail, SNAPTUBE_HINT } from "./snaptube"
import { Entry, InfoStore } from "./store"

const WEEK = 7 * 24 * 3600 * 1000
// Bumped when lyrics are prepared differently (2: files with the original, romanisation and translation keep the original)
const LYRICS_V = 2
// Bumped when a new source is added (2: Deezer covers, lyrics.ovh, the title alone), so earlier misses are tried again at once
const SOURCES_V = 2
const SNAPTUBE_KEY = "retro-beats:snaptube-folder"
const ROMAJI_KEY = "retro-beats:romaji"

/**
 * What to look up for a song. Lyrics wait until the song's length is known: timings only fit the recording
 * they were made for, and the length is how the right one is told from a live or extended version.
 */
function wanted(song: Song, entry: Entry | undefined, force = false) {
  const redo = entry?.lyrics === true && !entry.lyricsFor
  // Only plain words were found: a timed version may have been added since, so it is looked for again now and then
  const upgrade = entry?.lyrics === true && entry.lyricsSynced === false && (!entry.syncTriedAt || Date.now() - entry.syncTriedAt > WEEK)
  const stale = entry?.lyrics === true && (entry.lyricsV ?? 1) < LYRICS_V
  return { lyrics: song.duration > 0 && (force || needs(entry, "lyrics") || redo || upgrade || stale), // A downloader's thumbnail is already the cover: no search for another one
    cover: !force && typeof entry?.thumb !== "string" && typeof entry?.embedded !== "string" && needs(entry, "cover") }
}

/** A part is looked up if it never was, or if it was and came back empty more than a week ago. Whatever was found stays. */
function needs(entry: Entry | undefined, part: "lyrics" | "cover") {
  const at = part === "lyrics" ? entry?.lyricsAt : entry?.coverAt
  const found = part === "lyrics" ? entry?.lyrics === true : typeof entry?.cover === "string"
  return !at || (!found && (Date.now() - at > WEEK || (entry?.srcV ?? 1) < SOURCES_V))
}

export type LyricsState = "off" | "loading" | "found" | "none" | "error"

/** After this many songs in a row fail to reach the server, a bulk run waits a minute; after a few such waits it stops and says so. */
const MAX_FAILS_IN_A_ROW = 3
const PAUSE_MS = 60_000
const MAX_PAUSES = 3

/**
 * Looks up lyrics, names and cover for the song that is playing, and for the whole library on request.
 * Results go to the store, which saves them; the player reads them back as part of each song.
 */
export function useSongInfo(store: InfoStore, current: Song | null) {
  const [busy, setBusy] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const inflight = useRef(new Set<number>())
  const stopRequested = useRef(false)
  // Bulk runs last minutes: they must read the entries as they are now, not as they were when the run began
  const entriesRef = useRef(store.entries)
  useEffect(() => {
    entriesRef.current = store.entries
  })

  /** Looks up what is missing for one song. Returns false if the servers could not be reached. */
  const run = async (song: Song, force = false): Promise<boolean> => {
    const entry = entriesRef.current[song.id]
    const want = wanted(song, entry, force)
    if ((!want.lyrics && !want.cover) || inflight.current.has(song.id)) return true
    inflight.current.add(song.id)
    setBusy(song.id)
    let error: string | undefined
    try {
      const found = await lookup(song, want)
      error = found.error
      // A lyrics file beside the song fills in where the internet had nothing, or only untimed words
      let lyrics = found.lyrics
      if (want.lyrics && song.lyricsUri && !lyrics?.synced) {
        const local = await readLyricsFile(song.lyricsUri)
        if (local && (local.synced || !lyrics)) lyrics = local
      }
      const now = Date.now()
      if (want.lyrics && lyrics !== undefined) {
        // A second look that finds nothing must not throw away lyrics that were saved before
        if (lyrics || !entry?.lyrics) {
          // Words without timing never replace timed lyrics that were saved before
          if (lyrics?.synced || !entry?.lyricsSynced) {
            store.saveLyrics(song.id, lyrics)
            store.patch(song.id, { lyrics: !!lyrics, lyricsAt: now, lyricsFor: song.duration, lyricsSynced: !!lyrics?.synced, syncTriedAt: now, lyricsV: LYRICS_V, srcV: SOURCES_V })
          } else store.patch(song.id, { syncTriedAt: now, lyricsV: LYRICS_V })
        } else store.patch(song.id, { lyricsAt: now, lyricsFor: song.duration, syncTriedAt: now, lyricsV: LYRICS_V, srcV: SOURCES_V })
      }
      if (want.cover && found.release !== undefined) {
        let cover: string | null = null
        if (found.release?.coverUrl) {
          try {
            cover = await saveCover(song.id, found.release.coverUrl)
          } catch (e) {
            error = e instanceof Error ? e.message : String(e)
          }
        }
        // A cover that exists but failed to download is not "no cover": leave it unmarked so it is tried again
        if (cover || !found.release?.coverUrl) store.patch(song.id, { cover, album: found.release?.album ?? null, coverAt: now, srcV: SOURCES_V })
      }
      if (found.fix) store.patch(song.id, found.fix)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      inflight.current.delete(song.id)
      setBusy((b) => (b === song.id ? null : b))
      setErrors((prev) => {
        const { [song.id]: _old, ...rest } = prev
        return error ? { ...rest, [song.id]: error } : rest
      })
    }
    return !error
  }

  const id = current?.id
  const lengthKnown = !!current && current.duration > 0
  const loadCurrent = useEffectEvent(() => current && store.loadLyrics(current.id))
  const runCurrent = useEffectEvent(() => current && run(current))
  useEffect(() => {
    if (store.hydrated) loadCurrent()
  }, [id, store.hydrated])
  // Starts once the song's length is known, so the lyrics found are the ones for this recording
  useEffect(() => {
    if (store.hydrated && store.enabled && lengthKnown) runCurrent()
  }, [id, lengthKnown, store.hydrated, store.enabled])

  const lyricsState = (song: Song | null): LyricsState => {
    if (!song) return "none"
    if (song.lyrics || song.plain) return "found"
    if (!store.enabled) return "off"
    if (busy === song.id) return "loading"
    if (errors[song.id]) return "error"
    return store.entries[song.id]?.lyricsAt ? "none" : "loading"
  }

  const enrichAll = async (songs: Song[]) => {
    if (bulk) return
    stopRequested.current = false
    setBulkError(null)
    const todo = songs.filter((s) => {
      const w = wanted(s, entriesRef.current[s.id])
      return w.lyrics || w.cover
    })
    setBulk({ done: 0, total: todo.length })
    let fails = 0
    let pauses = 0
    for (let i = 0; i < todo.length && !stopRequested.current; i++) {
      fails = (await run(todo[i])) ? 0 : fails + 1
      setBulk({ done: i + 1, total: todo.length })
      if (fails < MAX_FAILS_IN_A_ROW) continue
      // Servers that are busy or limit how fast they are asked recover in a minute: wait, then go on with the
      // songs that failed. Only a connection that stays down stops the run
      if (++pauses > MAX_PAUSES) {
        setBulkError("Se detuvo porque no hay conexión con los servidores. Vuelve a intentarlo cuando tengas internet.")
        break
      }
      fails = 0
      i -= MAX_FAILS_IN_A_ROW
      await sleep(PAUSE_MS)
    }
    setBulk(null)
  }

  /** Lyrics files saved beside songs are read once, so they show without playing the song first. */
  const importLyricsFiles = async (songs: Song[]) => {
    const todo = songs.filter((s) => s.lyricsUri && !entriesRef.current[s.id]?.lyrics)
    for (const song of todo) {
      const local = await readLyricsFile(song.lyricsUri!)
      if (!local) continue
      store.saveLyrics(song.id, local)
      // lyricsFor stays empty: once the song plays and its length is known, the internet is asked for timed lyrics too
      store.patch(song.id, { lyrics: true, lyricsAt: Date.now() })
    }
  }

  // Romanised reading of Japanese lyrics, shown under each line when the person turns it on
  const [romajiOn, setRomajiOnState] = useState(false)
  const [romajiBusy, setRomajiBusy] = useState<number | null>(null)
  const [romajiError, setRomajiError] = useState<string | null>(null)
  // Songs whose reading could not be fetched; they are not tried again until the person asks
  const [romajiFailed, setRomajiFailed] = useState<number[]>([])
  useEffect(() => {
    AsyncStorage.getItem(ROMAJI_KEY)
      .then((v) => v === "1" && setRomajiOnState(true))
      .catch(() => {})
  }, [])
  const setRomajiOn = (on: boolean) => {
    setRomajiOnState(on)
    setRomajiError(null)
    if (on) setRomajiFailed([])
    AsyncStorage.setItem(ROMAJI_KEY, on ? "1" : "0").catch(() => {})
  }
  const fillRomaji = async (song: Song) => {
    if (!song.lyrics) return
    setRomajiBusy(song.id)
    setRomajiError(null)
    try {
      store.patchLyrics(song.id, { romaji: await romanise(song.lyrics) })
    } catch (e) {
      setRomajiFailed((f) => [...f, song.id])
      setRomajiError(e instanceof Error ? e.message : "No se pudo convertir la letra")
    } finally {
      setRomajiBusy((b) => (b === song.id ? null : b))
    }
  }
  const startRomaji = useEffectEvent(() => current && fillRomaji(current))
  const wantsRomaji = romajiOn && store.enabled && !!current?.lyrics && !current.romaji && !romajiFailed.includes(current.id) && lyricsHaveJapanese(current.lyrics)
  // A moment's wait, so skipping through songs does not send a request for each one
  useEffect(() => {
    if (!wantsRomaji) return
    const timer = setTimeout(startRomaji, 400)
    return () => clearTimeout(timer)
  }, [wantsRomaji, id, current?.lyrics])

  /**
   * Covers saved on the phone that are gone (the app's data was moved or cleaned) are forgotten, so they are found
   * again instead of showing a broken picture.
   */
  const forgetMissingFiles = () => {
    const fix: Record<number, Partial<Entry>> = {}
    for (const [key, e] of Object.entries(entriesRef.current)) {
      const gone = (uri?: string | null) => typeof uri === "string" && uri.startsWith("file:") && !new File(uri).exists
      const f: Partial<Entry> = {}
      if (gone(e.cover)) Object.assign(f, { cover: undefined, coverAt: undefined })
      if (gone(e.thumb)) f.thumb = undefined
      if (gone(e.embedded)) Object.assign(f, { embedded: undefined, embeddedAt: undefined })
      if (Object.keys(f).length) fix[Number(key)] = f
    }
    if (Object.keys(fix).length) store.patchMany(fix)
  }

  /** Copies the picture saved inside each MP3 that has no cover yet, so it shows without asking the internet. */
  const importEmbedded = async (songs: Song[]) => {
    const dir = new Directory(Paths.document, "covers")
    const found: Record<number, Partial<Entry>> = {}
    for (const song of songs) {
      const e = entriesRef.current[song.id]
      if (!song.uri || !/\.mp3$/i.test(song.file ?? "") || e?.embeddedAt || typeof e?.cover === "string" || typeof e?.thumb === "string") continue
      let embedded: string | null = null
      const picture = await readPicture(song.uri)
      if (picture) {
        try {
          dir.create({ intermediates: true, idempotent: true })
          // "-video" marks a wide picture, which is shown whole over a blurred copy (see Art)
          const file = new File(dir, `${song.id}-tag${picture.wide ? "-video" : ""}.${picture.ext}`)
          await file.write(picture.data)
          embedded = file.uri
        } catch {
          // Could not be saved: the song keeps its pixel art and the internet search goes on
        }
      }
      found[song.id] = { embedded, embeddedAt: Date.now() }
    }
    if (Object.keys(found).length) store.patchMany(found)
  }

  const [thumbs, setThumbs] = useState<{ done: number; total: number } | null>(null)
  // Set at once, unlike `thumbs`, so the folder being picked and the automatic run never overlap
  const thumbsRun = useRef<Promise<void> | null>(null)
  const [thumbsMessage, setThumbsMessage] = useState<string | null>(null)
  const [snaptube, setSnaptube] = useState<string | null>(null)
  // Whether the saved folder has been read yet, so the "connect" notice does not flash before it is known
  const [snaptubeKnown, setSnaptubeKnown] = useState(false)
  useEffect(() => {
    AsyncStorage.getItem(SNAPTUBE_KEY)
      .then((v) => v && setSnaptube(v))
      .catch(() => {})
      .finally(() => setSnaptubeKnown(true))
  }, [])

  /**
   * Gives each downloaded song the thumbnail of its video, taken from the downloader's own history.
   * `ask` opens the folder picker; without it the folder chosen before is used.
   */
  const importThumbnails = (songs: Song[], ask: boolean): Promise<void> => {
    // A second call while one is running waits for that one instead of starting another
    thumbsRun.current ??= importNow(songs, ask).finally(() => {
      thumbsRun.current = null
    })
    return thumbsRun.current
  }
  const importNow = async (songs: Song[], ask: boolean) => {
    setThumbsMessage(null)
    try {
      let folder = snaptube
      if (ask || !folder) {
        folder = await pickFolder(SNAPTUBE_HINT)
        if (!folder) return
        setSnaptube(folder)
        AsyncStorage.setItem(SNAPTUBE_KEY, folder).catch(() => {})
      }
      const list = await readThumbnails(folder)
      const todo = songs.filter((s) => s.file && list.has(s.file) && !entriesRef.current[s.id]?.thumb)
      setThumbs({ done: 0, total: todo.length })
      const found: Record<number, { thumb: string }> = {}
      let done = 0
      let next = 0
      // A few downloads at a time: quick, and kind to the connection
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (next < todo.length) {
            const song = todo[next++]
            try {
              found[song.id] = { thumb: await saveThumbnail(song.id, list.get(song.file!)!) }
            } catch {
              // that one stays with the pixel art
            }
            setThumbs({ done: ++done, total: todo.length })
          }
        }),
      )
      store.patchMany(found)
      const n = Object.keys(found).length
      setThumbsMessage(n ? `Listo: ${n} miniaturas de SnapTube guardadas.` : todo.length ? "No se pudo descargar ninguna miniatura. Revisa la conexión." : "No hay canciones nuevas con miniatura en SnapTube.")
    } catch (e) {
      setThumbsMessage(e instanceof Error ? e.message : "No se pudo leer SnapTube")
    } finally {
      setThumbs(null)
    }
  }

  const entries = Object.values(store.entries)
  return {
    enabled: store.enabled,
    setEnabled: store.setEnabled,
    lyricsState,
    error: id !== undefined ? errors[id] : undefined,
    retry: () => current && run(current),
    /** Looks for timed lyrics again right now, for a song that only has plain words */
    retrySynced: () => current && run(current, true),
    searching: id !== undefined && busy === id,
    romajiOn,
    setRomajiOn,
    romajiBusy,
    romajiError,
    retryRomaji: () => {
      setRomajiFailed([])
      setRomajiError(null)
      if (current) fillRomaji(current)
    },
    bulk,
    bulkError,
    enrichAll,
    importLyricsFiles,
    importEmbedded,
    forgetMissingFiles,
    importThumbnails,
    thumbs,
    thumbsMessage,
    snaptubeLinked: !!snaptube,
    snaptubeKnown,
    withThumb: entries.filter((e) => typeof e.thumb === "string").length,
    setLyricsOffset: (id: number, seconds: number) => store.patch(id, { offset: Math.round(seconds * 10) / 10 }),
    stopBulk: () => {
      stopRequested.current = true
    },
    // Any picture counts: official, saved inside the file, or the video thumbnail
    withCover: entries.filter((e) => [e.cover, e.embedded, e.thumb].some((c) => typeof c === "string")).length,
    withLyrics: entries.filter((e) => e.lyrics).length,
  }
}

export type SongInfo = ReturnType<typeof useSongInfo>

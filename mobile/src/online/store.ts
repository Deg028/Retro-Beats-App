import { useEffect, useMemo, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { LyricLine } from "../data"
import { Lyrics, tidyLyrics } from "./lrclib"

const INDEX_KEY = "retro-beats:online:v2"
const ON_KEY = "retro-beats:online-on"
// Lyrics live under one key per song: all of them together would be too big for a single stored value
const LYRICS_KEY = "retro-beats:lyrics:"

/** What is known online about one song. A part with no timestamp was never looked up. */
export type Entry = {
  lyricsAt?: number
  coverAt?: number
  /** Lyrics are stored under this song's own key */
  lyrics?: boolean
  /** Length of the song when the lyrics were looked up; 0 or missing: it was not known, so the timings may belong to another version */
  lyricsFor?: number
  /** Seconds the person moved the lyrics by (positive: they appear earlier) */
  offset?: number
  /** Where the cover was saved; null: looked up and none found */
  cover?: string | null
  album?: string | null
  /** The video's thumbnail saved by the downloader app, used while no official cover is found */
  thumb?: string | null
  /** Names from the databases, kept only when they fix the ones from the file name */
  artist?: string
  title?: string
}

/** What the player shows in place of the file's own information. */
export type SongMeta = { artist?: string; title?: string; cover?: string; lyrics?: LyricLine[]; plain?: string; offset?: number }

export type InfoStore = ReturnType<typeof useInfoStore>

/** Everything found online, kept on the phone so each song is looked up once. */
export function useInfoStore() {
  const [entries, setEntries] = useState<Record<number, Entry>>({})
  const [lyrics, setLyrics] = useState<Record<number, Lyrics>>({})
  const [enabled, setEnabledState] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(INDEX_KEY), AsyncStorage.getItem(ON_KEY)])
      .then(([index, on]) => {
        if (index) setEntries(JSON.parse(index))
        if (on === "0") setEnabledState(false)
      })
      .catch(() => {})
      .finally(() => setHydrated(true))
  }, [])

  // Saved a moment after the last change, so a long run of lookups doesn't write on every song
  useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(() => AsyncStorage.setItem(INDEX_KEY, JSON.stringify(entries)).catch(() => {}), 800)
    return () => clearTimeout(timer)
  }, [entries, hydrated])

  const setEnabled = (on: boolean) => {
    setEnabledState(on)
    AsyncStorage.setItem(ON_KEY, on ? "1" : "0").catch(() => {})
  }

  const patch = (id: number, part: Partial<Entry>) => setEntries((prev) => ({ ...prev, [id]: { ...prev[id], ...part } }))

  /** Many songs at once, as one change to the screen */
  const patchMany = (parts: Record<number, Partial<Entry>>) =>
    setEntries((prev) => {
      const next = { ...prev }
      for (const [id, part] of Object.entries(parts)) next[Number(id)] = { ...next[Number(id)], ...part }
      return next
    })

  const saveLyrics = (id: number, found: Lyrics | null) => {
    if (!found) return void AsyncStorage.removeItem(LYRICS_KEY + id).catch(() => {})
    AsyncStorage.setItem(LYRICS_KEY + id, JSON.stringify(found)).catch(() => {})
    setLyrics((prev) => ({ ...prev, [id]: found }))
  }

  /** Reads a song's saved lyrics into memory, which happens when the song is about to play. */
  const loadLyrics = (id: number) => {
    if (lyrics[id] || !entries[id]?.lyrics) return
    AsyncStorage.getItem(LYRICS_KEY + id)
      .then((raw) => raw && setLyrics((prev) => ({ ...prev, [id]: tidyLyrics(JSON.parse(raw)) })))
      .catch(() => {})
  }

  const meta = useMemo(() => {
    const out: Record<number, SongMeta> = {}
    for (const [key, e] of Object.entries(entries)) {
      const id = Number(key)
      out[id] = {
        artist: e.artist,
        title: e.title,
        cover: e.cover ?? e.thumb ?? undefined,
        lyrics: lyrics[id]?.synced ?? undefined,
        plain: lyrics[id]?.plain ?? undefined,
        offset: e.offset,
      }
    }
    return out
  }, [entries, lyrics])

  return { entries, enabled, hydrated, meta, setEnabled, patch, patchMany, saveLyrics, loadLyrics }
}

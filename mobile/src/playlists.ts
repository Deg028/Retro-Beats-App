import { useEffect, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

export type Playlist = { id: string; name: string; songIds: number[]; createdAt: number }

const KEY = "retro-beats:playlists"
export const MAX_NAME = 40

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const clean = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME)

/** The person's own playlists: a name and the songs they picked, saved on the phone. */
export function usePlaylists() {
  const [lists, setLists] = useState<Playlist[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return
        const saved = JSON.parse(raw) as Playlist[]
        // Lists made before this was read (the first moments of the app) stay in front of the saved ones
        setLists((made) => [...made, ...saved.filter((s) => !made.some((m) => m.id === s.id))])
      })
      .catch(() => {})
      .finally(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(() => AsyncStorage.setItem(KEY, JSON.stringify(lists)).catch(() => {}), 400)
    return () => clearTimeout(timer)
  }, [lists, hydrated])

  const update = (id: string, change: (l: Playlist) => Playlist) => setLists((all) => all.map((l) => (l.id === id ? change(l) : l)))

  /** Makes a list and returns its id, or null when the name is empty. Songs can be given to start it. */
  const create = (name: string, songIds: number[] = []): string | null => {
    const trimmed = clean(name)
    if (!trimmed) return null
    const id = newId()
    setLists((all) => [...all, { id, name: trimmed, songIds: [...new Set(songIds)], createdAt: Date.now() }])
    return id
  }

  return {
    lists,
    hydrated,
    create,
    rename: (id: string, name: string) => {
      const trimmed = clean(name)
      if (trimmed) update(id, (l) => ({ ...l, name: trimmed }))
    },
    remove: (id: string) => setLists((all) => all.filter((l) => l.id !== id)),
    /** Adds songs at the end; the ones already in the list are skipped. */
    addSongs: (id: string, songIds: number[]) => update(id, (l) => ({ ...l, songIds: [...l.songIds, ...songIds.filter((s, i) => !l.songIds.includes(s) && songIds.indexOf(s) === i)] })),
    removeSong: (id: string, songId: number) => update(id, (l) => ({ ...l, songIds: l.songIds.filter((s) => s !== songId) })),
    toggleSong: (id: string, songId: number) =>
      update(id, (l) => ({ ...l, songIds: l.songIds.includes(songId) ? l.songIds.filter((s) => s !== songId) : [...l.songIds, songId] })),
  }
}

export type PlaylistsApi = ReturnType<typeof usePlaylists>

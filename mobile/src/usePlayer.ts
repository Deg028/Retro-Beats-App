import { useEffect, useRef, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { INITIAL_SONGS, Song } from "./data"

export type PlayMode = "off" | "repeat-one" | "repeat-all" | "shuffle"

const STORAGE_KEY = "retro-beats:v1"

type Saved = {
  songs: Pick<Song, "id" | "plays" | "fav" | "lastPlayed" | "addedAt" | "added">[]
  playMode: PlayMode
}

export function usePlayer() {
  const [songs, setSongs] = useState<Song[]>(INITIAL_SONGS)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [playMode, setPlayMode] = useState<PlayMode>("repeat-all")
  const [toast, setToast] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const counter = useRef(100)
  const addCounter = useRef(20)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = songs.find((s) => s.id === currentId) ?? null
  const library = songs.filter((s) => s.added)
  // Any song can be played; once the user saves songs, next/prev/shuffle only use those.
  const queue = library.length ? library : songs

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return
        const saved = JSON.parse(raw) as Saved
        const merged = INITIAL_SONGS.map((s) => ({
          ...s,
          ...saved.songs.find((x) => x.id === s.id),
        }))
        setSongs(merged)
        setPlayMode(saved.playMode ?? "repeat-all")
        counter.current = Math.max(100, ...merged.map((s) => s.lastPlayed))
        addCounter.current = Math.max(20, ...merged.map((s) => s.addedAt))
      })
      .catch(() => {})
      .finally(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const saved: Saved = {
      songs: songs.map(({ id, plays, fav, lastPlayed, addedAt, added }) => ({
        id,
        plays,
        fav,
        lastPlayed,
        addedAt,
        added,
      })),
      playMode,
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {})
  }, [songs, playMode, hydrated])

  useEffect(() => {
    if (!playing || !current) return
    const id = setInterval(() => setTime((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [playing, current])

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    [],
  )

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }

  const play = (id: number) => {
    counter.current += 1
    const stamp = counter.current
    setSongs((ss) =>
      ss.map((s) => (s.id === id ? { ...s, plays: s.plays + 1, lastPlayed: stamp } : s)),
    )
    setCurrentId(id)
    setTime(0)
    setPlaying(true)
  }

  const playRandom = () => {
    if (!queue.length) return
    const choices = queue.filter((s) => s.id !== currentId)
    const choice = choices[Math.floor(Math.random() * choices.length)] ?? queue[0]
    play(choice.id)
  }

  const playMix = () => {
    setPlayMode("shuffle")
    playRandom()
  }

  const changePlayMode = (mode: PlayMode) => {
    setPlayMode(mode)
    if (mode === "shuffle") playRandom()
  }

  const step = (dir: 1 | -1) => {
    if (!queue.length) return
    if (playMode === "shuffle") return playRandom()
    const i = queue.findIndex((s) => s.id === currentId)
    // Current song is outside the queue (played from the catalog): enter at either end
    const next = i === -1 ? (dir === 1 ? 0 : queue.length - 1) : i + dir
    if (playMode === "off" && (next < 0 || next >= queue.length)) return
    play(queue[(next + queue.length) % queue.length].id)
  }

  const toggleFav = (id: number) =>
    setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, fav: !s.fav } : s)))

  const toggleLibrary = (id: number) => {
    const song = songs.find((s) => s.id === id)
    if (!song) return
    if (song.added) {
      setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, added: false, addedAt: 0 } : s)))
      showToast(`${song.title} se quitó de tu biblioteca`)
      return
    }
    addCounter.current += 1
    const stamp = addCounter.current
    setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, added: true, addedAt: stamp } : s)))
    showToast(`¡${song.title} se agregó a tu biblioteca!`)
  }

  // Always points at the latest closure so the end-of-track effect never reads stale state.
  const onTrackEnd = useRef(() => {})
  onTrackEnd.current = () => {
    if (!current || time < current.duration) return
    if (playMode === "repeat-one") return play(current.id)
    if (playMode === "shuffle") return playRandom()
    const next = queue.findIndex((s) => s.id === current.id) + 1
    if (playMode === "off" && next >= queue.length) {
      setPlaying(false)
      setTime(current.duration)
      return
    }
    play(queue[next % queue.length].id)
  }
  useEffect(() => {
    onTrackEnd.current()
  }, [time])

  return {
    songs,
    library,
    current,
    currentId,
    playing,
    time,
    playMode,
    toast,
    play,
    playMix,
    step,
    toggleFav,
    toggleLibrary,
    changePlayMode,
    togglePlaying: () => setPlaying((p) => !p),
    seek: setTime,
  }
}

export type PlayerApi = ReturnType<typeof usePlayer>

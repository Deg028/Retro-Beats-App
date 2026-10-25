import { useEffect, useEffectEvent, useRef, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { isRunningInExpoGo } from "expo"
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import { AUDIO, INITIAL_SONGS, Song } from "./data"

export type Repeat = "off" | "all" | "one"
export type Sleep = { kind: "time"; until: number } | { kind: "end" } | null

const STORAGE_KEY = "retro-beats:v2"
const LEGACY_KEY = "retro-beats:v1"

type SavedSong = Pick<Song, "id" | "plays" | "fav" | "lastPlayed" | "addedAt" | "added">
type Saved = { songs: SavedSong[]; shuffle?: boolean; repeat?: Repeat; playMode?: "off" | "repeat-one" | "repeat-all" | "shuffle" }

const shuffled = <T>(xs: T[]) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function usePlayer() {
  const [songs, setSongs] = useState<Song[]>(INITIAL_SONGS)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<Repeat>("all")
  // Stable shuffled order (so "previous" works) and songs the user removed from the queue this session
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([])
  const [removed, setRemoved] = useState<number[]>([])
  const [sleep, setSleep] = useState<Sleep>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const counter = useRef(100)
  const addCounter = useRef(20)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lockScreenActive = useRef(false)

  const audio = useAudioPlayer(null, { updateInterval: 250 })
  const status = useAudioPlayerStatus(audio)

  const current = songs.find((s) => s.id === currentId) ?? null
  const library = songs.filter((s) => s.added)
  // Any song can be played; once the user saves songs, next/prev/shuffle only use those.
  const base = (library.length ? library : songs).map((s) => s.id)
  const order = (
    shuffle ? [...shuffleOrder.filter((id) => base.includes(id)), ...base.filter((id) => !shuffleOrder.includes(id))] : base
  ).filter((id) => !removed.includes(id))
  const duration = status.duration > 0 ? status.duration : (current?.duration ?? 0)
  const time = Math.min(status.currentTime, duration)

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" }).catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(LEGACY_KEY)])
      .then(([raw, legacy]) => {
        const json = raw ?? legacy
        if (!json) return
        const saved = JSON.parse(json) as Saved
        const merged = INITIAL_SONGS.map((s) => ({ ...s, ...saved.songs.find((x) => x.id === s.id) }))
        setSongs(merged)
        if (saved.repeat) setRepeat(saved.repeat)
        if (saved.shuffle) setShuffle(true)
        // v1 stored shuffle and repeat as a single mode
        if (saved.playMode === "shuffle") setShuffle(true)
        if (saved.playMode === "repeat-one") setRepeat("one")
        if (saved.playMode === "off") setRepeat("off")
        counter.current = Math.max(100, ...merged.map((s) => s.lastPlayed))
        addCounter.current = Math.max(20, ...merged.map((s) => s.addedAt))
      })
      .catch(() => {})
      .finally(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const saved: Saved = {
      songs: songs.map(({ id, plays, fav, lastPlayed, addedAt, added }) => ({ id, plays, fav, lastPlayed, addedAt, added })),
      shuffle,
      repeat,
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {})
  }, [songs, shuffle, repeat, hydrated])

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    [],
  )

  /** Media notification and lock screen controls; they need a native build, so Expo Go is skipped (see useNowPlaying). */
  const setNowPlaying = (meta: { title: string; artist?: string; albumTitle?: string }) => {
    if (isRunningInExpoGo()) return
    try {
      if (lockScreenActive.current) audio.updateLockScreenMetadata(meta)
      else audio.setActiveForLockScreen(true, meta, { showSeekBackward: true, showSeekForward: true })
      lockScreenActive.current = true
    } catch {
      // The playback service may be unavailable on this device
    }
  }

  const onSleepTimeout = useEffectEvent(() => {
    audio.pause()
    setSleep(null)
    showToast("Temporizador: música en pausa")
  })
  useEffect(() => {
    if (sleep?.kind !== "time") return
    const id = setTimeout(onSleepTimeout, Math.max(0, sleep.until - Date.now()))
    return () => clearTimeout(id)
  }, [sleep])

  const play = (id: number) => {
    counter.current += 1
    const stamp = counter.current
    setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, plays: s.plays + 1, lastPlayed: stamp } : s)))
    setRemoved((r) => r.filter((x) => x !== id))
    setCurrentId(id)
    audio.replace(AUDIO[id])
    audio.play()
  }

  const seek = (seconds: number) => {
    audio.seekTo(Math.max(0, Math.min(seconds, duration))).catch(() => {})
  }

  const togglePlaying = () => {
    if (!current) return order.length && play(order[0])
    if (status.playing) return audio.pause()
    if (duration && status.currentTime >= duration - 0.25) seek(0)
    audio.play()
  }

  /** auto: called when a track ends by itself, so "repeat off" stops at the end of the queue. */
  const step = (dir: 1 | -1, auto = false) => {
    if (!order.length) return
    if (!current) return play(order[0])
    if (dir === -1 && status.currentTime > 3) return seek(0)
    const i = order.indexOf(current.id)
    // Current song is outside the queue (played from the catalog): enter at either end
    const next = i === -1 ? (dir === 1 ? 0 : order.length - 1) : i + dir
    if (auto && repeat === "off" && next >= order.length) return
    play(order[(next + order.length) % order.length])
  }

  // Effect event: always sees the latest state, so the end-of-track handler never reads stale values.
  const onTrackEnd = useEffectEvent(() => {
    if (!current) return
    if (sleep?.kind === "end") {
      setSleep(null)
      return showToast("Temporizador: música en pausa")
    }
    if (repeat === "one") return play(current.id)
    step(1, true)
  })
  useEffect(() => {
    const sub = audio.addListener("playbackStatusUpdate", (s) => {
      if (s.didJustFinish) onTrackEnd()
    })
    return () => sub.remove()
  }, [audio])

  const toggleShuffle = () => {
    setRemoved([])
    if (shuffle) return setShuffle(false)
    const rest = base.filter((id) => id !== currentId)
    setShuffleOrder(currentId !== null && base.includes(currentId) ? [currentId, ...shuffled(rest)] : shuffled(base))
    setShuffle(true)
  }

  const cycleRepeat = () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"))

  const playMix = () => {
    const mix = shuffled(base)
    setRemoved([])
    setShuffleOrder(mix)
    setShuffle(true)
    if (mix.length) play(mix[0])
  }

  const setSleepTimer = (minutes: number | "end" | null) => {
    if (minutes === null) {
      setSleep(null)
      return showToast("Temporizador desactivado")
    }
    if (minutes === "end") {
      setSleep({ kind: "end" })
      return showToast("Se detendrá al terminar la canción")
    }
    setSleep({ kind: "time", until: Date.now() + minutes * 60_000 })
    showToast(`La música se detendrá en ${minutes} min`)
  }

  const removeFromQueue = (id: number) => setRemoved((r) => [...r, id])

  const toggleFav = (id: number) => setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, fav: !s.fav } : s)))

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

  const idx = currentId === null ? -1 : order.indexOf(currentId)
  const upNextIds = idx === -1 ? order : [...order.slice(idx + 1), ...(repeat === "all" ? order.slice(0, idx) : [])]
  const upNext = upNextIds.map((id) => songs.find((s) => s.id === id)).filter((s): s is Song => !!s)

  return {
    songs,
    library,
    current,
    currentId,
    playing: status.playing,
    buffering: status.isBuffering,
    time,
    duration,
    shuffle,
    repeat,
    upNext,
    sleep,
    toast,
    sourceLabel: current?.added ? "Tu biblioteca" : "Catálogo",
    play,
    playMix,
    step,
    seek,
    togglePlaying,
    toggleShuffle,
    cycleRepeat,
    setSleepTimer,
    removeFromQueue,
    toggleFav,
    toggleLibrary,
    setNowPlaying,
  }
}

export type PlayerApi = ReturnType<typeof usePlayer>

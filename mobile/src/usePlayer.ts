import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { isRunningInExpoGo } from "expo"
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import type { AudioPlayer } from "expo-audio"
import { Song } from "./data"
import { DeviceTrack } from "./library/files"
import type { SongMeta } from "./online/store"

export type Repeat = "off" | "all" | "one"
export type Sleep = { kind: "time"; until: number } | { kind: "end" } | null

const STORAGE_KEY = "retro-beats:v2"
const LEGACY_KEY = "retro-beats:v1"

type SavedSong = Pick<Song, "id" | "plays" | "fav" | "lastPlayed" | "addedAt" | "added">
/** The phone's songs as library entries, keeping what was recorded about each one before. */
function withDevice(prev: Song[], device: DeviceTrack[], saved: SavedSong[]): Song[] {
  // What was recorded about each song is kept by id, including songs missing right now (an unmounted SD card)
  const known = new Map<number, SavedSong>(saved.map((x) => [x.id, x]))
  for (const s of prev) known.set(s.id, s)
  return device.map((t, i): Song => {
    const k = known.get(t.id)
    const added = k?.added ?? true
    return {
      id: t.id,
      title: t.title,
      artist: t.artist,
      // Folder scans can't read lengths; keep one learned before
      duration: t.duration || (known.get(t.id) as Song | undefined)?.duration || 0,
      uri: t.uri,
      file: t.file,
      lyricsUri: t.lyricsUri,
      plays: k?.plays ?? 0,
      fav: k?.fav ?? false,
      lastPlayed: k?.lastPlayed ?? 0,
      added,
      // The phone's songs are ordered by when the file was created, newest last in this number
      addedAt: added ? 100 + i : 0,
    }
  })
}

const derived = new WeakMap<Song, { meta: SongMeta; song: Song }>()

type Saved = { songs: SavedSong[]; shuffle?: boolean; repeat?: Repeat; playMode?: "off" | "repeat-one" | "repeat-all" | "shuffle" }

const shuffled = <T>(xs: T[]) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function usePlayer(device: DeviceTrack[], meta: Record<number, SongMeta>) {
  // The songs as scanned, with what the person did to them; what was found online is added on top below
  const [stored, setSongs] = useState<Song[]>([])
  // Saved records, read once at start; they are applied whenever the list of songs on the phone changes
  const [savedPhone, setSavedPhone] = useState<SavedSong[]>([])
  const [syncedDevice, setSyncedDevice] = useState(device)
  // Songs that failed to open this session; they are skipped until tapped again
  const [broken, setBroken] = useState<number[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<Repeat>("all")
  // Stable shuffled order (so "previous" works) and songs the user removed from the queue this session
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([])
  const [removed, setRemoved] = useState<number[]>([])
  const [sleep, setSleep] = useState<Sleep>(null)
  // A playlist being played: its songs are the queue, and the name shows where the music comes from
  const [context, setContext] = useState<{ ids: number[]; label: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const counter = useRef(100)
  const addCounter = useRef(20)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failures = useRef(0)
  const failedFor = useRef<number | null>(null)

  if (device !== syncedDevice) {
    setSyncedDevice(device)
    setSongs((prev) => withDevice(prev, device, savedPhone))
  }

  const audio = useAudioPlayer(null, { updateInterval: 250 })
  // Only what changes rarely lives here. The running time ticks four times a second and is read by
  // the screens that show it (usePlaybackTime), so the whole app does not redraw on every tick.
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [loadedDuration, setLoadedDuration] = useState(0)

  const songs = useMemo(
    () =>
      stored.map((s): Song => {
        const m = meta[s.id]
        if (!m) return s
        // The same song with the same information stays the same object, so lists do not redraw its row
        const known = derived.get(s)
        if (known && known.meta === m) return known.song
        const song: Song = { ...s, title: m.title ?? s.title, artist: m.artist ?? s.artist, album: m.album, cover: m.cover, lyrics: m.lyrics, romaji: m.romaji, plain: m.plain, lyricsOffset: m.offset }
        derived.set(s, { meta: m, song })
        return song
      }),
    [stored, meta],
  )
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs])
  const current = (currentId !== null && byId.get(currentId)) || null
  const library = useMemo(() => songs.filter((s) => s.added), [songs])
  // Any song can be played; once the user saves songs, next/prev/shuffle only use those.
  const base = useMemo(() => {
    const skip = new Set(broken)
    if (context) return context.ids.filter((id) => byId.has(id) && !skip.has(id))
    return (library.length ? library : songs).map((s) => s.id).filter((id) => !skip.has(id))
  }, [library, songs, broken, context, byId])
  const order = useMemo(() => {
    const gone = new Set(removed)
    if (!shuffle) return base.filter((id) => !gone.has(id))
    const inBase = new Set(base)
    const inOrder = new Set(shuffleOrder)
    return [...shuffleOrder.filter((id) => inBase.has(id)), ...base.filter((id) => !inOrder.has(id))].filter((id) => !gone.has(id))
  }, [base, shuffle, shuffleOrder, removed])
  const duration = loadedDuration > 0 ? loadedDuration : (current?.duration ?? 0)

  // A song whose length wasn't known (folder scan) learns it the first time it loads
  if (current && !current.duration && loadedDuration > 0) {
    setSongs((ss) => ss.map((s) => (s.id === current.id ? { ...s, duration: loadedDuration } : s)))
  }

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" }).catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(LEGACY_KEY)])
      .then(([raw, legacy]) => {
        const json = raw ?? legacy
        if (!json) return
        const saved = JSON.parse(json) as Saved
        const byId = new Map(saved.songs.map((x) => [x.id, x]))
        // Only what the person did is restored; the order of songs comes from the scan
        const apply = (s: Song): Song => {
          const k = byId.get(s.id)
          return k ? { ...s, plays: k.plays, fav: k.fav, lastPlayed: k.lastPlayed, added: k.added, addedAt: k.added ? s.addedAt : 0 } : s
        }
        setSongs((prev) => prev.map(apply))
        setSavedPhone(saved.songs)
        const merged = saved.songs
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
    // Songs are stored only once the person did something with them, so a big library stays small on disk
    const touched = (s: Song) => s.plays > 0 || s.fav || s.lastPlayed > 0 || !s.added
    const present = new Set(songs.map((s) => s.id))
    const saved: Saved = {
      songs: [
        ...songs.filter(touched).map(({ id, plays, fav, lastPlayed, addedAt, added }) => ({ id, plays, fav, lastPlayed, addedAt, added })),
        ...savedPhone.filter((x) => !present.has(x.id)),
      ],
      shuffle,
      repeat,
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {})
  }, [songs, savedPhone, shuffle, repeat, hydrated])

  // New "added" stamps must stay above the phone songs' order numbers
  useEffect(() => {
    addCounter.current = Math.max(addCounter.current, ...songs.map((s) => s.addedAt))
  }, [songs])

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
  const lockScreenColor = useRef<string | null>(null)
  const setNowPlaying = (meta: { title: string; artist?: string; albumTitle?: string; artworkUrl?: string }, accentColor?: string) => {
    if (isRunningInExpoGo()) return
    try {
      // Registering again rebuilds the media session, which pauses the song: done the first time, and for a new
      // theme colour only while the music is paused. Otherwise only the text and picture change.
      // Skip arrows replace the ±10 s buttons and the accent colours the notification
      const color = accentColor ?? ""
      if (lockScreenColor.current !== null && (lockScreenColor.current === color || audio.playing)) return audio.updateLockScreenMetadata(meta)
      audio.setActiveForLockScreen(true, meta, { showNextTrack: true, showPreviousTrack: true, accentColor } as Parameters<typeof audio.setActiveForLockScreen>[2])
      lockScreenColor.current = color
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

  /** retry: a tap on a song that failed before tries it again; skipping ahead automatically never does, so a queue of bad files ends instead of looping. */
  const play = (id: number, retry = true) => {
    counter.current += 1
    const stamp = counter.current
    setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, plays: s.plays + 1, lastPlayed: stamp } : s)))
    setRemoved((r) => r.filter((x) => x !== id))
    // Tapping a song that failed before gives it another chance
    if (retry) setBroken((b) => b.filter((x) => x !== id))
    failedFor.current = null
    // The length reported so far belongs to the song that was playing
    setLoadedDuration(0)
    setCurrentId(id)
    const uri = byId.get(id)?.uri
    if (!uri) return
    try {
      audio.replace({ uri })
      audio.play()
    } catch {
      if (markBroken(id)) showToast(`No se pudo abrir «${byId.get(id)?.title ?? "la canción"}».`)
    }
  }

  /** Marks a file that can't be opened. Returns false if this failure was already handled. */
  const markBroken = (id: number) => {
    if (failedFor.current === id) return false
    failedFor.current = id
    setBroken((b) => (b.includes(id) ? b : [...b, id]))
    failures.current += 1
    return true
  }

  const seek = (seconds: number) => {
    audio.seekTo(Math.max(0, Math.min(seconds, duration))).catch(() => {})
  }

  const togglePlaying = () => {
    if (!current) return order.length && play(order[0])
    if (playing) return audio.pause()
    if (duration && audio.currentTime >= duration - 0.25) seek(0)
    audio.play()
  }

  /** auto: called when a track ends by itself, so "repeat off" stops at the end of the queue. */
  const step = (dir: 1 | -1, auto = false) => {
    if (!order.length) return
    if (!current) return play(order[0])
    if (dir === -1 && audio.currentTime > 3) return seek(0)
    const i = order.indexOf(current.id)
    // Current song is outside the queue (played from the catalog): enter at either end
    const next = i === -1 ? (dir === 1 ? 0 : order.length - 1) : i + dir
    if (auto && repeat === "off" && next >= order.length) return
    play(order[(next + order.length) % order.length], false)
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
  // A file that fails to open must not leave the player stalled on it: skip ahead, unless several in a row fail
  const onAudioStatus = useEffectEvent((s: { didJustFinish: boolean; error: string | null; playing: boolean; isBuffering: boolean; duration: number; remoteCommand?: "next" | "previous" }) => {
    // Skip arrows in the media notification (sent by the expo-audio patch in patches/)
    if (s.remoteCommand) return step(s.remoteCommand === "next" ? 1 : -1)
    setPlaying(s.playing)
    setBuffering(s.isBuffering)
    if (s.duration > 0) setLoadedDuration(s.duration)
    if (s.didJustFinish) return onTrackEnd()
    if (s.error && currentId !== null) {
      if (!markBroken(currentId)) return
      const title = byId.get(currentId)?.title ?? "la canción"
      const rest = order.filter((id) => id !== currentId)
      if (!rest.length) {
        audio.pause()
        return showToast(`No se pudo abrir «${title}» y no quedan más canciones en la cola.`)
      }
      if (failures.current >= 5) {
        audio.pause()
        return showToast("Varias canciones seguidas no se abrieron. Revisa «Música del teléfono».")
      }
      showToast(`No se pudo abrir «${title}». Pasamos a la siguiente.`)
      return step(1, true)
    }
    // Only real playback proves the files open again
    if (s.playing) failures.current = 0
  })
  useEffect(() => {
    const sub = audio.addListener("playbackStatusUpdate", onAudioStatus)
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

  /** Plays one of the library's songs with the whole library as the queue. */
  const playLibrary = (id: number) => {
    setContext(null)
    play(id)
  }

  /** Plays a playlist: its songs become the queue, from `startId` (or the first) and in order, or shuffled. */
  const playList = (ids: number[], label: string, options: { startId?: number; shuffle?: boolean } = {}) => {
    const playable = ids.filter((id) => byId.has(id))
    if (!playable.length) return showToast("Esta lista no tiene canciones para reproducir")
    setContext({ ids: playable, label })
    setRemoved([])
    let first = options.startId ?? playable[0]
    if (options.shuffle) {
      const order = shuffled(playable.filter((id) => id !== options.startId))
      const sequence = options.startId !== undefined ? [options.startId, ...order] : order
      setShuffleOrder(sequence)
      setShuffle(true)
      first = sequence[0]
    } else setShuffle(false)
    play(first)
  }

  const playMix = () => {
    setContext(null)
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

  const upNext = useMemo(() => {
    const idx = currentId === null ? -1 : order.indexOf(currentId)
    const ids = idx === -1 ? order : [...order.slice(idx + 1), ...(repeat === "all" ? order.slice(0, idx) : [])]
    return ids.map((id) => byId.get(id)).filter((s): s is Song => !!s)
  }, [order, currentId, repeat, byId])

  return {
    songs,
    library,
    current,
    currentId,
    audio,
    playing,
    buffering,
    duration,
    shuffle,
    repeat,
    upNext,
    sleep,
    toast,
    broken: songs.filter((s) => broken.includes(s.id)),
    sourceLabel: context?.label ?? "Música del teléfono",
    play,
    playLibrary,
    playList,
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

/** Seconds played so far. Only the screens that draw it call this, so only they redraw as it ticks. */
export function usePlaybackTime(player: { audio: AudioPlayer; duration: number }) {
  const { currentTime } = useAudioPlayerStatus(player.audio)
  return player.duration > 0 ? Math.min(currentTime, player.duration) : currentTime
}

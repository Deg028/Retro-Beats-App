import { useEffect, useRef, useState } from "react"

import { INITIAL_SONGS, Song } from "./data"

import { Equalizer, PixelCover } from "./components/Pixel"

import Splash from "./components/Splash"

import Home, { HomeMenu, type HomeSection } from "./components/Home"

import Player, { type PlayMode } from "./components/Player"

import Album from "./components/Album"

const STORAGE_KEY = "retro-beats:v1"

type Stored = {
  songs: Pick<Song, "id" | "plays" | "fav" | "lastPlayed" | "addedAt" | "added">[]
  playMode: PlayMode
}

const loadStored = (): { songs: Song[]; playMode: PlayMode } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (raw) {
      const saved = JSON.parse(raw) as Stored

      const songs = INITIAL_SONGS.map((s) => ({
        ...s,
        ...saved.songs.find((x) => x.id === s.id),
      }))

      return { songs, playMode: saved.playMode ?? "repeat-all" }
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }

  return { songs: INITIAL_SONGS, playMode: "repeat-all" }
}

type Screen = "splash" | "home" | "player" | "album"

const TABS: { key: Exclude<Screen, "splash">; label: string; icon: string }[] = [
  { key: "home", label: "INICIO", icon: "⌂" },

  { key: "player", label: "CANCIÓN", icon: "◉" },

  { key: "album", label: "CATÁLOGO", icon: "▣" },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash")

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [initial] = useState(loadStored)

  const [songs, setSongs] = useState<Song[]>(initial.songs)

  const [currentId, setCurrentId] = useState<number | null>(null)

  const [homeSection, setHomeSection] = useState<HomeSection>("added")
  const [menuOpen, setMenuOpen] = useState(false)
  const [playing, setPlaying] = useState(false)

  const [time, setTime] = useState(0)

  const [playMode, setPlayMode] = useState<PlayMode>(initial.playMode)

  const counter = useRef(
    Math.max(100, ...initial.songs.map((s) => s.lastPlayed)),
  )

  const addCounter = useRef(
    Math.max(20, ...initial.songs.map((s) => s.addedAt)),
  )

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = songs.find((s) => s.id === currentId) ?? null

  const library = songs.filter((s) => s.added)
  // Any song can be played; once the user saves songs, next/prev/shuffle only use those.
  const queue = library.length ? library : songs

  const navigate = (next: Screen) => {
    setMenuOpen(false)

    if (next === screen) return

    setScreen(next)
  }

  const play = (id: number, open = true) => {
    counter.current += 1

    const stamp = counter.current

    setSongs((ss) =>
      ss.map((s) =>
        s.id === id ? { ...s, plays: s.plays + 1, lastPlayed: stamp } : s,
      ),
    )

    setCurrentId(id)

    setTime(0)

    setPlaying(true)

    if (open) navigate("player")
  }

  const playRandom = (open = false) => {
    if (!queue.length) return

    const choices = queue.filter((song) => song.id !== currentId)

    const choice =
      choices[Math.floor(Math.random() * choices.length)] ?? queue[0]

    play(choice.id, open)
  }

  const playMix = () => {
    setPlayMode("shuffle")

    playRandom(true)
  }

  const changePlayMode = (mode: PlayMode) => {
    setPlayMode(mode)

    if (mode === "shuffle") playRandom()
  }

  const step = (dir: 1 | -1) => {
    if (!queue.length) return

    if (playMode === "shuffle") {
      playRandom()

      return
    }

    const i = queue.findIndex((s) => s.id === currentId)

    // Current song is outside the queue (e.g. played from the catalog): enter at either end
    const nextIndex = i === -1 ? (dir === 1 ? 0 : queue.length - 1) : i + dir

    if (playMode === "off" && (nextIndex < 0 || nextIndex >= queue.length))
      return

    play(queue[(nextIndex + queue.length) % queue.length].id, false)
  }

  const toggleFav = (id: number) =>
    setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, fav: !s.fav } : s)))

  const showToast = (message: string) => {
    setToastMessage(message)

    if (toastTimer.current) clearTimeout(toastTimer.current)

    toastTimer.current = setTimeout(() => setToastMessage(null), 2400)
  }

  const addSong = (id: number) => {
    const song = songs.find((entry) => entry.id === id)

    if (!song || song.added) return

    addCounter.current += 1

    const stamp = addCounter.current

    setSongs((ss) =>
      ss.map((s) => (s.id === id ? { ...s, added: true, addedAt: stamp } : s)),
    )

    showToast(`¡${song.title} se agregó a tu biblioteca!`)
  }

  const toggleLibrary = (id: number) => {
    const song = songs.find((entry) => entry.id === id)

    if (!song) return

    if (!song.added) return addSong(id)

    setSongs((ss) =>
      ss.map((s) => (s.id === id ? { ...s, added: false, addedAt: 0 } : s)),
    )

    showToast(`${song.title} se quitó de tu biblioteca`)
  }

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (!playing || !current) return

    const id = setInterval(() => setTime((t) => t + 1), 1000)

    return () => clearInterval(id)
  }, [playing, current])

  useEffect(() => {
    try {
      const stored: Stored = {
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

      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    } catch {
      /* storage unavailable: ignore */
    }
  }, [songs, playMode])

  // Always points at the latest closure so the end-of-track effect never reads stale state.

  const onTrackEnd = useRef(() => {})

  onTrackEnd.current = () => {
    if (!current || time < current.duration) return

    if (playMode === "repeat-one") {
      play(current.id, false)

      return
    }

    if (playMode === "shuffle") {
      playRandom()

      return
    }

    if (!queue.length) {
      setPlaying(false)

      return
    }

    const currentIndex = queue.findIndex((song) => song.id === current.id)

    const nextIndex = currentIndex + 1

    if (playMode === "off" && nextIndex >= queue.length) {
      setPlaying(false)

      setTime(current.duration)

      return
    }

    play(queue[(nextIndex + queue.length) % queue.length].id, false)
  }

  useEffect(() => {
    onTrackEnd.current()
  }, [time])

  const showTabs = screen !== "splash"

  const showMini = current && (screen === "home" || screen === "album")

  return (
    <div className="scanlines flex min-h-dvh items-center justify-center bg-[#11151d] p-2 sm:p-3 md:p-8">
      <div className="phone-frame relative flex h-[calc(100dvh-1rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[2.25rem] border-[5px] border-[#343b48] bg-[#11151d] p-[5px] shadow-[0_18px_50px_rgba(0,0,0,0.55)] md:h-[844px] md:w-[390px] md:max-w-none">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[1.8rem] bg-ink">
          {screen === "splash" ? (
            <Splash onStart={() => setScreen("home")} />
          ) : (
            <>
              <div
                className="flex shrink-0 justify-center pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
                aria-hidden
              >
                <span className="h-1.5 w-12 rounded-full bg-[#343b48]" />
              </div>

              <div
                key={screen}
                className={`${
                  screen === "home" ? "home-screen-entry" : "screen-slide-in"
                } min-h-0 flex-1 overflow-y-auto pt-2`}
              >
                {screen === "home" && (
                  <Home
                    songs={songs}
                    currentId={currentId}
                    playing={playing}
                    onPlay={play}
                    onFav={toggleFav}
                    onMix={playMix}
                    section={homeSection}
                    menuOpen={menuOpen}
                    onOpenMenu={() => setMenuOpen(true)}
                  />
                )}
                {screen === "player" && (
                  <Player
                    song={current}
                    playing={playing}
                    time={time}
                    playMode={playMode}
                    songAdded={current?.added ?? false}
                    onToggle={() => setPlaying((p) => !p)}
                    onModeChange={changePlayMode}
                    onSeek={setTime}
                    onNext={() => step(1)}
                    onPrev={() => step(-1)}
                    onFav={toggleFav}
                    onToggleLibrary={toggleLibrary}
                    onBrowse={() => navigate("home")}
                  />
                )}
                {screen === "album" && (
                  <Album
                    songs={songs}
                    currentId={currentId}
                    onPlay={play}
                    onAddSong={addSong}
                  />
                )}
              </div>

              {showMini && current && (
                <div className="flex shrink-0 items-center gap-3 border-t-4 border-secondary bg-panel-2 px-3 py-2">
                  <button
                    onClick={() => navigate("player")}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-label="Abrir reproductor"
                  >
                    <PixelCover
                      seed={current.id}
                      className="h-9 w-9 border-2 border-secondary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-pixel text-[8px] text-cream">
                        {current.title}
                      </span>
                      <span className="block truncate text-lg leading-4 text-coral">
                        {current.artist}
                      </span>
                    </span>
                    <Equalizer playing={playing} bars={4} h={16} />
                  </button>
                  <button
                    onClick={() => setPlaying((p) => !p)}
                    className="px-btn bg-crimson px-3 py-2 text-cream"
                    aria-label="Reproducir o pausar"
                  >
                    {playing ? "❚❚" : "▶"}
                  </button>
                </div>
              )}

              {showTabs && (
                <nav
                  className="grid shrink-0 grid-cols-3 gap-2 border-t-4 border-secondary bg-panel px-3 pb-2 pt-3"
                  aria-label="Navegación principal"
                >
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => navigate(t.key)}
                      aria-current={screen === t.key ? "page" : undefined}
                      className={`px-btn flex flex-col items-center gap-1 py-1.5 ${
                        screen === t.key
                          ? "bg-crimson text-cream"
                          : "bg-panel-2 text-cream/60"
                      }`}
                    >
                      <span className="text-sm">{t.icon}</span>
                      <span className="text-[8px]">{t.label}</span>
                    </button>
                  ))}
                </nav>
              )}
            </>
          )}
          {screen === "home" && (
            <HomeMenu
              songs={songs}
              section={homeSection}
              open={menuOpen}
              onSelect={(key) => {
                setHomeSection(key)
                setMenuOpen(false)
              }}
              onClose={() => setMenuOpen(false)}
            />
          )}
          {toastMessage && (
            <div className="save-toast" role="status" aria-live="polite">
              {toastMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

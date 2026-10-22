import { useEffect, useRef, useState } from 'react'
import { INITIAL_SONGS, Song } from './data'
import { Equalizer, PixelCover } from './components/Pixel'
import Splash from './components/Splash'
import Home from './components/Home'
import Player, { type PlayMode } from './components/Player'
import Album from './components/Album'

type Screen = 'splash' | 'home' | 'player' | 'album'

const TABS: { key: Exclude<Screen, 'splash'>; label: string; icon: string }[] = [
  { key: 'home', label: 'INICIO', icon: '⌂' },
  { key: 'player', label: 'CANCIÓN', icon: '◉' },
  { key: 'album', label: 'ÁLBUM', icon: '▣' },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [history, setHistory] = useState<Screen[]>([])
  const [songs, setSongs] = useState<Song[]>(INITIAL_SONGS)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [playMode, setPlayMode] = useState<PlayMode>('repeat-all')
  const counter = useRef(100)
  const addCounter = useRef(20)

  const current = songs.find((s) => s.id === currentId) ?? null
  const library = songs.filter((s) => s.added)

  const navigate = (next: Screen) => {
    if (next === screen) return
    if (screen !== 'splash') setHistory((previous) => [...previous, screen])
    setScreen(next)
  }

  const goBack = () => {
    const previous = history[history.length - 1]
    if (previous) {
      setHistory((entries) => entries.slice(0, -1))
      setScreen(previous)
    } else if (screen !== 'home') {
      setScreen('home')
    }
  }

  const play = (id: number, open = true) => {
    counter.current += 1
    const stamp = counter.current
    setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, plays: s.plays + 1, lastPlayed: stamp } : s)))
    setCurrentId(id)
    setTime(0)
    setPlaying(true)
    if (open) navigate('player')
  }

  const playRandom = () => {
    if (!library.length) return
    const choices = library.filter((song) => song.id !== currentId)
    const choice = choices[Math.floor(Math.random() * choices.length)] ?? library[0]
    play(choice.id, false)
  }

  const step = (dir: 1 | -1) => {
    if (!library.length) return
    if (playMode === 'shuffle') {
      playRandom()
      return
    }
    const i = library.findIndex((s) => s.id === currentId)
    const nextIndex = i + dir
    if (playMode === 'off' && (nextIndex < 0 || nextIndex >= library.length)) return
    play(library[(nextIndex + library.length) % library.length].id, false)
  }

  const toggleFav = (id: number) => setSongs((ss) => ss.map((s) => (s.id === id ? { ...s, fav: !s.fav } : s)))

  const addSong = () => {
    addCounter.current += 1
    const stamp = addCounter.current
    setSongs((ss) => {
      const next = ss.find((s) => !s.added)
      return next ? ss.map((s) => (s.id === next.id ? { ...s, added: true, addedAt: stamp } : s)) : ss
    })
  }

  useEffect(() => {
    if (!playing || !current) return
    const id = setInterval(() => setTime((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [playing, current])

  useEffect(() => {
    if (!current || time < current.duration) return
    if (playMode === 'repeat-one') {
      setTime(0)
      return
    }
    if (playMode === 'shuffle') {
      playRandom()
      return
    }
    if (!library.length) {
      setPlaying(false)
      return
    }
    const currentIndex = library.findIndex((song) => song.id === current.id)
    const nextIndex = currentIndex + 1
    if (playMode === 'off' && nextIndex >= library.length) {
      setPlaying(false)
      setTime(current.duration)
      return
    }
    play(library[(nextIndex + library.length) % library.length].id, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time])

  const showTabs = screen !== 'splash'
  const showMini = current && (screen === 'home' || screen === 'album')

  return (
    <div className="scanlines flex min-h-dvh items-center justify-center bg-ink md:p-8">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-ink md:h-[844px] md:w-[390px] md:border-[10px] md:border-secondary md:shadow-[10px_10px_0_0_var(--color-blood)]">
        {screen === 'splash' ? (
          <Splash onStart={() => setScreen('home')} />
        ) : (
          <>
            <div className="grid shrink-0 grid-cols-3 items-center px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] font-pixel text-[8px] text-cream">
              <button
                onClick={goBack}
                disabled={!history.length && screen === 'home'}
                aria-label="Volver"
                className="flex h-11 w-11 items-center justify-center text-2xl text-coral transition-colors hover:bg-panel-2/60 focus-visible:outline-2 focus-visible:outline-coral disabled:invisible"
              >
                ←
              </button>
              <span className="text-center text-coral">RETRO BEATS</span>
              <span aria-hidden className="justify-self-end" />
            </div>

            <div key={screen} className="min-h-0 flex-1 overflow-y-auto pt-2">
              {screen === 'home' && (
                <Home songs={songs} currentId={currentId} playing={playing} onPlay={play} onFav={toggleFav} />
              )}
              {screen === 'player' && (
                <Player
                  song={current}
                  playing={playing}
                  time={time}
                  playMode={playMode}
                  onToggle={() => setPlaying((p) => !p)}
                  onStop={() => setPlaying(false)}
                  onModeChange={setPlayMode}
                  onSeek={setTime}
                  onNext={() => step(1)}
                  onPrev={() => step(-1)}
                  onFav={toggleFav}
                  onBrowse={() => navigate('home')}
                />
              )}
              {screen === 'album' && <Album songs={songs} currentId={currentId} onPlay={play} onAdd={addSong} />}
            </div>

            {showMini && current && (
              <div className="flex shrink-0 items-center gap-3 border-t-4 border-secondary bg-panel-2 px-3 py-2">
                <button onClick={() => navigate('player')} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Abrir reproductor">
                  <PixelCover seed={current.id} className="h-9 w-9 border-2 border-secondary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-pixel text-[8px] text-cream">{current.title}</span>
                    <span className="block truncate text-lg leading-4 text-coral">{current.artist}</span>
                  </span>
                  <Equalizer playing={playing} bars={4} h={16} />
                </button>
                <button onClick={() => setPlaying((p) => !p)} className="px-btn bg-crimson px-3 py-2 text-cream" aria-label="Reproducir o pausar">
                  {playing ? '❚❚' : '▶'}
                </button>
              </div>
            )}

            {showTabs && (
              <nav className="grid shrink-0 grid-cols-3 gap-2 border-t-4 border-secondary bg-panel px-3 pb-2 pt-3" aria-label="Navegación principal">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => navigate(t.key)}
                    aria-current={screen === t.key ? 'page' : undefined}
                    className={`px-btn flex flex-col items-center gap-1 py-1.5 ${screen === t.key ? 'bg-crimson text-cream' : 'bg-panel-2 text-cream/60'}`}
                  >
                    <span className="text-sm">{t.icon}</span>
                    <span className="text-[8px]">{t.label}</span>
                  </button>
                ))}
              </nav>
            )}
            <footer className="shrink-0 border-t border-secondary/40 bg-panel px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 text-center font-pixel text-[6px] leading-3 text-cream/55">
              DESARROLLADO POR: <span className="text-crimson">DEG</span>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

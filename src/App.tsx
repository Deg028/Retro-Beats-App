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
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [songs, setSongs] = useState<Song[]>(INITIAL_SONGS)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [playMode, setPlayMode] = useState<PlayMode>('repeat-all')
  const counter = useRef(100)
  const addCounter = useRef(20)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = songs.find((s) => s.id === currentId) ?? null
  const library = songs.filter((s) => s.added)

  const navigate = (next: Screen) => {
    if (next === screen) return
    setScreen(next)
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

  const changePlayMode = (mode: PlayMode) => {
    setPlayMode(mode)
    if (mode === 'shuffle') playRandom()
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

  const addSong = (id: number) => {
    const song = songs.find((entry) => entry.id === id)
    if (!song || song.added) return
    addCounter.current += 1
    const stamp = addCounter.current
    setSongs((ss) => ss.map((song) => (song.id === id && !song.added ? { ...song, added: true, addedAt: stamp } : song)))
    setToastMessage(`¡${song.title} ya fue añadido al álbum!`)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMessage(null), 2400)
  }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

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
    <div className="scanlines flex min-h-dvh items-center justify-center bg-[#11151d] p-2 sm:p-3 md:p-8">
      <div className="phone-frame relative flex h-[calc(100dvh-1rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[2.25rem] border-[5px] border-[#343b48] bg-[#11151d] p-[5px] shadow-[0_18px_50px_rgba(0,0,0,0.55)] md:h-[844px] md:w-[390px] md:max-w-none">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[1.8rem] bg-ink">
          {screen === 'splash' ? (
            <Splash onStart={() => setScreen('home')} />
          ) : (
            <>
              <div className="flex shrink-0 justify-center pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]" aria-hidden>
                <span className="h-1.5 w-12 rounded-full bg-[#343b48]" />
              </div>

              <div key={screen} className={`${screen === 'home' ? 'home-screen-entry' : 'screen-slide-in'} min-h-0 flex-1 overflow-y-auto pt-2`}>
                {screen === 'home' && (
                  <Home songs={songs} currentId={currentId} playing={playing} onPlay={play} onFav={toggleFav} />
                )}
                {screen === 'player' && (
                  <Player
                    song={current}
                    playing={playing}
                    time={time}
                    playMode={playMode}
                    songAdded={current?.added ?? false}
                    onToggle={() => setPlaying((p) => !p)}
                    onStop={() => setPlaying(false)}
                    onModeChange={changePlayMode}
                    onSeek={setTime}
                    onNext={() => step(1)}
                    onPrev={() => step(-1)}
                    onFav={toggleFav}
                    onAddSong={addSong}
                    onBrowse={() => navigate('home')}
                  />
                )}
                {screen === 'album' && <Album songs={songs} currentId={currentId} onPlay={play} onAddSong={addSong} />}
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
            </>
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

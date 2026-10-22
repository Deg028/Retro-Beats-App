import { useEffect, useRef, useState } from 'react'
import { Song, fmt } from '../data'
import { PixelCover, PixelHeart, PixelSaveIcon } from './Pixel'

export type PlayMode = 'off' | 'repeat-one' | 'repeat-all' | 'shuffle'

type Props = {
  song: Song | null
  playing: boolean
  time: number
  playMode: PlayMode
  songAdded: boolean
  onToggle: () => void
  onStop: () => void
  onModeChange: (mode: PlayMode) => void
  onSeek: (t: number) => void
  onNext: () => void
  onPrev: () => void
  onFav: (id: number) => void
  onAddSong: (id: number) => void
  onBrowse: () => void
}

export default function Player({ song, playing, time, playMode, songAdded, onToggle, onStop, onModeChange, onSeek, onNext, onPrev, onFav, onAddSong, onBrowse }: Props) {
  const [view, setView] = useState<'DISCO' | 'LETRAS'>('DISCO')
  const [justAdded, setJustAdded] = useState(false)
  const lineRefs = useRef<(HTMLLIElement | null)[]>([])

  const lines = song?.lyrics
  const lineIdx = song && lines ? Math.min(lines.length - 1, Math.floor((time / song.duration) * lines.length)) : -1

  useEffect(() => {
    if (view === 'LETRAS' && lineIdx >= 0) lineRefs.current[lineIdx]?.scrollIntoView({ block: 'center' })
  }, [lineIdx, view])

  const playbackModes = (
    <div className="player-modes mb-2 grid grid-cols-3 gap-2">
      {([
        { mode: 'shuffle', ariaLabel: 'Reproducir biblioteca en orden aleatorio' },
        { mode: 'repeat-one', ariaLabel: 'Repetir canción actual' },
        { mode: 'repeat-all', ariaLabel: 'Repetir toda la playlist' },
      ] as const).map(({ mode, ariaLabel }) => (
        <button
          key={mode}
          onClick={() => onModeChange(playMode === mode ? 'off' : mode)}
          aria-label={ariaLabel}
          aria-pressed={playMode === mode}
          title={ariaLabel}
          className={`play-mode-button px-btn grid min-h-11 place-items-center rounded-md ${playMode === mode ? 'bg-crimson text-cream' : 'bg-panel-2 text-cream/70'}`}
        >
          <svg viewBox="0 0 32 32" className="play-mode-icon h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
            {mode === 'shuffle' && (
              <>
                <path d="M4 8h3c6 0 10 16 16 16h5M24 20l4 4-4 4M4 24h3c2 0 4-2 6-5M19 11c1.5-1.8 2.7-3 4-3h5M24 4l4 4-4 4" />
              </>
            )}
            {mode === 'repeat-one' && (
              <>
                <path d="M26 11a11 11 0 0 0-19-3L4 11M4 6v5h5M6 21a11 11 0 0 0 19 3l3-3m0 5v-5h-5" />
                <path d="M16 12v8m-2-6 2-2 2 2" />
              </>
            )}
            {mode === 'repeat-all' && (
              <>
                <path d="M6 12V9a3 3 0 0 1 3-3h15l-3-3m3 3-3 3M26 20v3a3 3 0 0 1-3 3H8l3 3m-3-3 3-3" />
                <path d="M4 16h24" />
              </>
            )}
          </svg>
        </button>
      ))}
    </div>
  )

  if (!song) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="grid h-24 w-24 place-items-center rounded-full border-4 border-blood font-pixel text-2xl text-blood">?</div>
        <p className="font-pixel text-[9px] leading-5 text-coral">ELIGE UNA CANCIÓN PARA PONER EL DISCO</p>
        <button onClick={onBrowse} className="px-btn bg-crimson px-4 py-4 text-cream">
          IR AL INICIO
        </button>
      </div>
    )
  }

  const progress = Math.min(100, Math.max(0, (time / song.duration) * 100))

  return (
    <div className="player-content flex flex-col px-3 pb-2">
      {playbackModes}
      <div className="player-tabs mb-2 grid grid-cols-2 gap-1.5" role="tablist">
        {(['DISCO', 'LETRAS'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => {
              setView(v)
              if (v === 'DISCO') onStop()
            }}
            className={`px-btn min-h-9 py-1.5 ${view === v ? 'bg-crimson text-cream' : 'bg-panel-2 text-cream/60'}`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'DISCO' ? (
        <div className="flex flex-col items-center">
          <div className="player-disc relative mt-1 aspect-square w-[min(210px,58vw,25dvh)]">
            <div
              className={`${playing ? 'spin-disc' : ''} absolute inset-0 rounded-full border-4 border-secondary`}
              style={{
                background:
                  'repeating-radial-gradient(circle, #0c1628 0 5px, #162644 5px 8px), conic-gradient(from 0deg, transparent 0 20%, rgba(255,117,71,.25) 25%, transparent 30% 70%, rgba(255,117,71,.25) 75%, transparent 80%)',
                backgroundBlendMode: 'normal',
                boxShadow: '8px 8px 0 0 var(--color-blood)',
              }}
            >
              <div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 0deg, transparent 0 20%, rgba(242,193,78,.2) 25%, transparent 30% 70%, rgba(242,193,78,.2) 75%, transparent 80%)' }} />
              <button
                type="button"
                onClick={onToggle}
                aria-label={playing ? 'Pausar canción' : 'Reanudar canción'}
                aria-pressed={playing}
                title={playing ? 'Pausar canción' : 'Reanudar canción'}
                className="absolute left-1/2 top-1/2 grid h-[44%] w-[44%] -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full border-4 border-crimson focus-visible:outline-2 focus-visible:outline-secondary"
              >
                <PixelCover seed={song.id} className="h-full w-full" />
              </button>
              <i className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
            </div>
            <div
              className="absolute -right-4 top-0 h-[60%] w-2 origin-top bg-secondary transition-transform duration-300"
              style={{ transform: `rotate(${playing ? 24 : 6}deg)`, transitionTimingFunction: 'steps(5)' }}
              aria-hidden
            >
              <i className="absolute -bottom-2 -left-1 h-4 w-5 bg-coral" />
            </div>
          </div>

          <div className="player-song-info mt-3 grid w-full grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
            <span aria-hidden />
            <div className="min-w-0 text-center">
              <h2 className="truncate font-pixel text-[13px] leading-[1.6] text-cream">{song.title}</h2>
              <p className="truncate text-2xl text-coral">{song.artist}</p>
            </div>
            <button
              onClick={() => onFav(song.id)}
              aria-pressed={song.fav}
              aria-label="Favorita"
              className="favorite-button grid h-10 w-10 place-items-center bg-transparent transition-transform active:scale-90"
            >
              <PixelHeart active={song.fav} className="h-6 w-6" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-box h-[330px] overflow-y-auto p-4" style={{ borderWidth: 3, boxShadow: '4px 4px 0 0 var(--color-blood)' }}>
          <p className="mb-3 font-pixel text-[8px] text-coral">
            {song.title} · {song.artist}
          </p>
          {lines ? (
            <ol className="space-y-3 py-6">
              {lines.map((l, i) => (
                <li
                  key={i}
                  ref={(el) => {
                    lineRefs.current[i] = el
                  }}
                  className={`text-2xl leading-6 ${i === lineIdx ? 'text-cream [text-shadow:2px_2px_0_var(--color-blood)]' : 'text-cream/30'}`}
                >
                  {i === lineIdx && <span className="mr-2 text-crimson">▶</span>}
                  {l}
                </li>
              ))}
            </ol>
          ) : (
            <div className="grid h-60 place-items-center text-center font-pixel text-[9px] leading-5 text-coral">
              ♪ SIN LETRA ♪
              <br />
              TEMA INSTRUMENTAL
            </div>
          )}
        </div>
      )}

      <div className="player-progress-section mt-2">
        <label className="sr-only" htmlFor="player-progress">Posición de reproducción</label>
        <input
          id="player-progress"
          type="range"
          min="0"
          max={song.duration}
          value={Math.min(time, song.duration)}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          aria-valuetext={`${fmt(time)} de ${fmt(song.duration)}`}
          className="player-progress"
          style={{
            background: `linear-gradient(to right, var(--color-crimson) 0%, var(--color-crimson) ${progress}%, var(--color-panel-2) ${progress}%, var(--color-panel-2) 100%) center / 100% 4px no-repeat`,
          }}
        />
        <div className="player-time mt-1 flex justify-between font-pixel text-[8px] text-coral">
          <span>{fmt(time)}</span>
          <span>{fmt(song.duration)}</span>
        </div>
      </div>

      <div className="player-controls mt-2 flex w-full items-center justify-center gap-2">
        <button onClick={onPrev} className="player-icon-button player-control-button grid h-11 w-11 place-items-center text-cream transition-colors hover:text-coral" aria-label="Anterior">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
            <path d="M5 5h3v14H5zm14 .5v13a1 1 0 0 1-1.5.86l-9-6.5a1 1 0 0 1 0-1.72l9-6.5A1 1 0 0 1 19 5.5Z" />
          </svg>
        </button>
        <button onClick={onToggle} className="player-main-control player-control-button grid h-12 w-12 place-items-center rounded-full border-[3px] border-ink bg-crimson text-cream shadow-[inset_-3px_-3px_0_rgba(0,0,0,0.35),inset_3px_3px_0_rgba(255,255,255,0.25)] transition-transform active:scale-95" aria-pressed={playing} aria-label={playing ? 'Pausar canción' : 'Reanudar canción'}>
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
              <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
              <path d="M6 4.8a1 1 0 0 1 1.52-.85l12 7.2a1 1 0 0 1 0 1.7l-12 7.2A1 1 0 0 1 6 19.2z" />
            </svg>
          )}
        </button>
        <button onClick={onNext} className="player-icon-button player-control-button grid h-11 w-11 place-items-center text-cream transition-colors hover:text-coral" aria-label="Siguiente">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
            <path d="M16 5h3v14h-3zM5 5.5v13a1 1 0 0 0 1.5.86l9-6.5a1 1 0 0 0 0-1.72l-9-6.5A1 1 0 0 0 5 5.5Z" />
          </svg>
        </button>
        <button
          onClick={() => {
            if (songAdded) return
            setJustAdded(true)
            onAddSong(song.id)
          }}
          disabled={songAdded}
          aria-label={songAdded ? 'Canción agregada al álbum' : 'Agregar canción al álbum'}
          title={songAdded ? 'Agregada al álbum' : 'Agregar al álbum'}
          className={`player-add-control player-icon-button player-control-button grid h-11 w-11 place-items-center transition-colors ${songAdded ? 'text-coral' : 'text-cream hover:text-coral'} ${justAdded ? 'library-save-success' : ''}`}
        >
          <PixelSaveIcon className="player-add-icon text-[#4f95f7]" />
        </button>
      </div>

    </div>
  )
}

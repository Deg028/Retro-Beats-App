import { useState } from 'react'
import { Song, fmt } from '../data'
import { Equalizer, PixelCover, PixelHeart } from './Pixel'

const SECTIONS = [
  { key: 'added', label: 'AGREGADAS' },
  { key: 'fav', label: 'FAVORITAS' },
  { key: 'top', label: 'TOP' },
  { key: 'recent', label: 'RECIENTES' },
] as const

type Props = {
  songs: Song[]
  currentId: number | null
  playing: boolean
  onPlay: (id: number) => void
  onFav: (id: number) => void
}

export default function Home({ songs, currentId, playing, onPlay, onFav }: Props) {
  const [section, setSection] = useState<(typeof SECTIONS)[number]['key']>('added')
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false)
  const added = songs.filter((s) => s.added)

  const list = {
    added: [...added].sort((a, b) => b.addedAt - a.addedAt),
    fav: added.filter((s) => s.fav),
    top: [...added].sort((a, b) => b.plays - a.plays).slice(0, 6),
    recent: added.filter((s) => s.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed),
  }[section]

  const empty = {
    added: 'SIN CANCIONES',
    fav: 'TOCA ♥ PARA GUARDAR FAVORITAS',
    top: 'AÚN NO HAY DATOS',
    recent: 'NADA ESCUCHADO TODAVÍA',
  }[section]

  return (
    <div className="px-4 pb-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            aria-label="Abrir secciones de inicio"
            aria-expanded={sectionMenuOpen}
            aria-controls="home-section-menu"
            onClick={() => setSectionMenuOpen((open) => !open)}
            className="grid h-9 w-9 place-items-center border-2 border-blood bg-panel-2 text-coral transition-colors hover:bg-crimson hover:text-cream focus-visible:outline-2 focus-visible:outline-coral"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-pixel text-[15px] leading-[1.6] text-cream">INICIO</h1>
          {sectionMenuOpen && (
            <div id="home-section-menu" className="home-section-menu absolute left-0 top-full z-30 mt-2 grid w-48 gap-1 border-[3px] border-secondary bg-panel p-2 shadow-[4px_4px_0_var(--color-blood)]">
              {SECTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={section === item.key}
                  onClick={() => {
                    setSection(item.key)
                    setSectionMenuOpen(false)
                  }}
                  className={`px-btn w-full px-3 py-2 text-left text-[7px] ${section === item.key ? 'bg-crimson text-cream' : 'bg-panel-2 text-cream/70'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Equalizer playing={playing} bars={7} h={36} />
      </div>

      <div className="px-box mb-5 flex items-center gap-3 p-3" style={{ boxShadow: '4px 4px 0 0 var(--color-blood)', borderWidth: 3 }}>
        <div className="flex-1">
          <p className="font-pixel text-[8px] text-coral">BIBLIOTECA</p>
          <p className="mt-2 font-pixel text-[11px] text-cream">{added.length} TEMAS</p>
        </div>
        <div className="flex-1">
          <p className="font-pixel text-[8px] text-coral">FAVORITAS</p>
          <p className="mt-2 flex items-center gap-2 font-pixel text-[11px] text-cream">
            {added.filter((s) => s.fav).length}
            <PixelHeart active className="h-4 w-4" />
          </p>
        </div>
        <button
          onClick={() => added.length && onPlay(list[0]?.id ?? added[0].id)}
          className="px-btn bg-crimson px-2 py-2 text-cream"
        >
          ▶ MIX
        </button>
      </div>

      <ul className="space-y-2">
        {list.length === 0 && (
          <li className="border-[3px] border-dashed border-blood p-5 text-center font-pixel text-[8px] leading-5 text-coral">{empty}</li>
        )}
        {list.map((s, i) => {
          const active = s.id === currentId
          return (
            <li
              key={s.id}
              className={`flex items-center gap-3 border-[3px] p-2 ${active ? 'border-coral bg-panel-2' : 'border-blood bg-panel'}`}
            >
              <span className="w-4 text-center font-pixel text-[8px] text-coral">{section === 'top' ? i + 1 : ''}</span>
              <button onClick={() => onPlay(s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Reproducir ${s.title}`}>
                <PixelCover seed={s.id} className="h-11 w-11 border-2 border-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-pixel text-[9px] leading-4 text-cream">{s.title}</span>
                  <span className="block truncate text-lg leading-4 text-coral">
                    {s.artist} · {section === 'top' ? `${s.plays} PLAYS` : fmt(s.duration)}
                  </span>
                </span>
                {active && <Equalizer playing={playing} bars={3} h={16} />}
              </button>
              <button
                onClick={() => onFav(s.id)}
                aria-pressed={s.fav}
                aria-label={`Favorita ${s.title}`}
                className="grid min-h-9 min-w-9 place-items-center"
              >
                <PixelHeart active={s.fav} className="h-5 w-5" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

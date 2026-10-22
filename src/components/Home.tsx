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
        <div>
          <h1 className="font-pixel text-[15px] leading-[1.6] text-cream">INICIO</h1>
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
          <p className="mt-2 font-pixel text-[11px] text-cream">{added.filter((s) => s.fav).length} ♥</p>
        </div>
        <button
          onClick={() => added.length && onPlay(list[0]?.id ?? added[0].id)}
          className="px-btn bg-crimson px-2 py-2 text-cream"
        >
          ▶ MIX
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={section === s.key}
            onClick={() => setSection(s.key)}
            className={`px-btn py-2 ${section === s.key ? 'bg-crimson text-cream' : 'bg-panel-2 text-cream/60'}`}
          >
            {s.label}
          </button>
        ))}
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

import { Song, fmt } from '../data'
import { PixelCover } from './Pixel'

type Props = {
  songs: Song[]
  currentId: number | null
  onPlay: (id: number) => void
}

export default function Album({ songs, currentId, onPlay }: Props) {
  const added = songs.filter((s) => s.added).sort((a, b) => b.addedAt - a.addedAt)
  const catalog = [...songs].sort((a, b) => Number(b.added) - Number(a.added) || b.addedAt - a.addedAt || a.id - b.id)
  const total = added.reduce((n, s) => n + s.duration, 0)

  return (
    <div className="px-4 pb-4">
      <div className="mb-4">
        <p className="font-pixel text-[8px] text-coral">TU BIBLIOTECA</p>
        <h1 className="mt-2 font-pixel text-[15px] leading-[1.6] text-cream">
          ÁLBUM <span className="text-crimson">▣</span>
        </h1>
        <p className="mt-1 text-xl text-cream/70">
          {added.length} agregadas · {fmt(total)} min
        </p>
      </div>

      <p className="mb-3 font-pixel text-[8px] text-coral">CATÁLOGO · TOCA PARA REPRODUCIR</p>
      <ul className="grid grid-cols-2 gap-3">
        {catalog.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onPlay(s.id)}
              className={`relative block w-full border-[3px] p-2 text-left ${s.id === currentId ? 'border-coral bg-panel-2' : 'border-blood bg-panel'}`}
              aria-label={`Reproducir ${s.title}${s.added ? '' : ', agregar desde el reproductor'}`}
            >
              <div className="relative">
                <PixelCover seed={s.id} className="aspect-square w-full border-2 border-secondary" />
                <span className={`absolute -left-1 -top-1 px-1 py-[2px] font-pixel text-[6px] ${s.added ? 'bg-panel-2 text-cream' : 'bg-crimson text-cream'}`}>
                  {s.added ? 'EN ÁLBUM' : '+ AGREGAR'}
                </span>
              </div>
              <span className="mt-2 block truncate font-pixel text-[8px] leading-4 text-cream">{s.title}</span>
              <span className="block truncate text-lg leading-4 text-coral">{s.artist} · {fmt(s.duration)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { Song, fmt } from '../data'
import { PixelCover } from './Pixel'

type Props = {
  songs: Song[]
  currentId: number | null
  onPlay: (id: number) => void
  onAdd: () => void
}

export default function Album({ songs, currentId, onPlay, onAdd }: Props) {
  const added = songs.filter((s) => s.added).sort((a, b) => b.addedAt - a.addedAt)
  const pending = songs.some((s) => !s.added)
  const total = added.reduce((n, s) => n + s.duration, 0)

  return (
    <div className="px-4 pb-4">
      <div className="mb-4">
        <p className="font-pixel text-[8px] text-coral">COLECCIÓN</p>
        <h1 className="mt-2 font-pixel text-[15px] leading-[1.6] text-cream">
          ÁLBUM <span className="text-crimson">▣</span>
        </h1>
        <p className="mt-1 text-xl text-cream/70">
          {added.length} canciones · {fmt(total)} min
        </p>
      </div>

      <button
        onClick={onAdd}
        disabled={!pending}
        className="px-btn mb-5 w-full bg-crimson py-3 text-cream disabled:bg-panel-2 disabled:text-cream/30"
      >
        {pending ? '+ AGREGAR CANCIÓN' : 'CATÁLOGO COMPLETO'}
      </button>

      <p className="mb-3 font-pixel text-[8px] text-coral">AGREGADAS RECIENTEMENTE</p>
      <ul className="grid grid-cols-2 gap-3">
        {added.map((s, i) => (
          <li key={s.id}>
            <button
              onClick={() => onPlay(s.id)}
              className={`block w-full border-[3px] p-2 text-left ${s.id === currentId ? 'border-coral bg-panel-2' : 'border-blood bg-panel'}`}
              aria-label={`Reproducir ${s.title}`}
            >
              <div className="relative">
                <PixelCover seed={s.id} className="aspect-square w-full border-2 border-secondary" />
                {i === 0 && <span className="absolute -left-1 -top-1 bg-crimson px-1 py-[2px] font-pixel text-[7px] text-cream">NEW</span>}
              </div>
              <span className="mt-2 block truncate font-pixel text-[8px] leading-4 text-cream">{s.title}</span>
              <span className="block truncate text-lg leading-4 text-coral">{s.artist}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useState } from "react"

import { Song, fmt } from "../data"

import { PixelCover, PixelSaveIcon } from "./Pixel"

type Props = {
  songs: Song[]

  currentId: number | null

  onPlay: (id: number) => void

  onAddSong: (id: number) => void
}

export default function Album({ songs, currentId, onPlay, onAddSong }: Props) {
  const [recentlyAdded, setRecentlyAdded] = useState<number[]>([])

  const added = songs
    .filter((s) => s.added)
    .sort((a, b) => b.addedAt - a.addedAt)

  const catalog = [...songs].sort(
    (a, b) =>
      Number(b.added) - Number(a.added) || b.addedAt - a.addedAt || a.id - b.id,
  )

  const total = added.reduce((n, s) => n + s.duration, 0)

  return (
    <div className="px-4 pb-4">
      <div className="mb-4">
        <p className="font-pixel text-[8px] text-coral">DESCUBRE MÚSICA</p>
        <h1 className="mt-2 font-pixel text-[15px] leading-[1.6] text-cream">
          CATÁLOGO <span className="text-crimson">▣</span>
        </h1>
        <p className="mt-1 text-xl text-cream/70">
          {added.length} en tu biblioteca · {fmt(total)} min
        </p>
      </div>

      <p className="mb-3 font-pixel text-[8px] text-coral">
        CATÁLOGO · TOCA PARA REPRODUCIR
      </p>
      <ul className="grid grid-cols-2 gap-3">
        {catalog.map((s) => (
          <li
            key={s.id}
            className={`border-[3px] p-2 ${
              s.id === currentId
                ? "border-coral bg-panel-2"
                : "border-blood bg-panel"
            }`}
          >
            <button
              onClick={() => onPlay(s.id)}
              className="block w-full text-left"
              aria-label={`Reproducir ${s.title}${
                s.added ? "" : ", agregar desde el reproductor"
              }`}
            >
              <div className="relative">
                <PixelCover
                  seed={s.id}
                  className="aspect-square w-full border-2 border-secondary"
                />
                <span
                  className={`absolute -left-1 -top-1 px-1 py-[2px] font-pixel text-[8px] ${
                    s.added ? "bg-panel-2 text-cream" : "bg-crimson text-cream"
                  }`}
                >
                  {s.added ? "EN BIBLIOTECA" : "+ NUEVA"}
                </span>
              </div>
              <span className="mt-2 block truncate font-pixel text-[8px] leading-4 text-cream">
                {s.title}
              </span>
              <span className="block truncate text-lg leading-4 text-coral">
                {s.artist} · {fmt(s.duration)}
              </span>
            </button>
            <button
              onClick={() => {
                if (s.added) return

                setRecentlyAdded((ids) => [...ids, s.id])

                onAddSong(s.id)
              }}
              disabled={s.added}
              aria-label={
                s.added
                  ? `${s.title} ya está en la biblioteca`
                  : `Guardar ${s.title} en la biblioteca`
              }
              title={
                s.added
                  ? "Ya está en la biblioteca"
                  : "Guardar en la biblioteca"
              }
              className={`px-btn mt-2 flex min-h-9 w-full items-center justify-center gap-2 border-2 px-2 py-1 ${
                s.added
                  ? "cursor-default bg-panel-2 text-cream/50"
                  : "bg-panel-2 text-cream hover:text-coral"
              } ${recentlyAdded.includes(s.id) ? "library-save-success" : ""}`}
            >
              <PixelSaveIcon className="h-5 w-5 shrink-0 text-[#4f95f7]" />
              <span className="font-pixel text-[8px]">
                {s.added ? "EN BIBLIOTECA" : "GUARDAR"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

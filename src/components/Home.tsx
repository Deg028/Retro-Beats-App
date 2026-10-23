import { useEffect, useRef } from "react"

import { Song, fmt } from "../data"

import { Equalizer, PixelCover, PixelHeart } from "./Pixel"

export const SECTIONS = [
  { key: "added", label: "AGREGADAS" },

  { key: "fav", label: "FAVORITAS" },

  { key: "top", label: "TOP" },

  { key: "recent", label: "RECIENTES" },
] as const

export type HomeSection = typeof SECTIONS[number]["key"]

type Props = {
  songs: Song[]

  currentId: number | null

  playing: boolean

  onPlay: (id: number) => void

  onFav: (id: number) => void

  onMix: () => void

  section: HomeSection

  onOpenMenu: () => void

  menuOpen: boolean
}

export default function Home({
  songs,

  currentId,

  playing,

  onPlay,

  onFav,

  onMix,

  section,

  onOpenMenu,

  menuOpen,
}: Props) {
  const added = songs.filter((s) => s.added)

  const list = {
    added: [...added].sort((a, b) => b.addedAt - a.addedAt),

    fav: added.filter((s) => s.fav),

    top: [...added].sort((a, b) => b.plays - a.plays).slice(0, 6),

    recent: added

      .filter((s) => s.lastPlayed > 0)

      .sort((a, b) => b.lastPlayed - a.lastPlayed),
  }[section]

  const empty = {
    added: "SIN CANCIONES",

    fav: "TOCA ♥ PARA GUARDAR FAVORITAS",

    top: "AÚN NO HAY DATOS",

    recent: "NADA ESCUCHADO TODAVÍA",
  }[section]

  return (
    <div className="px-4 pb-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            aria-label="Abrir secciones de inicio"
            aria-expanded={menuOpen}
            aria-controls="home-drawer"
            onClick={onOpenMenu}
            className="grid h-9 w-9 place-items-center border-2 border-blood bg-panel-2 text-coral transition-colors hover:bg-crimson hover:text-cream focus-visible:outline-2 focus-visible:outline-coral"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-pixel text-[15px] leading-[1.6] text-cream">
            INICIO
          </h1>
        </div>
        <Equalizer playing={playing} bars={7} h={36} />
      </div>

      <div
        className="px-box mb-5 flex items-center gap-3 p-3"
        style={{ boxShadow: "4px 4px 0 0 var(--color-blood)", borderWidth: 3 }}
      >
        <div className="flex-1">
          <p className="font-pixel text-[8px] text-coral">BIBLIOTECA</p>
          <p className="mt-2 font-pixel text-[11px] text-cream">
            {added.length} TEMAS
          </p>
        </div>
        <div className="flex-1">
          <p className="font-pixel text-[8px] text-coral">FAVORITAS</p>
          <p className="mt-2 flex items-center gap-2 font-pixel text-[11px] text-cream">
            {added.filter((s) => s.fav).length}
            <PixelHeart active className="h-4 w-4" />
          </p>
        </div>
        <button
          onClick={onMix}
          disabled={!added.length}
          aria-label="Reproducir biblioteca en orden aleatorio"
          className="px-btn bg-crimson px-2 py-2 text-cream disabled:opacity-40"
        >
          ⤮ MIX
        </button>
      </div>

      <ul className="space-y-2">
        {list.length === 0 && (
          <li className="border-[3px] border-dashed border-blood p-5 text-center font-pixel text-[8px] leading-5 text-coral">
            {empty}
          </li>
        )}
        {list.map((s, i) => {
          const active = s.id === currentId

          return (
            <li
              key={s.id}
              className={`flex items-center gap-3 border-[3px] p-2 ${
                active ? "border-coral bg-panel-2" : "border-blood bg-panel"
              }`}
            >
              <span className="w-4 text-center font-pixel text-[8px] text-coral">
                {section === "top" ? i + 1 : ""}
              </span>
              <button
                onClick={() => onPlay(s.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                aria-label={`Reproducir ${s.title}`}
              >
                <PixelCover
                  seed={s.id}
                  className="h-11 w-11 border-2 border-secondary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-pixel text-[9px] leading-4 text-cream">
                    {s.title}
                  </span>
                  <span className="block truncate text-lg leading-4 text-coral">
                    {s.artist} ·{" "}
                    {section === "top" ? `${s.plays} PLAYS` : fmt(s.duration)}
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

type MenuProps = {
  songs: Song[]

  section: HomeSection

  open: boolean

  onSelect: (section: HomeSection) => void

  onClose: () => void
}

export function HomeMenu({
  songs,
  section,
  open,
  onSelect,
  onClose,
}: MenuProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  const added = songs.filter((s) => s.added)

  const counts: Record<HomeSection, number> = {
    added: added.length,

    fav: added.filter((s) => s.fav).length,

    top: Math.min(6, added.length),

    recent: added.filter((s) => s.lastPlayed > 0).length,
  }

  useEffect(() => {
    if (!open) return

    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()

    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <div
      className={`home-drawer ${open ? "is-open" : ""}`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="home-drawer-backdrop" onClick={onClose} />
      <aside
        id="home-drawer"
        className="home-drawer-panel"
        aria-label="Secciones de inicio"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="font-pixel text-[10px] text-secondary">SECCIONES</p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar secciones"
            className="grid h-9 w-9 place-items-center border-2 border-blood bg-panel-2 text-coral hover:bg-crimson hover:text-cream focus-visible:outline-2 focus-visible:outline-coral"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>
        <nav className="grid gap-2">
          {SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={section === item.key}
              onClick={() => onSelect(item.key)}
              className={`px-btn flex w-full items-center justify-between px-3 py-3 text-left text-[9px] ${
                section === item.key
                  ? "bg-crimson text-cream"
                  : "bg-panel-2 text-cream/70"
              }`}
            >
              <span>{item.label}</span>
              <span className="text-coral">{counts[item.key]}</span>
            </button>
          ))}
        </nav>
      </aside>
    </div>
  )
}

import TRACKS from "./tracks.json"

export type LyricLine = { t: number; text: string }

export type Song = {
  id: number
  title: string
  artist: string
  /** Seconds, derived from the track's tempo and length so the UI knows it before the file loads */
  duration: number
  lyrics?: LyricLine[]
  plays: number
  fav: boolean
  lastPlayed: number
  addedAt: number
  added: boolean
}

export const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

export const AUDIO: Record<number, number> = {
  1: require("../assets/audio/track-01.wav"),
  2: require("../assets/audio/track-02.wav"),
  3: require("../assets/audio/track-03.wav"),
  4: require("../assets/audio/track-04.wav"),
  5: require("../assets/audio/track-05.wav"),
  6: require("../assets/audio/track-06.wav"),
  7: require("../assets/audio/track-07.wav"),
  8: require("../assets/audio/track-08.wav"),
  9: require("../assets/audio/track-09.wav"),
  10: require("../assets/audio/track-10.wav"),
  11: require("../assets/audio/track-11.wav"),
}

const barSeconds = (id: number) => 240 / (TRACKS.find((t) => t.id === id)?.bpm ?? 120)
const durationOf = (id: number) => {
  const t = TRACKS.find((x) => x.id === id)
  return t ? (t.bars * 240) / t.bpm : 0
}

/** The lead melody enters after a 4-bar intro; each lyric line spans 2 bars. */
const timed = (id: number, lines: string[]): LyricLine[] =>
  lines.map((text, i) => ({ t: (4 + i * 2) * barSeconds(id), text }))

type Base = Omit<Song, "duration" | "lyrics"> & { lyrics?: string[] }

const BASE: Base[] = [
  {
    id: 1,
    title: "Neon Cassette",
    artist: "NOVA_8",
    lyrics: [
      "Luces rojas sobre el asfalto",
      "la cinta gira sin parar",
      "cuarto de moneda en el bolsillo",
      "la noche empieza a cargar",
      "Corre, corre, nivel final",
      "el eco del bajo es mi radar",
      "si el reloj se acaba aquí",
      "dame una vida más para volar",
    ],
    plays: 42,
    fav: true,
    lastPlayed: 12,
    addedAt: 1,
    added: true,
  },
  {
    id: 2,
    title: "Game Over Blues",
    artist: "PIXELPAZ",
    lyrics: [
      "Perdí en el jefe del castillo",
      "pero el corazón sigue en pie",
      "una pantalla negra y un suspiro",
      "dime si vuelvo a empezar",
      "Continuar... tres, dos, uno",
      "no pienso rendirme hoy",
    ],
    plays: 31,
    fav: false,
    lastPlayed: 11,
    addedAt: 2,
    added: true,
  },
  { id: 3, title: "Crimson Arcade", artist: "DJ_CHIP", plays: 57, fav: true, lastPlayed: 10, addedAt: 3, added: true },
  {
    id: 4,
    title: "Pixel Rain",
    artist: "NOVA_8",
    lyrics: ["Llueve en ocho bits", "cada gota es un cuadrito", "rojo sobre la ciudad", "y yo bailando en el borde"],
    plays: 19,
    fav: false,
    lastPlayed: 0,
    addedAt: 4,
    added: true,
  },
  { id: 5, title: "Turbo Heart", artist: "LADY_BIT", plays: 64, fav: true, lastPlayed: 9, addedAt: 5, added: true },
  { id: 6, title: "Bossfight 03", artist: "PIXELPAZ", plays: 12, fav: false, lastPlayed: 0, addedAt: 6, added: true },
  { id: 7, title: "Insert Coin", artist: "DJ_CHIP", plays: 8, fav: false, lastPlayed: 8, addedAt: 7, added: true },
  { id: 8, title: "Sunset Cartridge", artist: "LADY_BIT", plays: 25, fav: false, lastPlayed: 0, addedAt: 8, added: true },
  { id: 9, title: "Level Up", artist: "NOVA_8", plays: 0, fav: false, lastPlayed: 0, addedAt: 0, added: false },
  { id: 10, title: "Joystick Lullaby", artist: "LADY_BIT", plays: 0, fav: false, lastPlayed: 0, addedAt: 0, added: false },
  { id: 11, title: "Retro Rush", artist: "DJ_CHIP", plays: 0, fav: false, lastPlayed: 0, addedAt: 0, added: false },
]

export const INITIAL_SONGS: Song[] = BASE.map(({ lyrics, ...s }) => ({
  ...s,
  duration: durationOf(s.id),
  lyrics: lyrics && timed(s.id, lyrics),
}))

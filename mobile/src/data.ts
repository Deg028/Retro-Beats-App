export type Song = {
  id: number
  title: string
  artist: string
  duration: number
  lyrics?: string[]
  plays: number
  fav: boolean
  lastPlayed: number
  addedAt: number
  added: boolean
}

export const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

export const INITIAL_SONGS: Song[] = [
  {
    id: 1,
    title: "Neon Cassette",
    artist: "NOVA_8",
    duration: 168,
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
    duration: 143,
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
  {
    id: 3,
    title: "Crimson Arcade",
    artist: "DJ_CHIP",
    duration: 201,
    plays: 57,
    fav: true,
    lastPlayed: 10,
    addedAt: 3,
    added: true,
  },
  {
    id: 4,
    title: "Pixel Rain",
    artist: "NOVA_8",
    duration: 187,
    lyrics: [
      "Llueve en ocho bits",
      "cada gota es un cuadrito",
      "rojo sobre la ciudad",
      "y yo bailando en el borde",
    ],
    plays: 19,
    fav: false,
    lastPlayed: 0,
    addedAt: 4,
    added: true,
  },
  {
    id: 5,
    title: "Turbo Heart",
    artist: "LADY_BIT",
    duration: 156,
    plays: 64,
    fav: true,
    lastPlayed: 9,
    addedAt: 5,
    added: true,
  },
  {
    id: 6,
    title: "Bossfight 03",
    artist: "PIXELPAZ",
    duration: 232,
    plays: 12,
    fav: false,
    lastPlayed: 0,
    addedAt: 6,
    added: true,
  },
  {
    id: 7,
    title: "Insert Coin",
    artist: "DJ_CHIP",
    duration: 124,
    plays: 8,
    fav: false,
    lastPlayed: 8,
    addedAt: 7,
    added: true,
  },
  {
    id: 8,
    title: "Sunset Cartridge",
    artist: "LADY_BIT",
    duration: 215,
    plays: 25,
    fav: false,
    lastPlayed: 0,
    addedAt: 8,
    added: true,
  },
  {
    id: 9,
    title: "Level Up",
    artist: "NOVA_8",
    duration: 98,
    plays: 0,
    fav: false,
    lastPlayed: 0,
    addedAt: 0,
    added: false,
  },
  {
    id: 10,
    title: "Joystick Lullaby",
    artist: "LADY_BIT",
    duration: 176,
    plays: 0,
    fav: false,
    lastPlayed: 0,
    addedAt: 0,
    added: false,
  },
  {
    id: 11,
    title: "Retro Rush",
    artist: "DJ_CHIP",
    duration: 189,
    plays: 0,
    fav: false,
    lastPlayed: 0,
    addedAt: 0,
    added: false,
  },
]

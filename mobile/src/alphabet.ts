// The A-Z index of the library: which letter each title goes under, and the songs in that order. No screens in here.

import { normalize } from "./library/names"

/** Songs whose title starts in Japanese go under this kanji («wa», Japanese, as in 和楽 Japanese music) */
export const JAPANESE = "和"
export const OTHER = "#"

const HAS_JAPANESE = /[぀-ヿ㐀-鿿]/

/** Whether the title or the artist is written in Japanese (the row gets the kanji too) */
export const isJapanese = (s: { title: string; artist: string }) => HAS_JAPANESE.test(s.title) || HAS_JAPANESE.test(s.artist)

/** The letter of the index a title goes under: A-Z, «和» for Japanese, «#» for digits and anything else */
export function letterOf(title: string): string {
  const first = title.trim().replace(/^[^\p{L}\p{N}]+/u, "")[0] ?? ""
  if (HAS_JAPANESE.test(first)) return JAPANESE
  const n = normalize(first)[0] ?? ""
  if (n >= "a" && n <= "z") return n.toUpperCase()
  if (n === "ñ") return "N"
  return OTHER
}

export type Group<T> = { letter: string; songs: T[] }

/** Songs sorted by title, split by letter: A to Z, then «和», then «#» */
export function groupByLetter<T extends { title: string }>(songs: T[]): Group<T>[] {
  const by = new Map<string, T[]>()
  for (const s of songs) {
    const l = letterOf(s.title)
    const list = by.get(l)
    if (list) list.push(s)
    else by.set(l, [s])
  }
  const order = (l: string) => (l === JAPANESE ? 1000 : l === OTHER ? 1001 : l.charCodeAt(0))
  return [...by.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([letter, list]) => ({ letter, songs: list.sort((a, b) => normalize(a.title).localeCompare(normalize(b.title)) || a.title.localeCompare(b.title)) }))
}

import type { LyricLine } from "../data"
import { splitLyrics } from "./lrclib"

export type Reliability = "alta" | "media" | "baja"

export type SharedLyricsCheck =
  | { ok: false; reason: string }
  | {
      ok: true
      /** The text to save: links and site leftovers removed */
      text: string
      timed: boolean
      lines: number
      level: Reliability
      notes: string[]
      preview: string[]
    }

const URL_ROW = /^\s*(?:https?:\/\/|www\.)\S+\s*$/i
// Lines sites add around the words when text is shared or copied
const LEFTOVER_ROW = /^(?:you might also like|see .* live|get tickets|embed|\d*\s*embed|share|copy link|\d+ contributors?|lyrics?)$/i

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** Words of a title worth looking for in the lyrics: no tags like "cover" or "remix", nothing short. */
const titleWords = (title: string) =>
  title
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4 && !/^(?:cover|remix|remake|extended|version|official|video|audio|full|feat)$/.test(w))

/**
 * Looks at text shared from another app before it becomes the lyrics of a song, and says how far it can be trusted
 * to be the right words for that recording. A link alone is refused; timed text is compared with the song's length;
 * plain text can only be judged by its size and by the words of the title.
 */
export function checkSharedLyrics(raw: string, song: { title: string; duration: number }): SharedLyricsCheck {
  const rows = raw.replace(/\r\n?/g, "\n").split("\n")
  const hadLink = rows.some((r) => URL_ROW.test(r))
  const cleaned = rows.filter((r) => !URL_ROW.test(r) && !LEFTOVER_ROW.test(r.trim()))
  const text = cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim()
  const { synced, plain } = splitLyrics(text)
  const lines = (synced ? synced.length : plain.split("\n").filter((r) => r.trim()).length)

  if (!plain.replace(/\s+/g, "") || (hadLink && lines < 4)) {
    return {
      ok: false,
      reason: hadLink
        ? "Lo que llegó es un enlace, no la letra. Abre la página, selecciona la letra, y compártela o cópiala desde ahí."
        : "No hay texto de letra en lo que se compartió.",
    }
  }
  if (lines < 4) return { ok: false, reason: "Es muy corto para ser la letra de una canción (menos de 4 líneas)." }

  const notes: string[] = []
  let level: Reliability = "alta"
  const lower = (to: Reliability) => {
    if (level === "alta" || to === "baja") level = to
  }

  if (synced) {
    const last = synced.reduce((m: number, l: LyricLine) => Math.max(m, l.t), 0)
    if (song.duration > 0) {
      const ratio = last / song.duration
      if (ratio > 1.03) {
        lower("baja")
        notes.push(`Los tiempos llegan a ${mmss(last)} y la canción dura ${mmss(song.duration)}: parece otra versión.`)
      } else if (ratio < 0.5) {
        lower("baja")
        notes.push(`La letra acaba en ${mmss(last)} de ${mmss(song.duration)}: parece incompleta o de otra versión.`)
      } else if (ratio < 0.75) {
        lower("media")
        notes.push(`La última línea está en ${mmss(last)} de ${mmss(song.duration)} (puede ser un final instrumental).`)
      } else notes.push(`Los tiempos cuadran con la duración (${mmss(last)} de ${mmss(song.duration)}).`)
    } else {
      lower("media")
      notes.push("Se desconoce la duración de la canción, así que no se pudo comparar con los tiempos.")
    }
  } else {
    lower("media")
    notes.push("Sin tiempos: se mostrará completa y se podrá sincronizar con − y +, o buscar su versión con tiempos.")
    if (lines < 8) {
      lower("baja")
      notes.push(`Solo tiene ${lines} líneas.`)
    }
  }

  const words = titleWords(song.title)
  if (words.length && !words.some((w) => text.toLowerCase().includes(w))) {
    lower("media")
    notes.push("Ninguna palabra del título aparece en la letra (puede ser normal).")
  }

  return { ok: true, text, timed: !!synced, lines, level, notes, preview: plain.split("\n").filter((r) => r.trim()).slice(0, 6) }
}

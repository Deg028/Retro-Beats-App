import type { Lyrics } from "./lrclib"

/**
 * The one place that decides which lyrics win. Every way of saving lyrics goes through `canReplace`, so a change
 * somewhere else cannot make better lyrics (timed ones, the person's own) be replaced by worse ones again.
 * Pure on purpose: `scripts/test-lyrics.ts` runs these rules before every build.
 */

/** Where saved lyrics came from */
export type LyricsSource =
  /** pasted, shared or imported by the person */
  | "manual"
  /** a lyrics file beside the song that is the person's (by hand, or aligned with Whisper), not SnapTube's */
  | "file"
  /** LRCLIB, NetEase or lyrics.ovh */
  | "web"
  /** SnapTube's `_private.lrc` beside the song: plain words, or YouTube's automatic captions */
  | "snaptube"
  /** saved inside the MP3 (USLT), often YouTube's automatic captions */
  | "embedded"
  /** plain words with times spread over the song, made up by the app */
  | "estimated"

export type Quality = { source: LyricsSource; synced: boolean }

/** Higher wins. Timed lyrics from the internet beat anything not the person's; untimed words never beat timed ones. */
export function rank({ source, synced }: Quality): number {
  switch (source) {
    case "manual":
    case "file":
      return synced ? 201 : 200
    case "web":
      return synced ? 120 : 60
    case "snaptube":
    case "embedded":
      return synced ? 90 : 40
    case "estimated":
      return 5
  }
}

/** The person's own lyrics: automatic searches never replace them */
export const isOwn = (source: LyricsSource | undefined) => source === "manual" || source === "file"

/** SnapTube writes `<name>_private.lrc` beside its downloads; that is not a file the person made */
export const isSnaptubeFile = (uri: string) => /_private\.lrc$/i.test(uri)

/** What an entry saved before sources were recorded came from, read from what it kept. */
export function inferSource(entry: { manualLyrics?: boolean; lyricsFile?: string; embeddedLyricsAt?: number; lyricsFor?: number } | undefined, stored?: Pick<Lyrics, "estimated"> | null): LyricsSource {
  if (stored?.estimated) return "estimated"
  if (entry?.manualLyrics) return entry.lyricsFile && isSnaptubeFile(entry.lyricsFile) ? "snaptube" : entry.lyricsFile ? "file" : "manual"
  if (entry?.embeddedLyricsAt && !entry.lyricsFor) return "embedded"
  return "web"
}

/**
 * May `incoming` take the place of what is saved? `explicit` is the person pressing «Sincronizar»: then timed lyrics may
 * also replace untimed ones of their own (the previous ones are kept for «Restaurar»); timed lyrics are never replaced by untimed.
 */
export function canReplace(current: Quality | null, incoming: Quality, explicit = false): boolean {
  if (incoming.source === "manual") return true
  if (!current) return true
  // Guessed times only ever fill in untimed words that are not the person's (or refresh other guesses)
  if (incoming.source === "estimated") return current.source === "estimated" || (!current.synced && !isOwn(current.source))
  if (explicit && incoming.synced && !current.synced) return true
  return rank(incoming) >= rank(current)
}

/** Replacing real timed lyrics: the old ones are worth keeping a copy of */
export const worthBackingUp = (current: Quality | null) => !!current && current.synced && current.source !== "estimated"

// --- what to look up ---

const WEEK = 7 * 24 * 3600 * 1000
/** Bumped when lyrics are prepared differently (2: files with the original, romanisation and translation keep the original) */
export const LYRICS_V = 2
/** Bumped when a new source is added, so earlier misses are tried again at once */
export const SOURCES_V = 4

type Looked = {
  lyricsAt?: number
  coverAt?: number
  lyrics?: boolean
  lyricsFor?: number
  lyricsV?: number
  lyricsSynced?: boolean
  syncTriedAt?: number
  cover?: string | null
  thumb?: string | null
  embedded?: string | null
  srcV?: number
  manualLyrics?: boolean
}

/** A part is looked up if it never was, or if it was and came back empty more than a week ago. Whatever was found stays. */
export function needs(entry: Looked | undefined, part: "lyrics" | "cover", now = Date.now()) {
  const at = part === "lyrics" ? entry?.lyricsAt : entry?.coverAt
  const found = part === "lyrics" ? entry?.lyrics === true : typeof entry?.cover === "string"
  return !at || (!found && (now - at > WEEK || (entry?.srcV ?? 1) < SOURCES_V))
}

/**
 * What to look up for a song. Lyrics wait until the song's length is known: timings only fit the recording
 * they were made for. The person's own lyrics are never searched automatically, but «Sincronizar» (`force`) always searches:
 * `canReplace` then decides whether what it finds may replace them.
 */
export function wanted(song: { duration: number }, entry: Looked | undefined, force = false, now = Date.now()) {
  const cover = !force && typeof entry?.thumb !== "string" && typeof entry?.embedded !== "string" && needs(entry, "cover", now)
  const redo = entry?.lyrics === true && !entry.lyricsFor
  // Only plain words were found: a timed version may have been added since, so it is looked for again now and then
  const upgrade = entry?.lyrics === true && entry.lyricsSynced === false && (!entry.syncTriedAt || now - entry.syncTriedAt > WEEK)
  const stale = entry?.lyrics === true && (entry.lyricsV ?? 1) < LYRICS_V
  if (entry?.manualLyrics && !force) return { lyrics: false, cover }
  return { lyrics: song.duration > 0 && (force || needs(entry, "lyrics", now) || redo || upgrade || stale), cover }
}

// --- review of what is saved ---

export type Verdict = "ok" | "none" | "plain" | "estimated" | "suspect"
export type Review = { verdict: Verdict; reasons: string[] }

// What YouTube's automatic captions write when nothing is sung, and credits that are not lyrics
const FILLER = /^[\s♪♫\[\]()]*(?:music|musica|música|applause|aplausos|so|heat|oh|ah|yeah|instrumental|este es contenido generado.*)[\s.!♪♫\[\]()]*$/i

/** Looks at saved lyrics and says whether they can be trusted to follow the song. */
export function reviewLyrics(entry: { lyrics?: boolean } | undefined, lyrics: Lyrics | null | undefined, songSeconds: number, source?: LyricsSource): Review {
  if (!entry?.lyrics || !lyrics) return { verdict: "none", reasons: [] }
  if (lyrics.estimated || source === "estimated") return { verdict: "estimated", reasons: ["Los tiempos son aproximados"] }
  const lines = lyrics.synced ?? []
  if (!lines.length) return { verdict: "plain", reasons: ["Sin tiempos"] }
  const reasons: string[] = []
  const text = lines.map((l) => l.text.trim()).filter(Boolean)
  if (text.length && text.filter((t) => FILLER.test(t)).length / text.length > 0.4) reasons.push("Subtítulos automáticos de YouTube o relleno")
  if (new Set(text.map((t) => t.toLowerCase())).size <= 3) reasons.push("Casi no tiene líneas distintas")
  if (songSeconds > 0) {
    const last = lines[lines.length - 1].t
    const first = lines[0].t
    if (last > songSeconds * 1.03 + 3) reasons.push("Termina después de que acaba la canción")
    if (first > songSeconds * 0.5) reasons.push("Empieza muy tarde")
    if (lines.length > 3 && last - first < songSeconds * 0.3) reasons.push("Cubre muy poco de la canción")
    if (lyrics.duration && Math.abs(lyrics.duration - songSeconds) > 12) reasons.push("Hecha para una versión de otra duración")
  }
  return { verdict: reasons.length ? "suspect" : "ok", reasons }
}

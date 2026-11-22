import type { LyricLine } from "../data"

/**
 * Lyrics that are only the romanised reading («massugu korogatte») get their Japanese lines back: the Japanese text is
 * found by the song's Japanese file name, and put on the times the person's lyrics already have, with their reading
 * kept under each line. Pure on purpose: `scripts/test-lyrics.ts` checks it.
 */

const HAS_JAPANESE = /[぀-ヿ㐀-鿿]/
// One syllable of Hepburn romaji (long vowels may carry a macron), a syllabic n, or a doubled consonant before a syllable
const SYLLABLE = "(?:(?:[kgsztdnhbpmr]y|ch|sh|ts|[kgsztdnhbpmryw]|f|j)?[aiueoāīūēō]|n)"
const ROMAJI_WORD = new RegExp(`^(?:([kstpgdbzjfmr])(?=\\1)|${SYLLABLE})+$`)

/**
 * Whether the lines are Japanese written in Latin letters. Almost every word has to be built from Japanese syllables,
 * which English lyrics are not (their words «the», «will», «always» fail), and there has to be enough text to tell.
 */
export function looksLikeRomaji(lines: string[]): boolean {
  // A stray kanji or two left in a reading is allowed; lyrics that are mostly Japanese are not romaji
  const latin = lines.filter((l) => !HAS_JAPANESE.test(l))
  if (latin.length < lines.length * 0.9) return false
  const words = latin.join(" ")
    .toLowerCase()
    .split(/[^a-zāīūēō']+/)
    .map((w) => w.replace(/'/g, ""))
    .filter(Boolean)
  if (words.length < 40) return false
  return words.filter((w) => ROMAJI_WORD.test(w)).length / words.length >= 0.9
}

/**
 * The parts of a file name that are written in Japanese, to search for the song's Japanese lyrics:
 * «イレギュラーマン_重音テトSV(MP3_320K).mp3» gives «イレギュラーマン» and «重音テトSV».
 */
export function japaneseSegments(file: string | undefined): string[] {
  if (!file) return []
  const bare = file.replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/\s*[(\[]?(?:mp3|m4a|mp4|webm|opus)(?:[_ ]?\d{2,3}k)?[)\]]?\s*$/i, "")
  const parts = bare
    .split(/\s*[_|｜\-–/]\s*|\s+[-–]\s+|[()（）\[\]【】「」]/)
    .map((p) => p.trim())
    .filter((p) => p && HAS_JAPANESE.test(p))
  return [...new Set(parts)].slice(0, 4)
}

/** Lines that have text (empty ones are only gaps) */
const sung = (lines: LyricLine[]) => lines.filter((l) => l.text.trim())

/**
 * Puts the Japanese lines on the person's romaji lines. With the same number of lines they go one to one; otherwise
 * (only when both are timed for the same recording) each Japanese line takes the nearest romaji line within 4 seconds,
 * in order, and nearly all of both have to find a partner. Returns null when they do not fit, so nothing is changed.
 * `synced` keeps the person's times and has the Japanese text; `romaji` keeps their reading, line for line.
 */
export function mergeJapanese(romaji: LyricLine[], japanese: LyricLine[], songSeconds: number, japaneseSeconds: number): { synced: LyricLine[]; romaji: string[] } | null {
  const r = sung(romaji)
  const j = sung(japanese)
  if (!r.length || !j.length) return null
  if (r.length === j.length) return { synced: r.map((line, i) => ({ t: line.t, text: j[i].text })), romaji: r.map((line) => line.text) }
  if (!(songSeconds > 0 && japaneseSeconds > 0) || Math.abs(songSeconds - japaneseSeconds) > 4) return null
  const pairs: [number, number][] = []
  let from = 0
  for (let k = 0; k < j.length; k++) {
    let best = -1
    for (let i = from; i < r.length; i++) {
      const gap = Math.abs(r[i].t - j[k].t)
      if (gap <= 4 && (best < 0 || gap < Math.abs(r[best].t - j[k].t))) best = i
      if (r[i].t > j[k].t + 4) break
    }
    if (best >= 0) {
      pairs.push([best, k])
      from = best + 1
    }
  }
  if (pairs.length < Math.ceil(j.length * 0.9) || pairs.length < Math.ceil(r.length * 0.9)) return null
  return { synced: pairs.map(([i, k]) => ({ t: r[i].t, text: j[k].text })), romaji: pairs.map(([i]) => r[i].text) }
}

/**
 * One line written in Latin letters that reads as romaji: nearly all its words built from Japanese syllables, and at
 * least two words or one of 4 letters or more («shoumonai» under «しょうもない»)
 */
function isRomajiLine(text: string): boolean {
  if (HAS_JAPANESE.test(text)) return false
  const words = text
    .toLowerCase()
    .split(/[^a-zāīūēō']+/)
    .map((w) => w.replace(/'/g, ""))
    .filter(Boolean)
  if (words.length === 1) return words[0].length >= 4 && ROMAJI_WORD.test(words[0])
  return words.length >= 2 && words.filter((w) => ROMAJI_WORD.test(w)).length / words.length >= 0.9
}

/** The same Latin line twice («NaNaNaNaNa», then its «romaji» «NaNaNaNaNa») */
const sameLatin = (a: string | undefined, b: string | undefined) =>
  a !== undefined && b !== undefined && !!a.trim() && !HAS_JAPANESE.test(a) && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Lyrics that come with the Japanese and its romaji as separate lines, one after the other (a Japanese line, then its
 * romaji line, or the other way round). The romaji lines are folded into readings of the Japanese lines, so each line
 * is shown once with its reading under it, the way the app shows readings it makes itself. `keep` says which lines
 * stay (the others were readings) and `reading` is the reading of each kept line, "" where it has none. Returns null
 * unless at least half of the Japanese lines have such a partner (a source may skip a reading here and there), so lyrics with an English translation or none are left alone.
 * In such lyrics a Latin line followed by the same line is the line and its «romaji»: the copy goes.
 * `readings` are the readings the lines already have (lyrics folded by an older version, which missed one-word readings):
 * lines that have one are not paired again, but count towards the half, so what was missed is folded now.
 */
export function foldRomaji(texts: string[], readings?: string[]): { keep: number[]; reading: string[] } | null {
  const japanese = texts.filter((t) => HAS_JAPANESE.test(t)).length
  if (japanese < 4) return null
  const had = readings?.length === texts.length ? readings : undefined
  const read = texts.filter((t, i) => HAS_JAPANESE.test(t) && had?.[i]).length
  const pair = (romajiFirst: boolean) => {
    const consumed = new Set<number>()
    const readingOf = new Map<number, string>()
    texts.forEach((text, i) => {
      if (!HAS_JAPANESE.test(text) || had?.[i]) return
      const partner = romajiFirst ? i - 1 : i + 1
      const other = texts[partner]
      if (other !== undefined && isRomajiLine(other) && !consumed.has(partner)) {
        consumed.add(partner)
        readingOf.set(i, other)
      }
    })
    return { consumed, readingOf }
  }
  // The way the lines really go pairs the most Japanese lines (the other way pairs each with its neighbour's reading, one short)
  const after = pair(false)
  const before = pair(true)
  const { consumed, readingOf } = before.readingOf.size > after.readingOf.size ? before : after
  if (!readingOf.size || readingOf.size + read < 4 || readingOf.size + read < Math.ceil(japanese * 0.5)) return null
  texts.forEach((text, i) => {
    if (!consumed.has(i) && !consumed.has(i + 1) && sameLatin(text, texts[i + 1])) consumed.add(i + 1)
  })
  const keep = texts.map((_, i) => i).filter((i) => !consumed.has(i))
  return { keep, reading: keep.map((i) => readingOf.get(i) ?? had?.[i] ?? "") }
}

/** A reading spelt loosely, to compare two spellings of the same sound: no accents, no spaces, long vowels short, «wo» as «o» */
function skeleton(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "")
    .replace(/ou/g, "o")
    .replace(/([aiueo])\1+/g, "$1")
    .replace(/wo/g, "o")
}

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

/** 1 for the same sounds, near 0 for lines that have nothing to do with each other */
const likeness = (a: string, b: string) => {
  const x = skeleton(a)
  const y = skeleton(b)
  const longest = Math.max(x.length, y.length)
  return longest ? 1 - distance(x, y) / longest : 0
}

/**
 * Puts Japanese lines on the person's romaji lines when the two do not have the same number of lines (the person's
 * lyrics repeat a chorus, or skip a line) and no times to go by: the Japanese lines are read out (`readings`, one per
 * line, made by the app) and each romaji line takes the Japanese line that sounds like it, in order. The person's times
 * stay. Lines that find no partner keep their romaji as they were. Null unless 70 % of the romaji lines found one.
 */
export function alignJapanese(romaji: LyricLine[], japanese: string[], readings: string[]): { synced: LyricLine[]; romaji: string[] } | null {
  const r = sung(romaji)
  if (!r.length || !japanese.length || readings.length !== japanese.length) return null
  const MIN = 0.5
  const n = r.length
  const m = japanese.length
  const sim: number[][] = r.map((line) => readings.map((reading) => (reading ? likeness(line.text, reading) : 0)))
  // Best total likeness of lines paired in order (a pair is only allowed when the two sound alike)
  const best: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      best[i][j] = Math.max(best[i - 1][j], best[i][j - 1], sim[i - 1][j - 1] >= MIN ? best[i - 1][j - 1] + sim[i - 1][j - 1] : 0)
    }
  }
  const partner = new Array<number>(n).fill(-1)
  for (let i = n, j = m; i > 0 && j > 0; ) {
    if (best[i][j] === best[i - 1][j]) i--
    else if (best[i][j] === best[i][j - 1]) j--
    else {
      partner[i - 1] = j - 1
      i--
      j--
    }
  }
  const found = partner.filter((p) => p >= 0).length
  if (found < Math.ceil(n * 0.7)) return null
  return {
    synced: r.map((line, i) => ({ t: line.t, text: partner[i] >= 0 ? japanese[partner[i]] : line.text })),
    romaji: r.map((line, i) => (partner[i] >= 0 ? line.text : "")),
  }
}

import type { LyricLine } from "../data"
import { getJson } from "./http"

// Hepburn romanisation. Kana are turned into letters on the phone; only lines with kanji need the internet,
// because which reading a kanji has depends on the words around it.

const BASE: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", ゐ: "i", ゑ: "e", を: "o",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ゔ: "vu",
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
}

// A kana followed by a small ゃ ゅ ょ ぁ ぃ ぅ ぇ ぉ is read as one sound
const COMBO: Record<string, string> = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo", しゃ: "sha", しゅ: "shu", しょ: "sho", しぇ: "she",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho", ちぇ: "che", にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo", みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo", ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  じゃ: "ja", じゅ: "ju", じょ: "jo", じぇ: "je", ぢゃ: "ja", ぢゅ: "ju", ぢょ: "jo",
  びゃ: "bya", びゅ: "byu", びょ: "byo", ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
  ふぁ: "fa", ふぃ: "fi", ふぇ: "fe", ふぉ: "fo", ふゅ: "fyu",
  てぃ: "ti", でぃ: "di", とぅ: "tu", どぅ: "du", てゅ: "tyu", でゅ: "dyu",
  うぃ: "wi", うぇ: "we", うぉ: "wo", ゔぁ: "va", ゔぃ: "vi", ゔぇ: "ve", ゔぉ: "vo",
  つぁ: "tsa", つぃ: "tsi", つぇ: "tse", つぉ: "tso", いぇ: "ye",
}

const VOWELS = "aiueo"

/** Katakana to hiragana, so one table serves both. */
const toHiragana = (text: string) => text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

/** Whether a text has any Japanese in it (kana or kanji). */
export const hasJapanese = (text: string) => /[぀-ヿ㐀-鿿]/.test(text)
/** Whether a text has kanji, whose reading can't be worked out without a dictionary. */
const hasKanji = (text: string) => /[㐀-鿿]/.test(text)
/** Whether any line of the lyrics is Japanese. */
export const lyricsHaveJapanese = (lines: LyricLine[]) => lines.some((l) => hasJapanese(l.text))

/** Kana to Latin letters. Anything else (English words, digits, punctuation) stays as it is. */
export function kanaToRomaji(text: string): string {
  const k = toHiragana(text)
  let out = ""
  let doubled = false
  for (let i = 0; i < k.length; i++) {
    const c = k[i]
    if (c === "っ") {
      doubled = true
      continue
    }
    if (c === "ー") {
      // A stretched sound: the last vowel again
      const last = out[out.length - 1]
      if (last && VOWELS.includes(last)) out += last
      continue
    }
    if (c === "ん") {
      // "n" before a vowel or y would read as another syllable, so it gets an apostrophe
      const next = BASE[k[i + 1]] ?? COMBO[k.slice(i + 1, i + 3)]
      out += next && /^[aiueoy]/.test(next) ? "n'" : "n"
      continue
    }
    let sound = COMBO[k.slice(i, i + 2)]
    if (sound) i++
    else sound = BASE[c]
    if (sound === undefined) {
      doubled = false
      out += c
      continue
    }
    if (doubled) {
      out += sound.startsWith("ch") ? "t" + sound : sound[0] + sound
      doubled = false
    } else out += sound
  }
  return out.replace(/\s+/g, " ").trim()
}

/** One line read aloud by Google Translate's public endpoint; only the line's text is sent. */
async function readOnline(text: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=rm&q=${encodeURIComponent(text)}`
  const found = await getJson<[[string | null, string | null, string | null, string | null][]]>(url)
  const reading = (found?.[0] ?? []).map((part) => part[3]).filter((x): x is string => !!x).join(" ")
  // Google marks some stylised kanji with "~" and capitalises names in the middle of a word («tsuMasa»): both are noise here
  return reading
    .replace(/~/g, "")
    .replace(/([a-zāīūēō])([A-Z])/g, (_, a: string, b: string) => a + b.toLowerCase())
    .replace(/\s+/g, " ")
    .trim()
}

// Lines go to Google joined by " | ", which comes back as "|" between the readings. One request per line (40 for a
// song) got 429 and 409 on the person's mobile data (Claro shares one address among many phones); a few requests do not
const SEP = " | "
const CHUNK_CHARS = 400

/** Lines in groups short enough for one address (a Japanese character takes 9 bytes once encoded) */
function chunks(texts: string[]): number[][] {
  const out: number[][] = []
  let size = 0
  texts.forEach((t, i) => {
    if (!out.length || size + t.length > CHUNK_CHARS) {
      out.push([])
      size = 0
    }
    out[out.length - 1].push(i)
    size += t.length + SEP.length
  })
  return out
}

/**
 * The romanised reading of each synced line, in order. Lines with only kana are done on the phone; lines with
 * kanji are sent in a few groups. Throws NetworkError if the service can't be reached, so nothing half-done is saved.
 */
export async function romanise(lines: LyricLine[]): Promise<string[]> {
  const out: string[] = lines.map((l) => (hasJapanese(l.text) && !hasKanji(l.text) ? kanaToRomaji(l.text) : ""))
  const todo = lines.map((l, i) => i).filter((i) => hasKanji(lines[i].text))
  // A "|" inside a line would split its reading in two
  const texts = todo.map((i) => lines[i].text.replace(/\|/g, " "))
  for (const group of chunks(texts)) {
    const parts = (await readOnline(group.map((k) => texts[k]).join(SEP))).split("|").map((p) => p.trim())
    if (parts.length === group.length) group.forEach((k, j) => (out[todo[k]] = parts[j]))
    // The readings did not come back one per line: those lines are asked for one by one
    else for (const k of group) out[todo[k]] = await readOnline(texts[k])
  }
  return out
}

/**
 * A Japanese title in English («イレギュラーマン» gives «irregular man»), to find the song's lyrics under the name other
 * sites know it by. Only the title is sent. Empty when there is no answer or it is not Latin letters.
 */
export async function translateTitle(text: string): Promise<string> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(text)}`
    const found = await getJson<[[string | null][]]>(url)
    const english = (found?.[0] ?? []).map((part) => part[0]).filter((x): x is string => !!x).join("").trim()
    return /^[\x20-\x7e]+$/.test(english) && english.toLowerCase() !== text.toLowerCase() ? english : ""
  } catch {
    return ""
  }
}

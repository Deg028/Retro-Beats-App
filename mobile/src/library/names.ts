export const UNKNOWN_ARTIST = "Artista desconocido"

// Words that show a bracketed tag is part of how the file was uploaded, not of the song's name
const NOISE =
  /\b(official|oficial|video|vídeo|videoclip|clip|audio|lyrics?|lyric|letras?|con letra|hd|hq|4k|8k|1080p|720p|visuali[sz]er|mv|m\/v|music|remaster(?:ed)?|explicit|karaoke|subtitulado|subtitulos|subtítulos|full album|topic|free download|descarga|stereo|mono|version original)\b/i

const OPEN = "(\\[【「『"
const CLOSE = ")\\]】」』"
const GROUP = new RegExp(`\\s*[${OPEN}][^${CLOSE}]*[${CLOSE}]`, "g")
const DASH = /\s+[-‐‑‒–—―]\s+/
// "Official Video", "Letra", "HD"... left at the end of a name with no brackets around it
const TRAILING_NOISE =
  /\s*[-‐‑‒–—―:]?\s*\b(?:official\s+(?:music\s+)?(?:video|audio|lyric\s+video|visuali[sz]er)|video\s+oficial|videoclip(?:\s+oficial)?|audio\s+oficial|letra\s+oficial|lyrics?(?:\s+video)?|con\s+letra|letra|hd|hq|4k)\s*$/i
// A YouTube video id that downloaders append in brackets, e.g. "[dQw4w9WgXcQ]"
const VIDEO_ID = /\s*[[(]([A-Za-z0-9_-]{11})[\])]\s*$/

// Quality tags that downloaders add: "(MP3_160K)", "(M4A_128K)", "(MP3)", or glued to the end as "MP3_320K"
const DOWNLOADER_TAG = /\s*[(\[]?(?:mp3|m4a|mp4|webm|opus)(?:[_ ]?\d{2,3}k)?[)\]]?(?=\s*(?:\(\d\)|_\d)?$)/i
// "_1" or " (1)" left when the same file was saved twice
const COPY_SUFFIX = /(?:\s*\(\d\)|_\d)$/

const looksLikeVideoId = (id: string) => /\d|[a-z][A-Z]|_|-/.test(id)

/**
 * Title and artist from a file name. Works on names typed by hand ("03 - Artista - Título.mp3") and on
 * names left by video downloaders ("Artista - Título (Official Video) [dQw4w9WgXcQ].mp3").
 * The media library in Expo Go gives no tags, so the name is the best information there is.
 */
export function parseName(filename: string): { title: string; artist: string } {
  const bare = filename.replace(/\.[A-Za-z0-9]{1,5}$/, "")
  let s = bare.replace(DOWNLOADER_TAG, "").replace(COPY_SUFFIX, "")
  // Downloaders swap characters that file names can't hold (: / | " ? ') for an underscore
  s = s.replace(/(\p{L})_(s|m|t|re|ll|ve|d)(?![\p{L}])/giu, "$1'$2").replace(/\s_+\s/g, " | ").replace(/_/g, " ").replace(/\s+/g, " ").trim()

  const id = s.match(VIDEO_ID)
  if (id && looksLikeVideoId(id[1])) s = s.slice(0, id.index).trim()

  // Bracketed tags are dropped only when they read as upload noise; "(Remix)" or "(Acoustic)" stay
  s = s.replace(GROUP, (group) => (NOISE.test(group) ? "" : group)).trim()

  // What follows a bar is a channel, an album or a tag when the name before it already reads "Artista - Título"
  const bars = s.split(/\s*[|｜]\s*/).filter(Boolean)
  if (bars.length > 1) s = DASH.test(bars[0]) || bars.every((p, i) => i === 0 || NOISE.test(p)) ? bars[0] : bars.join(" - ")

  // Some downloaders glue the video id on with a dash: "Título-tAGnKpE4NCI"
  s = s.replace(/[-‐]([A-Za-z0-9_-]{11})$/, (all, vid: string) => (/\d/.test(vid) && /[a-z]/.test(vid) && /[A-Z]/.test(vid) ? "" : all)).trim()

  for (let i = 0; i < 3 && TRAILING_NOISE.test(s); i++) s = s.replace(TRAILING_NOISE, "").trim()

  // Leading track number: "01 - ", "01. ", "(01) ", "1-05 "
  s = s.replace(/^\(?\d{1,3}\)?(?:\s*[-.)]\s*|\s+)(?=\D)/, "").trim()

  const unquote = (p: string) => p.replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "").trim()
  // YouTube's automatic channels are called "Artista - Topic"
  const parts = s
    .split(DASH)
    .map(unquote)
    .filter((p) => p && !/^topic$/i.test(p))
  if (parts.length >= 2) return { artist: parts[0], title: parts.slice(1).join(" - ") }
  return { artist: UNKNOWN_ARTIST, title: unquote(s) || bare || filename }
}

export type SearchTerms = { artist: string | null; title: string }

/** The title without "(feat. X)" or "(Remastered 2011)", which only get in the way of a search. */
function plainTitle(title: string) {
  return title
    .replace(GROUP, (group) => (/\b(feat|ft|featuring|remaster(?:ed)?|bonus|version|versión|deluxe)\b/i.test(group) ? "" : group))
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.*$/i, "")
    .trim()
}

/**
 * The ways a title may be written in a database: as it is, without tags ("Título [Anime OP]" becomes "Título"),
 * and the name inside brackets when that is another spelling ("オトノケ(Otonoke)" is also "Otonoke").
 */
function titleVariants(title: string): string[] {
  const t = plainTitle(title)
  const out = [t]
  const bare = t.replace(GROUP, "").trim()
  if (bare && !out.includes(bare)) out.push(bare)
  for (const m of t.matchAll(/[(（]([^)）]+)[)）]/g)) {
    const alias = m[1].trim()
    if (alias.length >= 2 && /\p{L}/u.test(alias) && !out.includes(alias)) out.push(alias)
  }
  return out.slice(0, 3)
}

/**
 * What to search for, best guess first. Names from video sites sometimes come as "Título - Artista", so the
 * swapped order is the last try; a song with two artists is also tried with just the first one.
 */
export function searchAttempts(artist: string, title: string): SearchTerms[] {
  const names = titleVariants(title)
  if (artist === UNKNOWN_ARTIST) return names.map((title) => ({ artist: null, title }))
  const first = artist.split(/\s+(?:feat\.?|ft\.?|featuring|x|&|y|and)\s+|\s*,\s*|\s*\/\s*/i)[0].trim()
  const main = artist.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.*$/i, "").trim()
  const out: SearchTerms[] = names.map((title) => ({ artist: main, title }))
  if (first && first !== main) out.push({ artist: first, title: names[0] })
  out.push({ artist: plainTitle(title), title: artist })
  return out
}

/** Lowercase, no accents, no punctuation: for comparing a name from a file with one from a database. */
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim()

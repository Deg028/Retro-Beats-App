import { File, FileMode } from "expo-file-system"
import { UNKNOWN_ARTIST } from "./names"

export type Tags = { title: string; artist: string }

/**
 * Names that say nothing about the song: only digits and separators ("1_4945510745191220486"), or the
 * numbered names chat apps give to audio ("AUD-20240101-WA0001"). Their title lives inside the file.
 */
export const isOpaqueName = (title: string) => !/\p{L}/u.test(title) || /^(?:AUD|PTT|VID)[\s_-]*\d{6,8}[\s_-]*WA\d+$/i.test(title.trim())

// How much of the start of a file is read to find the tag; titles come before cover pictures
const HEAD = 128 * 1024

function decode(bytes: Uint8Array, encoding: number): string {
  let out = ""
  if (encoding === 1 || encoding === 2) {
    let i = 0
    let little = encoding === 1 ? true : false
    if (encoding === 1 && bytes.length >= 2) {
      if (bytes[0] === 0xff && bytes[1] === 0xfe) {
        little = true
        i = 2
      } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        little = false
        i = 2
      }
    }
    for (; i + 1 < bytes.length; i += 2) out += String.fromCharCode(little ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1])
  } else if (encoding === 3) {
    // UTF-8
    for (let i = 0; i < bytes.length; ) {
      const b = bytes[i++]
      if (b < 0x80) out += String.fromCharCode(b)
      else if (b >= 0xc0 && b < 0xe0 && i < bytes.length) out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f))
      else if (b >= 0xe0 && b < 0xf0 && i + 1 < bytes.length) out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f))
      else if (b >= 0xf0 && i + 2 < bytes.length) {
        const cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
        out += String.fromCodePoint(cp)
      }
    }
  } else {
    for (const b of bytes) out += String.fromCharCode(b)
  }
  return out.replace(/\0+$/g, "").replace(/\0/g, " / ").trim()
}

/** The text of an ID3 text frame: an encoding byte, then the text. */
const frameText = (data: Uint8Array) => (data.length > 1 ? decode(data.subarray(1), data[0]) : "")

const synchsafe = (b: Uint8Array, at: number) => ((b[at] & 0x7f) << 21) | ((b[at + 1] & 0x7f) << 14) | ((b[at + 2] & 0x7f) << 7) | (b[at + 3] & 0x7f)

export type Picture = { data: Uint8Array; ext: "jpg" | "png"; /** Wider than tall, like a video thumbnail */ wide: boolean }

/** Width and height of a JPEG or PNG from its header, or null when it is neither. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b.length > 24)
    return { width: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, height: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0 }
  if (b[0] !== 0xff || b[1] !== 0xd8) return null
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) {
      i++
      continue
    }
    const marker = b[i + 1]
    // Start-of-frame markers carry the size; C4, C8 and CC are other tables that share the range
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] }
    i += 2 + ((b[i + 2] << 8) | b[i + 3])
  }
  return null
}

/** The picture inside an APIC (2.3, 2.4) or PIC (2.2) frame: encoding, image type, a description, then the image. */
function framePicture(d: Uint8Array, version: number): Picture | null {
  const encoding = d[0]
  let at = 1
  if (version === 2) at += 3
  else {
    while (at < d.length && d[at] !== 0) at++
    at++
  }
  at++ // picture type
  // The description ends with one zero byte, or two in the UTF-16 encodings
  if (encoding === 1 || encoding === 2) {
    while (at + 1 < d.length && (d[at] !== 0 || d[at + 1] !== 0)) at += 2
    at += 2
  } else {
    while (at < d.length && d[at] !== 0) at++
    at++
  }
  const data = d.subarray(at)
  const size = imageSize(data)
  if (!size || data.length < 1000) return null
  return { data, ext: data[0] === 0x89 ? "png" : "jpg", wide: size.width > size.height * 1.2 }
}

/** Title, artist and front picture from the ID3v2 tag at the start of an MP3 (versions 2.2, 2.3 and 2.4). Null when there is none. */
export function parseId3v2(b: Uint8Array): { title?: string; artist?: string; picture?: Picture } | null {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return null
  const version = b[3]
  const end = Math.min(b.length, 10 + synchsafe(b, 6))
  const idLength = version === 2 ? 3 : 4
  const headLength = version === 2 ? 6 : 10
  const found: Record<string, string> = {}
  let picture: Picture | undefined
  let at = 10
  // An extended header comes first in some tags (2.3 and 2.4)
  if (b[5] & 0x40 && version >= 3) at += version === 4 ? synchsafe(b, at) : 4 + ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3])
  while (at + headLength <= end) {
    const id = String.fromCharCode(...b.subarray(at, at + idLength))
    if (!/^[A-Z0-9]+$/.test(id)) break
    const size =
      version === 2 ? (b[at + 3] << 16) | (b[at + 4] << 8) | b[at + 5] : version === 4 ? synchsafe(b, at + 4) : ((b[at + 4] << 24) | (b[at + 5] << 16) | (b[at + 6] << 8) | b[at + 7]) >>> 0
    if (size <= 0 || at + headLength + size > b.length) break
    const data = b.subarray(at + headLength, at + headLength + size)
    if (id === "TIT2" || id === "TT2" || id === "TPE1" || id === "TP1" || id === "TPE2" || id === "TP2") found[id] = frameText(data)
    else if (!picture && (id === "APIC" || id === "PIC")) picture = framePicture(data, version) ?? undefined
    at += headLength + size
  }
  return { title: found.TIT2 ?? found.TT2, artist: found.TPE1 ?? found.TP1 ?? found.TPE2 ?? found.TP2, picture }
}

/** The old ID3v1 block: the last 128 bytes of the file, fixed-width Latin-1 fields. */
export function parseId3v1(b: Uint8Array): { title?: string; artist?: string } | null {
  if (b.length < 128 || b[0] !== 0x54 || b[1] !== 0x41 || b[2] !== 0x47) return null
  return { title: decode(b.subarray(3, 33), 0), artist: decode(b.subarray(33, 63), 0) }
}

const clean = (s?: string) => (s && /\p{L}/u.test(s) ? s.replace(/\s+/g, " ").trim() : "")

/** An artist as tagged by video sites: "Name - Topic" and "NameVEVO" are channels named after the artist. */
export function cleanArtist(s?: string) {
  const name = clean(s)
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/(?<=\p{L})VEVO$/u, "")
    .trim()
  return /^<?unknown>?$/i.test(name) ? "" : name
}

// The whole tag is read when its picture is wanted; covers larger than this are left out
const MAX_TAG = 4 * 1024 * 1024

async function readHead(uri: string, whole: boolean) {
  let handle: ReturnType<File["open"]> | null = null
  try {
    handle = new File(uri).open(FileMode.ReadOnly)
    let head = await handle.readBytes(HEAD)
    if (whole && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33 && head.length >= 10) {
      const size = 10 + synchsafe(head, 6)
      if (size > head.length && size <= MAX_TAG) {
        handle.offset = 0
        head = await handle.readBytes(size)
      }
    }
    let tag = parseId3v2(head)
    if (!whole && !clean(tag?.title) && handle.size && handle.size > 128) {
      handle.offset = handle.size - 128
      tag = parseId3v1(await handle.readBytes(128)) ?? tag
    }
    return tag
  } finally {
    try {
      handle?.close()
    } catch {
      // Already closed
    }
  }
}

/** Reads the title and artist saved inside an audio file, or null when it has no usable title. */
export async function readTags(uri: string): Promise<Tags | null> {
  try {
    const tag = await readHead(uri, false)
    const title = clean(tag?.title)
    if (!title) return null
    return { title, artist: cleanArtist(tag?.artist) || UNKNOWN_ARTIST }
  } catch {
    return null
  }
}

/** The cover picture saved inside an MP3, or null when it has none. */
export async function readPicture(uri: string): Promise<Picture | null> {
  try {
    return (await readHead(uri, true))?.picture ?? null
  } catch {
    return null
  }
}

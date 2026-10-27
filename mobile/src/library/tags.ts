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

/** Title and artist from the ID3v2 tag at the start of an MP3 (versions 2.2, 2.3 and 2.4). Null when there is none. */
export function parseId3v2(b: Uint8Array): { title?: string; artist?: string } | null {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return null
  const version = b[3]
  const end = Math.min(b.length, 10 + synchsafe(b, 6))
  const idLength = version === 2 ? 3 : 4
  const headLength = version === 2 ? 6 : 10
  const found: Record<string, string> = {}
  let at = 10
  // An extended header comes first in some tags (2.3 and 2.4)
  if (b[5] & 0x40 && version >= 3) at += version === 4 ? synchsafe(b, at) : 4 + ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3])
  while (at + headLength <= end) {
    const id = String.fromCharCode(...b.subarray(at, at + idLength))
    if (!/^[A-Z0-9]+$/.test(id)) break
    const size =
      version === 2 ? (b[at + 3] << 16) | (b[at + 4] << 8) | b[at + 5] : version === 4 ? synchsafe(b, at + 4) : ((b[at + 4] << 24) | (b[at + 5] << 16) | (b[at + 6] << 8) | b[at + 7]) >>> 0
    if (size <= 0 || at + headLength + size > b.length) break
    if (id === "TIT2" || id === "TT2" || id === "TPE1" || id === "TP1" || id === "TPE2" || id === "TP2") found[id] = frameText(b.subarray(at + headLength, at + headLength + size))
    at += headLength + size
  }
  return { title: found.TIT2 ?? found.TT2, artist: found.TPE1 ?? found.TP1 ?? found.TPE2 ?? found.TP2 }
}

/** The old ID3v1 block: the last 128 bytes of the file, fixed-width Latin-1 fields. */
export function parseId3v1(b: Uint8Array): { title?: string; artist?: string } | null {
  if (b.length < 128 || b[0] !== 0x54 || b[1] !== 0x41 || b[2] !== 0x47) return null
  return { title: decode(b.subarray(3, 33), 0), artist: decode(b.subarray(33, 63), 0) }
}

const clean = (s?: string) => (s && /\p{L}/u.test(s) ? s.replace(/\s+/g, " ").trim() : "")

/** Reads the title and artist saved inside an audio file, or null when it has no usable ones. */
export async function readTags(uri: string): Promise<Tags | null> {
  let handle: ReturnType<File["open"]> | null = null
  try {
    handle = new File(uri).open(FileMode.ReadOnly)
    const head = await handle.readBytes(HEAD)
    let tag = parseId3v2(head)
    if (!clean(tag?.title) && handle.size && handle.size > 128) {
      handle.offset = handle.size - 128
      tag = parseId3v1(await handle.readBytes(128)) ?? tag
    }
    const title = clean(tag?.title)
    if (!title) return null
    return { title, artist: clean(tag?.artist) || UNKNOWN_ARTIST }
  } catch {
    return null
  } finally {
    try {
      handle?.close()
    } catch {
      // Already closed
    }
  }
}

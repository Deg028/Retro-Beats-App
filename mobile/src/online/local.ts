import { File } from "expo-file-system"
import type { Lyrics } from "./lrclib"
import { parseLrc } from "./lrclib"

/** Lyrics from a text file saved beside the song: timed when it has time tags, plain otherwise. Null if it can't be read or is empty. */
export async function readLyricsFile(uri: string): Promise<Lyrics | null> {
  try {
    const text = (await new File(uri).text()).replace(/^﻿/, "").trim()
    if (!text) return null
    const synced = parseLrc(text)
    // Only the time tags are removed from the plain version; lines like [Chorus] stay as the author wrote them
    const plain = text.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, "").trim()
    return synced.length >= 3 ? { synced, plain: plain || null } : { synced: null, plain }
  } catch {
    return null
  }
}

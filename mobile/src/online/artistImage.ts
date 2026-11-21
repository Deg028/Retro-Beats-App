import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect, useState } from "react"
import { normalize } from "../library/names"
import { getJson } from "./http"

type Hit = { name?: string; picture_xl?: string; picture_big?: string; nb_fan?: number }

const KEY = "retro-beats:artist-image:"
// Where the person turned the lookups off (Música tab) nothing is asked
const ON_KEY = "retro-beats:online-on"

/**
 * A photo of the artist from Deezer's public catalogue search (title and artist only, like the covers), for the Rewind.
 * The name has to match: «Kasane Teto» finds «Kasane Teto», not a similar one. The answer, also «none», is kept on the phone.
 */
export async function findArtistImage(name: string): Promise<string | null> {
  const key = KEY + normalize(name)
  try {
    if ((await AsyncStorage.getItem(ON_KEY)) === "0") return null
    const saved = await AsyncStorage.getItem(key)
    if (saved !== null) return saved || null
  } catch {
    return null
  }
  let url: string | null
  try {
    const found = await getJson<{ data?: Hit[] }>(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=8`)
    const want = normalize(name)
    const hits = (found?.data ?? []).filter((h) => h.name && normalize(h.name) === want && (h.picture_xl || h.picture_big))
    hits.sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))
    url = hits[0] ? (hits[0].picture_xl ?? hits[0].picture_big ?? null) : null
  } catch {
    // No answer now: asked again next time
    return null
  }
  AsyncStorage.setItem(key, url ?? "").catch(() => {})
  return url
}

/** The photo of an artist, or null while it is looked up and when there is none */
export function useArtistImage(name: string | undefined): string | null {
  const [found, setFound] = useState<{ name: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!name) return
    let live = true
    findArtistImage(name).then((url) => live && setFound({ name, url }))
    return () => {
      live = false
    }
  }, [name])
  return found && found.name === name ? found.url : null
}

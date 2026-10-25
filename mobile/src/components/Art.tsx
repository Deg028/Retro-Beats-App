import { createContext, useContext, useState } from "react"
import { Image, View } from "react-native"
import { SongMeta } from "../online/store"
import { PixelCover } from "./Pixel"

/** What was found online for each song; covers are read from here so any list can show them. */
const ArtContext = createContext<Record<number, SongMeta>>({})
export const ArtProvider = ArtContext.Provider

/**
 * A song's picture: the album cover found for it, or the generated pixel art while there is none
 * (or while the saved file can't be shown).
 */
export function Art({ seed, size, palette, bg, blur }: { seed: number; size: number; palette?: readonly string[]; bg?: string; blur?: number }) {
  const uri = useContext(ArtContext)[seed]?.cover
  const [failed, setFailed] = useState<string | null>(null)
  if (uri && failed !== uri && uri.endsWith("-video.jpg")) {
    // A video thumbnail is widescreen: shown whole over a blurred copy of itself, so the square has no empty bars and no cropped words
    return (
      <View style={{ width: size, height: size, overflow: "hidden", backgroundColor: bg }} accessibilityLabel="Miniatura del video">
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" blurRadius={blur ?? 18} onError={() => setFailed(uri)} />
        {!blur && <Image source={{ uri }} style={{ position: "absolute", width: size, height: size }} resizeMode="contain" />}
      </View>
    )
  }
  if (uri && failed !== uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityLabel="Carátula del álbum"
        style={{ width: size, height: size }}
        resizeMode="cover"
        blurRadius={blur}
        onError={() => setFailed(uri)}
      />
    )
  }
  return <PixelCover seed={seed} size={size} palette={palette} bg={bg} />
}

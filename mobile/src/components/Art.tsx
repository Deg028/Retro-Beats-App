import { createContext, useContext, useState } from "react"
import { Image, View } from "react-native"
import { SongMeta } from "../online/store"
import Svg, { Path } from "react-native-svg"

/** What was found online for each song; covers are read from here so any list can show them. */
const ArtContext = createContext<Record<number, SongMeta>>({})
export const ArtProvider = ArtContext.Provider

/**
 * A song's picture: the album cover found for it, or a plain tile with a music note while there is none
 * (or while the saved file can't be shown). No generated art: a made-up picture would look like a real cover.
 */
export function Art({ seed, size, palette, bg, blur }: { seed: number; size: number; palette?: readonly string[]; bg?: string; blur?: number }) {
  const uri = useContext(ArtContext)[seed]?.cover
  const [failed, setFailed] = useState<string | null>(null)
  if (uri && failed !== uri && /-video\.(jpg|png)$/.test(uri)) {
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
  const note = palette?.[1] ?? palette?.[0] ?? "#8a8a8a"
  return (
    <View style={{ width: size, height: size, backgroundColor: bg ?? "#1b1b1b", alignItems: "center", justifyContent: "center" }} accessibilityLabel="Sin carátula">
      <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" opacity={0.55}>
        <Path fill={note} d="M9 3v10.55A4 4 0 1 0 11 17V7h6V3z" />
      </Svg>
    </View>
  )
}

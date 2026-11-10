import { useEffect, useState } from "react"
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button, Cover, T } from "../components/ui"
import { formatListening, Ranked, Summary } from "../recap"
import { useTheme } from "../themes/ThemeContext"

/** Songs in the mosaic, after the number one */
const MOSAIC = 12
const COLUMNS = 3

/**
 * The year's recap as an occasion: the year's songs come in as a mosaic of their covers, with the number one hidden;
 * a tap on the screen clears the mosaic and reveals the song and the artist heard most.
 */
export default function Rewind({ year, summary, visible, onClose }: { year: string; summary: Summary; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {visible && <Show year={year} summary={summary} onClose={onClose} />}
    </Modal>
  )
}

function Show({ year, summary, onClose }: { year: string; summary: Summary; onClose: () => void }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [first, ...rest] = summary.songs
  const tiles = rest.slice(0, MOSAIC)
  const topArtist = summary.artists[0]
  const gap = 8
  const tile = Math.floor((width - 32 - gap * (COLUMNS - 1)) / COLUMNS)

  const [revealed, setRevealed] = useState(false)
  // One value per tile, so they come in one after another
  const [shown] = useState(() => tiles.map(() => new Animated.Value(0)))
  const [title] = useState(() => new Animated.Value(0))
  const [hint] = useState(() => new Animated.Value(0))
  const [reveal] = useState(() => new Animated.Value(0))

  useEffect(() => {
    Animated.sequence([
      Animated.timing(title, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.stagger(
        110,
        shown.map((v) => Animated.spring(v, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true })),
      ),
    ]).start()
    // The invitation to tap breathes until the tap
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hint, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(hint, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    )
    pulse.start()
    return () => pulse.stop()
  }, [shown, title, hint])

  const doReveal = () => {
    if (revealed || !first) return
    setRevealed(true)
    Animated.spring(reveal, { toValue: 1, friction: 7, tension: 40, useNativeDriver: true }).start()
  }

  const mosaicTile = (song: Ranked, i: number) => (
    <Animated.View key={`${song.name}-${i}`} style={{ opacity: shown[i], transform: [{ scale: shown[i].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
      <MosaicTile song={song} rank={i + 2} size={tile} accent={theme.c.accent} />
    </Animated.View>
  )

  // Colours of an occasion: the theme's accent over a dark stage, whatever the theme
  const stage = "#0b0b14"
  const ink = "#ffffff"
  const dim = "rgba(255,255,255,0.65)"

  return (
    <Pressable onPress={doReveal} style={{ flex: 1, backgroundColor: stage }} accessibilityRole="button" accessibilityLabel={revealed ? "Tu canción del año" : "Toca para revelar tu canción del año"}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 16, gap: 16 }}>
        <Animated.View style={{ opacity: title, transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }], gap: 4 }}>
          <T variant="label" color={theme.c.accent}>
            Rewind {year}
          </T>
          <T variant="display" color={ink}>
            Tu año en música
          </T>
          <T variant="body" color={dim} style={{ textTransform: "none" }}>
            {formatListening(summary.seconds)} escuchando · {summary.songCount === 1 ? "1 canción" : `${summary.songCount} canciones`}
          </T>
        </Animated.View>

        {!revealed ? (
          <>
            {/* The number one's place, hidden until the tap, with the second and third beside it; the rest below */}
            <View style={{ flexDirection: "row", gap }}>
              <View style={[styles.mystery, { width: tile * 2 + gap, height: tile * 2 + gap, borderRadius: 18, borderColor: theme.c.accent }]}>
                <T variant="display" color={theme.c.accent} style={{ fontSize: 72, lineHeight: 80 }}>
                  ?
                </T>
                <T variant="label" color={ink}>
                  Nº 1
                </T>
              </View>
              <View style={{ gap }}>{tiles.slice(0, 2).map((song, i) => mosaicTile(song, i))}</View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap, paddingBottom: 64 }}>{tiles.slice(2).map((song, i) => mosaicTile(song, i + 2))}</View>
          </>
        ) : (
          first && (
            <Animated.View
              style={{
                alignItems: "center",
                gap: 14,
                opacity: reveal,
                transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }, { rotateY: reveal.interpolate({ inputRange: [0, 1], outputRange: ["90deg", "0deg"] }) }],
              }}
            >
              <T variant="label" color={theme.c.accent}>
                Tu canción del año
              </T>
              <View style={{ borderRadius: 20, overflow: "hidden", borderWidth: 3, borderColor: theme.c.accent }}>
                <Cover seed={first.id ?? -1} size={Math.min(width - 64, 320)} />
              </View>
              <T variant="display" color={ink} style={{ textAlign: "center" }} numberOfLines={3}>
                {first.name}
              </T>
              <T variant="title" color={dim} style={{ textAlign: "center" }}>
                {first.detail}
              </T>
              <T variant="body" color={theme.c.accent} style={{ textTransform: "none" }}>
                {formatListening(first.seconds)} de escucha
              </T>
              {topArtist && (
                <View style={[styles.artist, { borderColor: theme.c.accent }]}>
                  <T variant="label" color={dim}>
                    Tu artista del año
                  </T>
                  <T variant="title" color={ink} style={{ textAlign: "center" }}>
                    {topArtist.name}
                  </T>
                  <T variant="caption" color={dim}>
                    {formatListening(topArtist.seconds)}
                  </T>
                </View>
              )}
              {summary.artists.length > 1 && (
                <View style={{ alignSelf: "stretch", gap: 6 }}>
                  <T variant="label" color={dim}>
                    También sonaron
                  </T>
                  {summary.artists.slice(1, 5).map((a, i) => (
                    <T key={a.name} variant="body" color={ink} style={{ textTransform: "none" }}>
                      {i + 2}. {a.name} · {formatListening(a.seconds)}
                    </T>
                  ))}
                </View>
              )}
              <Button label="Ver el resumen completo" icon="check" onPress={onClose} />
            </Animated.View>
          )
        )}
      </ScrollView>
      {!revealed && (
        <View pointerEvents="none" style={[styles.hint, { paddingBottom: insets.bottom + 18 }]}>
          <Animated.View style={{ opacity: hint }}>
            <T variant="title" color={ink} style={{ textAlign: "center" }}>
              Toca la pantalla para revelar tu canción del año
            </T>
          </Animated.View>
        </View>
      )}
    </Pressable>
  )
}

function MosaicTile({ song, rank, size, accent }: { song: Ranked; rank: number; size: number; accent: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 12, overflow: "hidden" }}>
      <Cover seed={song.id ?? -rank} size={size} />
      <View style={styles.shade}>
        <T variant="label" color={accent} style={{ fontSize: 11 }}>
          #{rank}
        </T>
        <T variant="caption" color="#ffffff" numberOfLines={1} style={{ fontSize: 11 }}>
          {song.name}
        </T>
        <T variant="caption" color="rgba(255,255,255,0.7)" numberOfLines={1} style={{ fontSize: 10 }}>
          {song.detail}
        </T>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  mystery: { borderWidth: 3, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  hint: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 18, paddingHorizontal: 24, backgroundColor: "rgba(11,11,20,0.92)" },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: "rgba(0,0,0,0.6)" },
  artist: { alignSelf: "stretch", alignItems: "center", gap: 2, padding: 14, borderWidth: 1.5, borderRadius: 16 },
})

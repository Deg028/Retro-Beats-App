import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Platform, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p"
import { VT323_400Regular } from "@expo-google-fonts/vt323"
import { useFonts } from "expo-font"
import { Equalizer, PixelCover } from "./src/components/Pixel"
import Home from "./src/screens/Home"
import Player from "./src/screens/Player"
import Catalog from "./src/screens/Catalog"
import { usePlayer } from "./src/usePlayer"
import { colors, fonts } from "./src/theme"

type Screen = "home" | "player" | "catalog"

const TABS: { key: Screen; label: string; icon: string }[] = [
  { key: "home", label: "INICIO", icon: "⌂" },
  { key: "player", label: "CANCIÓN", icon: "◉" },
  { key: "catalog", label: "CATÁLOGO", icon: "▣" },
]

function Splash({ onDone }: { onDone: () => void }) {
  const fill = useRef(new Animated.Value(0)).current
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    Animated.timing(fill, { toValue: 1, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(
      ({ finished }) => finished && done.current(),
    )
  }, [fill])

  return (
    <View style={styles.splash}>
      <Text style={styles.oneUp}>★ 1UP ★</Text>
      <Text style={styles.logo}>RETRO</Text>
      <Text style={[styles.logo, { color: colors.primary }]}>BEATS</Text>
      <Equalizer bars={11} height={56} />
      <View style={styles.loadBox}>
        <Animated.View
          style={{ height: "100%", backgroundColor: colors.primary, width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }}
        />
      </View>
      <Text style={styles.loading}>CARGANDO...</Text>
    </View>
  )
}

export default function App() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular, VT323_400Regular })
  const [screen, setScreen] = useState<Screen | "splash">("splash")
  const player = usePlayer()
  const { current, playing } = player

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.ink }} />

  return (
    <>
      <View style={styles.root}>
        <StatusBar style="light" />
        {screen === "splash" ? (
          <Splash onDone={() => setScreen("home")} />
        ) : (
          <>
            <View style={{ flex: 1 }}>
              {screen === "home" && <Home player={player} onOpenPlayer={() => setScreen("player")} />}
              {screen === "player" && <Player player={player} onBrowse={() => setScreen("home")} />}
              {screen === "catalog" && <Catalog player={player} onOpenPlayer={() => setScreen("player")} />}
            </View>

            {current && screen !== "player" && (
              <View style={styles.mini}>
                <Pressable style={styles.miniMain} onPress={() => setScreen("player")} accessibilityLabel="Abrir reproductor">
                  <PixelCover seed={current.id} size={36} style={{ borderWidth: 2, borderColor: colors.secondary }} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.miniTitle}>
                      {current.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.miniArtist}>
                      {current.artist}
                    </Text>
                  </View>
                  <Equalizer playing={playing} bars={4} height={16} />
                </Pressable>
                <Pressable onPress={player.togglePlaying} accessibilityLabel="Reproducir o pausar" style={styles.miniBtn}>
                  <Text style={styles.miniBtnText}>{playing ? "❚❚" : "▶"}</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.tabs} accessibilityRole="tablist">
              {TABS.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setScreen(t.key)}
                  accessibilityState={{ selected: screen === t.key }}
                  style={[styles.tab, screen === t.key && { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.tabIcon, screen !== t.key && { opacity: 0.6 }]}>{t.icon}</Text>
                  <Text style={[styles.tabLabel, screen !== t.key && { opacity: 0.6 }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            {player.toast && (
              <View style={styles.toast} accessibilityLiveRegion="polite">
                <Text style={styles.toastText}>{player.toast}</Text>
              </View>
            )}
          </>
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  // No safe-area library: Android is edge-to-edge, so pad for status/nav bars by hand
  root: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingTop: Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 24) : 48,
    paddingBottom: Platform.OS === "android" ? 20 : 20,
  },
  splash: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  oneUp: { fontFamily: fonts.pixel, fontSize: 11, color: colors.coral },
  logo: { fontFamily: fonts.pixel, fontSize: 30, lineHeight: 48, color: colors.cream, marginVertical: -12 },
  loadBox: { width: 224, height: 20, borderWidth: 4, borderColor: colors.secondary, backgroundColor: colors.ink },
  loading: { fontFamily: fonts.pixel, fontSize: 8, color: colors.coral },
  mini: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 4, borderTopColor: colors.secondary, backgroundColor: colors.panel2 },
  miniMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  miniTitle: { fontFamily: fonts.pixel, fontSize: 8, color: colors.cream },
  miniArtist: { fontFamily: fonts.term, fontSize: 18, color: colors.coral },
  miniBtn: { backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 12, paddingVertical: 8 },
  miniBtnText: { fontFamily: fonts.pixel, fontSize: 10, color: colors.cream },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, borderTopWidth: 4, borderTopColor: colors.secondary, backgroundColor: colors.panel },
  tab: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 6, backgroundColor: colors.panel2, borderWidth: 3, borderColor: colors.ink },
  tabIcon: { fontFamily: fonts.term, fontSize: 18, color: colors.cream },
  tabLabel: { fontFamily: fonts.pixel, fontSize: 8, color: colors.cream },
  toast: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    padding: 12,
    borderWidth: 3,
    borderColor: colors.secondary,
    backgroundColor: colors.panel2,
  },
  toastText: { fontFamily: fonts.pixel, fontSize: 8, lineHeight: 13, color: colors.cream, textAlign: "center" },
})

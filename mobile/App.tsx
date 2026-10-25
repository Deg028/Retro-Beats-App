import { useEffect, useEffectEvent, useState } from "react"
import { Animated, BackHandler, Easing, StyleSheet, useWindowDimensions, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context"
import { PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p"
import { VT323_400Regular } from "@expo-google-fonts/vt323"
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk"
import { PixelifySans_500Medium, PixelifySans_700Bold } from "@expo-google-fonts/pixelify-sans"
import { Sora_400Regular, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from "@expo-google-fonts/sora"
import { Silkscreen_400Regular } from "@expo-google-fonts/silkscreen"
import { useFonts } from "expo-font"
import { MiniPlayer, Screen, TabBar } from "./src/components/Chrome"
import Intro from "./src/components/Intro"
import { motion, T } from "./src/components/ui"
import Home from "./src/screens/Home"
import Player from "./src/screens/Player"
import Catalog from "./src/screens/Catalog"
import Themes from "./src/screens/Themes"
import { PlayerApi, usePlayer } from "./src/usePlayer"
import { useNowPlaying } from "./src/useNowPlaying"
import { ThemeProvider, useThemeControl } from "./src/themes/ThemeContext"
import { colors } from "./src/theme"

type Tab = Exclude<Screen, "player">
const TAB_INDEX: Record<Tab, number> = { home: 0, catalog: 1, themes: 2 }

function Shell({ player }: { player: PlayerApi }) {
  const { theme, ready } = useThemeControl()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [intro, setIntro] = useState(true)
  const [tab, setTab] = useState<Tab>("home")
  const [dir, setDir] = useState(1)
  const [playerOpen, setPlayerOpen] = useState(false)
  // Tab screens fade and slide in; the player is a layer that slides up over them
  const [enter] = useState(() => new Animated.Value(1))
  const [layerY] = useState(() => new Animated.Value(height))

  useNowPlaying(player, theme)

  const showTab = (next: Tab, direction = 1) => {
    setDir(direction)
    setTab(next)
    enter.setValue(0)
    motion(theme, enter, 1, 260).start()
  }

  const go = (next: Screen) => {
    if (next === "player") return setPlayerOpen(true)
    if (playerOpen) closePlayer()
    if (next !== tab) showTab(next, TAB_INDEX[next] > TAB_INDEX[tab] ? 1 : -1)
  }

  const slideIn = useEffectEvent(() => motion(theme, layerY, 0, 330).start())
  useEffect(() => {
    if (playerOpen) slideIn()
  }, [playerOpen])

  const closePlayer = () => {
    const out =
      theme.motion === "stepped"
        ? motion(theme, layerY, height, 280)
        : Animated.timing(layerY, { toValue: height, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true })
    out.start(({ finished }) => finished && setPlayerOpen(false))
  }
  const settlePlayer = () => motion(theme, layerY, 0, 200).start()

  // Android back (button or edge swipe): close the player first, then return to Home, then let the OS exit
  const onBack = useEffectEvent(() => {
    if (playerOpen) closePlayer()
    else if (tab !== "home") showTab("home", -1)
    else return false
    return true
  })
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack)
    return () => sub.remove()
  }, [])

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.ink }} />

  if (intro) {
    return (
      <View style={[styles.root, { backgroundColor: theme.c.bg, paddingTop: insets.top }]}>
        <StatusBar style={theme.dark ? "light" : "dark"} />
        <Intro
          onDone={() => {
            setIntro(false)
            showTab("home")
          }}
        />
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.c.bg }]}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <Animated.View style={{ flex: 1, opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [28 * dir, 0] }) }] }}>
          {tab === "home" && <Home player={player} onOpenPlayer={() => go("player")} />}
          {tab === "catalog" && <Catalog player={player} onOpenPlayer={() => go("player")} />}
          {tab === "themes" && <Themes />}
        </Animated.View>
        <MiniPlayer player={player} onOpen={() => go("player")} />
        <TabBar screen={playerOpen ? "player" : tab} onChange={go} bottom={insets.bottom} />
      </View>

      {playerOpen && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: layerY.interpolate({ inputRange: [0, height], outputRange: [0.5, 0], extrapolate: "clamp" }) }]}
          />
          <Animated.View style={[styles.layer, { top: insets.top, backgroundColor: theme.c.bg, transform: [{ translateY: layerY }] }]}>
            <Player player={player} onClose={closePlayer} drag={{ y: layerY, settle: settlePlayer }} />
          </Animated.View>
        </>
      )}

      {player.toast && (
        <View
          style={[
            styles.toast,
            { top: insets.top + 56, backgroundColor: theme.c.surface2, borderColor: theme.c.border, borderWidth: Math.max(1, theme.border), borderRadius: theme.radius.md },
          ]}
          accessibilityLiveRegion="polite"
        >
          <T variant="caption" style={{ textAlign: "center" }}>
            {player.toast}
          </T>
        </View>
      )}
    </View>
  )
}

function Main() {
  const player = usePlayer()
  return (
    <ThemeProvider songId={player.currentId}>
      <Shell player={player} />
    </ThemeProvider>
  )
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PressStart2P_400Regular,
    VT323_400Regular,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    PixelifySans_500Medium,
    PixelifySans_700Bold,
    Sora_400Regular,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    Silkscreen_400Regular,
  })
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.ink }} />
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  layer: { position: "absolute", left: 0, right: 0, bottom: 0 },
  toast: { position: "absolute", left: 16, right: 16, padding: 12 },
})

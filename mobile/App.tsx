import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { Animated, BackHandler, Easing, Pressable, StyleSheet, useWindowDimensions, View } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
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
import { Drawer } from "./src/components/Drawer"
import Intro from "./src/components/Intro"
import { motion, T } from "./src/components/ui"
import Home, { Section, sectionLists } from "./src/screens/Home"
import { SleepSheet, sleepLabel } from "./src/screens/player/shared"
import Player from "./src/screens/Player"
import Playlists from "./src/screens/Playlists"
import Recap from "./src/screens/Recap"
import Scan from "./src/screens/Scan"
import Themes from "./src/screens/Themes"
import { DeviceLibrary, useDeviceLibrary } from "./src/library/useDeviceLibrary"
import { ArtProvider } from "./src/components/Art"
import { useInfoStore } from "./src/online/store"
import { SongInfo, useSongInfo } from "./src/online/useSongInfo"
import { PlaylistsApi, usePlaylists } from "./src/playlists"
import { Period, periodLabel } from "./src/recap"
import { Listening, useListening } from "./src/useListening"
import { PlayerApi, usePlayer } from "./src/usePlayer"
import { useNowPlaying } from "./src/useNowPlaying"
import { ThemeProvider, useThemeControl } from "./src/themes/ThemeContext"
import { colors } from "./src/theme"

const SNAP_DISMISSED_KEY = "retro-beats:snaptube-notice-dismissed"

type Tab = Exclude<Screen, "player">
const TAB_INDEX: Record<Tab, number> = { home: 0, scan: 1, themes: 2, playlists: 3, recap: 4 }

function Shell({ player, lib, info, playlists, listening }: { player: PlayerApi; lib: DeviceLibrary; info: SongInfo; playlists: PlaylistsApi; listening: Listening }) {
  const { theme, ready } = useThemeControl()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [intro, setIntro] = useState(true)
  const [tab, setTab] = useState<Tab>("home")
  const [dir, setDir] = useState(1)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [section, setSection] = useState<Section>("added")
  const [menuOpen, setMenuOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  // The month or year to open the recap on, when it was opened from the "ready" notice
  const [recapStart, setRecapStart] = useState<Period | null>(null)
  // The notice that offers to bring the covers of SnapTube downloads can be dismissed for good
  const [snapDismissed, setSnapDismissed] = useState<boolean | null>(null)
  useEffect(() => {
    AsyncStorage.getItem(SNAP_DISMISSED_KEY)
      .then((v) => setSnapDismissed(v === "1"))
      .catch(() => setSnapDismissed(false))
  }, [])
  // Tab screens fade and slide in; the player is a layer that slides up over them
  const [enter] = useState(() => new Animated.Value(1))
  const [layerY] = useState(() => new Animated.Value(height))

  useNowPlaying(player, theme)
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(sectionLists(player.library)).map(([k, v]) => [k, v.length])) as Record<Section, number>,
    [player.library],
  )

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

  // Android back (button or edge swipe): close the menu or the player first, then return to Home, then let the OS exit
  const onBack = useEffectEvent(() => {
    if (menuOpen) setMenuOpen(false)
    else if (playerOpen) closePlayer()
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
          {tab === "home" && <Home player={player} lib={lib} section={section} onOpenPlayer={() => go("player")} onOpenMenu={() => setMenuOpen(true)} onOpenScan={() => go("scan")} />}
          {tab === "themes" && <Themes />}
          {tab === "recap" && <Recap listening={listening} initial={recapStart} />}
          {tab === "playlists" && <Playlists playlists={playlists} player={player} onOpenPlayer={() => go("player")} />}
          {tab === "scan" && <Scan lib={lib} player={player} info={info} onOpenHome={() => go("home")} />}
        </Animated.View>
        {tab === "home" && listening.ready && (
          <Pressable
            onPress={() => {
              setRecapStart(listening.ready)
              listening.markSeen(listening.ready!)
              go("recap")
            }}
            accessibilityRole="button"
            accessibilityLabel={`Ver tu resumen de ${periodLabel(listening.ready)}`}
            style={[styles.notice, { backgroundColor: theme.c.accent, borderRadius: theme.radius.md }]}
          >
            <T variant="caption" color={theme.c.onAccent} style={{ flex: 1, fontWeight: "700" }}>
              ¡Tu resumen de {periodLabel(listening.ready)} está listo! Tócalo para verlo.
            </T>
          </Pressable>
        )}
        {tab === "home" && !listening.ready && info.snaptubeKnown && !info.snaptubeLinked && snapDismissed === false && player.library.length > 0 && (
          <View style={[styles.notice, { backgroundColor: theme.c.surface2, borderColor: theme.c.border, borderWidth: Math.max(1, theme.border), borderRadius: theme.radius.md, gap: 10 }]}>
            <Pressable
              onPress={() => info.importThumbnails(player.library, true).then(() => info.enrichAll(player.library))}
              accessibilityRole="button"
              accessibilityLabel="Conectar SnapTube para traer las carátulas de tus descargas"
              style={{ flex: 1 }}
            >
              <T variant="caption" color={theme.c.text} style={{ fontWeight: "700" }}>
                ¿Descargas con SnapTube? Toca para traer sus carátulas.
              </T>
              <T variant="caption" color={theme.c.textMuted}>
                Elige la carpeta «db» dentro de snaptube.
              </T>
            </Pressable>
            <Pressable
              onPress={() => {
                setSnapDismissed(true)
                AsyncStorage.setItem(SNAP_DISMISSED_KEY, "1").catch(() => {})
              }}
              accessibilityRole="button"
              accessibilityLabel="No volver a mostrar este aviso"
              hitSlop={10}
            >
              <T variant="caption" color={theme.c.textMuted}>
                Ahora no
              </T>
            </Pressable>
          </View>
        )}
        {tab === "home" && info.thumbs && (
          <View style={[styles.notice, { backgroundColor: theme.c.surface2, borderRadius: theme.radius.md }]}>
            <T variant="caption" color={theme.c.text}>
              Trayendo carátulas de SnapTube… {info.thumbs.done}/{info.thumbs.total}
            </T>
          </View>
        )}
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
            <Player player={player} info={info} playlists={playlists} onClose={closePlayer} drag={{ y: layerY, settle: settlePlayer }} />
          </Animated.View>
        </>
      )}

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        section={section}
        counts={counts}
        onSection={(s) => {
          setSection(s)
          setMenuOpen(false)
          go("home")
        }}
        libraryCount={player.library.length}
        phoneCount={lib.tracks.length}
        playlistCount={playlists.lists.length}
        onMix={() => {
          setMenuOpen(false)
          player.playMix()
          go("player")
        }}
        onShortcut={(s) => {
          setMenuOpen(false)
          if (s === "sleep") setSleepOpen(true)
          else go(s)
        }}
        sleepLabel={sleepLabel(player.sleep)}
      />
      <SleepSheet player={player} visible={sleepOpen} onClose={() => setSleepOpen(false)} />

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
  const lib = useDeviceLibrary()
  const store = useInfoStore()
  const player = usePlayer(lib.tracks, store.meta)
  const info = useSongInfo(store, player.current)
  const playlists = usePlaylists()
  const listening = useListening(player)
  // Lyrics files found beside songs are read as soon as the songs are known
  const readLyricFiles = useEffectEvent(() => info.importLyricsFiles(player.library))
  useEffect(() => {
    if (store.hydrated && player.library.length) readLyricFiles()
  }, [store.hydrated, player.library.length])
  // Covers fill in on their own: first the downloader's thumbnails, then the online search for what is still bare
  const fillCovers = useEffectEvent(async () => {
    if (info.snaptubeLinked) await info.importThumbnails(player.library, false)
    await info.enrichAll(player.library)
  })
  const coversStarted = useRef(false)
  useEffect(() => {
    if (coversStarted.current || !store.hydrated || !store.enabled || !info.snaptubeKnown || !player.library.length) return
    coversStarted.current = true
    fillCovers()
  }, [store.hydrated, store.enabled, info.snaptubeKnown, player.library.length])
  return (
    <ArtProvider value={store.meta}>
      <ThemeProvider songId={player.currentId}>
        <Shell player={player} lib={lib} info={info} playlists={playlists} listening={listening} />
      </ThemeProvider>
    </ArtProvider>
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
  notice: { marginHorizontal: 16, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" },
})

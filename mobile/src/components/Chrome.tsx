import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, PanResponder, StyleSheet, useWindowDimensions, View } from "react-native"
import { Marquee } from "./Marquee"
import { Equalizer } from "./Pixel"
import { Cover, Icon, IconName, PixelCorners, PlayButton, Press, T } from "./ui"
import { useTheme } from "../themes/ThemeContext"
import { PlayerApi, usePlaybackTime } from "../usePlayer"

export type Screen = "home" | "player" | "scan" | "themes" | "playlists" | "recap"

const TABS: { key: Screen; label: string; icon: IconName }[] = [
  { key: "home", label: "Inicio", icon: "home" },
  { key: "player", label: "Canción", icon: "player" },
  { key: "playlists", label: "Listas", icon: "playlist" },
  { key: "themes", label: "Temas", icon: "themes" },
]

const DOT = 48
const DOCK_PAD = 6
// The dip cut into the top edge of the dock under the open tab, its rounded shoulders, and how far the marker rises
const NOTCH = 62
const FILLET = 10
const LIFT = 6
// Room above the dock for the half of the marker that sticks out
const TOP = 32

/**
 * The bar of tabs: a floating dock with each tab's icon and name. Under the open tab the dock's top edge dips into a
 * round notch and the tab's icon rises out of it in a marker of the accent colour; on a tab change the notch and the
 * marker slide together to the new tab. The notch is a circle painted in the screen's background over the dock, with
 * two small rounded shoulders, so it all moves on the native driver. The marker is round in every theme; pixel themes
 * keep the dock's stepped corners and glowing themes make the marker glow. The
 * slide eases out, the marker dips a little halfway, and the icons and names cross-fade with its position. Besides tapping a button, the person can slide a finger along the dock: the marker follows the
 * finger and the tab under it opens on release. A drag upwards opens the player.
 */
export function TabBar({ screen, onChange, bottom, onSwipeUp }: { screen: Screen; onChange: (s: Screen) => void; bottom: number; onSwipeUp?: () => void }) {
  const theme = useTheme()
  const { width } = useWindowDimensions()
  const notched = theme.nav === "blocks"
  const dock = theme.shadow === "soft" ? theme.c.surface : theme.c.surface2
  // The tab under the finger while it slides along the bar
  const [hover, setHover] = useState<number | null>(null)
  const active = hover ?? Math.max(0, TABS.findIndex((t) => t.key === screen))
  const [dockWidth, setDockWidth] = useState(0)
  const [pos] = useState(() => new Animated.Value(active))
  useEffect(() => {
    // The same eased glide in every theme (pixel themes too): stepping it looked like the marker was jumping
    Animated.timing(pos, { toValue: active, duration: 340, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start()
  }, [active, pos])
  const slot = (dockWidth - DOCK_PAD * 2) / TABS.length
  // Halfway between two tabs the marker sinks a little into the dip and comes back up at the new tab
  const travel = Animated.modulo(pos, 1).interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.86, 1] })
  const latest = useRef({ screen, onChange, onSwipeUp, width })
  useEffect(() => {
    latest.current = { screen, onChange, onSwipeUp, width }
  })
  // The dock sits 16 dp in from each edge of the screen, with its own padding inside
  const under = (x: number) => Math.max(0, Math.min(TABS.length - 1, Math.floor(((x - 16 - DOCK_PAD) / (latest.current.width - 32 - DOCK_PAD * 2)) * TABS.length)))
  // `latest` is only read inside the gesture callbacks, never while drawing
  /* eslint-disable react-hooks/refs */
  const slide = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => (Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4) || (g.dy < -24 && -g.dy > Math.abs(g.dx) * 1.6),
        onPanResponderGrant: (e) => setHover(under(e.nativeEvent.pageX)),
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) > Math.abs(g.dy)) setHover(under(g.moveX))
        },
        onPanResponderRelease: (_, g) => {
          setHover(null)
          const { screen: now, onChange: change, onSwipeUp: up } = latest.current
          if (Math.abs(g.dx) > Math.abs(g.dy)) {
            const next = TABS[under(g.moveX)].key
            if (next !== now) change(next)
          } else if (g.dy < -50 || g.vy < -0.6) up?.()
        },
        onPanResponderTerminate: () => setHover(null),
      }),
    [],
  )
  /* eslint-enable react-hooks/refs */
  const bg = theme.c.bg
  // Everything that slides is laid out around the first tab and moved by whole slots
  const firstCentre = 16 + DOCK_PAD + slot / 2
  const span = NOTCH + FILLET * 2
  return (
    <View {...slide.panHandlers} style={{ paddingHorizontal: 16, paddingTop: TOP, paddingBottom: bottom + 10 }}>
      <View
        accessibilityRole="tablist"
        onLayout={(e) => setDockWidth(e.nativeEvent.layout.width)}
        style={[
          styles.dock,
          { backgroundColor: dock, borderRadius: notched ? 0 : 26 },
          theme.shadow === "soft" && { elevation: 6, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
        ]}
      >
        {TABS.map((t, i) => (
          <TabItem key={t.key} tab={t} index={i} pos={pos} on={active === i} onPress={() => onChange(t.key)} />
        ))}
        {/* The dip lives inside the dock, so the dock's own corners clip it at the first and last tab */}
        {dockWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.notchLayer, { left: DOCK_PAD + slot / 2 - span / 2, top: -NOTCH / 2, width: span, transform: [{ translateX: Animated.multiply(pos, slot) }] }]}
          >
            <View style={{ position: "absolute", left: FILLET, top: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: bg }} />
            {/* Rounded shoulders where the dip meets the top edge of the dock */}
            <View style={[styles.fillet, { left: 0, backgroundColor: bg }]}>
              <View style={{ position: "absolute", left: -FILLET, top: 0, width: FILLET * 2, height: FILLET * 2, borderRadius: FILLET, backgroundColor: dock }} />
            </View>
            <View style={[styles.fillet, { right: 0, backgroundColor: bg }]}>
              <View style={{ position: "absolute", left: 0, top: 0, width: FILLET * 2, height: FILLET * 2, borderRadius: FILLET, backgroundColor: dock }} />
            </View>
          </Animated.View>
        )}
        {notched && <PixelCorners step={5} color={bg} />}
      </View>
      {dockWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dot,
            {
              left: firstCentre - DOT / 2,
              top: TOP - LIFT - DOT / 2,
              backgroundColor: theme.c.accent,
              transform: [{ translateX: Animated.multiply(pos, slot) }, { scale: travel }],
            },
            // Glowing themes light the marker up; the others keep it a clean disc
            theme.shadow === "glow" && { shadowColor: theme.c.accent, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
          ]}
        >
          {/* Every tab's icon is in the marker and each one fades in as the marker reaches its tab */}
          {TABS.map((t, i) => (
            <Animated.View key={t.key} style={[StyleSheet.absoluteFill, styles.centre, { opacity: near(pos, i) }]}>
              <Icon name={t.icon} size={24} color={theme.c.onAccent} />
            </Animated.View>
          ))}
        </Animated.View>
      )}
    </View>
  )
}

/** 1 while the marker is on tab `i`, fading to 0 as it moves half a tab away */
const near = (pos: Animated.Value, i: number) => pos.interpolate({ inputRange: [i - 0.6, i, i + 0.6], outputRange: [0, 1, 0], extrapolate: "clamp" })

/**
 * One tab: its icon over its name. As the marker arrives, the icon here fades out (it is lifted into the marker) and
 * the name fades to the accent colour; both follow the marker's position, so they cross-fade with the slide.
 */
function TabItem({ tab, index, pos, on, onPress }: { tab: (typeof TABS)[number]; index: number; pos: Animated.Value; on: boolean; onPress: () => void }) {
  const theme = useTheme()
  const here = near(pos, index)
  const label = { fontSize: Math.min(theme.type.label.size, 11) }
  return (
    <Press
      onPress={onPress}
      radius={16}
      scaleTo={0.9}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: on }}
      style={styles.tab}
    >
      <Animated.View style={{ opacity: Animated.subtract(1, here) }}>
        <Icon name={tab.icon} size={24} color={theme.c.textMuted} />
      </Animated.View>
      <View>
        <T variant="label" numberOfLines={1} color={theme.c.textMuted} style={label}>
          {tab.label}
        </T>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: here }]}>
          <T variant="label" numberOfLines={1} color={theme.c.accent} style={label}>
            {tab.label}
          </T>
        </Animated.View>
      </View>
    </Press>
  )
}

export function MiniPlayer({ player, onOpen }: { player: PlayerApi; onOpen: () => void }) {
  const theme = useTheme()
  const { current, playing } = player
  if (!current) return null
  return (
    <View
      style={[
        styles.mini,
        {
          backgroundColor: theme.c.surface2,
          borderRadius: theme.radius.md,
          borderWidth: theme.border,
          borderColor: theme.c.border,
        },
      ]}
    >
      <View style={styles.miniBody}>
        <Press style={styles.miniMain} radius={theme.radius.sm} scaleTo={0.98} onPress={onOpen} accessibilityLabel="Abrir reproductor">
          <Cover seed={current.id} size={40} behind={theme.c.surface2} />
          <View style={{ flex: 1 }}>
            <Marquee variant="title" style={{ fontSize: Math.min(theme.type.title.size, 14), lineHeight: 20 }} moving={playing}>
              {current.title}
            </Marquee>
            <Marquee variant="caption" color={theme.c.warm} moving={playing}>
              {current.artist}
            </Marquee>
          </View>
          <Equalizer playing={playing} bars={4} height={16} color={theme.c.accent} />
        </Press>
        <PlayButton playing={playing} onPress={player.togglePlaying} size={44} behind={theme.c.surface2} />
      </View>
      <MiniProgress player={player} />
    </View>
  )
}

/** The thin bar under the mini player. It alone follows the running time, so the rest is not redrawn four times a second. */
function MiniProgress({ player }: { player: PlayerApi }) {
  const theme = useTheme()
  const time = usePlaybackTime(player)
  const progress = player.duration ? Math.min(1, time / player.duration) : 0
  const pct = `${progress * 100}%` as const
  const corner = theme.pixelCorners ? 0 : 99

  // Each theme draws the mini player's bar the way its full player draws the timeline
  if (theme.progress === "segments") {
    const n = 20
    const filled = Math.round(progress * n)
    return (
      <View style={{ flexDirection: "row", gap: 2, paddingHorizontal: 10, paddingBottom: 8 }}>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: theme.pixelCorners ? 0 : 2, backgroundColor: i < filled ? theme.c.accent : theme.c.surface }} />
        ))}
      </View>
    )
  }
  if (theme.progress === "blocks") {
    return (
      <View style={{ height: 8, backgroundColor: theme.c.surface, borderTopWidth: theme.border, borderColor: theme.c.border }}>
        <View style={{ width: pct, flex: 1, backgroundColor: theme.c.accent }} />
      </View>
    )
  }
  if (theme.progress === "glow") {
    return (
      <View style={{ paddingHorizontal: 12, paddingBottom: 9, justifyContent: "center" }}>
        <View style={{ height: 3, borderRadius: corner, backgroundColor: theme.c.surface }}>
          <View style={{ width: pct, height: 3, borderRadius: corner, backgroundColor: theme.c.accent, shadowColor: theme.c.accent, shadowOpacity: 1, shadowRadius: 6, elevation: 6 }} />
        </View>
      </View>
    )
  }
  if (theme.progress === "wave") {
    return (
      <View style={{ paddingHorizontal: 12, paddingBottom: 9, justifyContent: "center" }}>
        <View style={{ height: 6, borderRadius: corner, backgroundColor: theme.c.surface }}>
          <View style={{ width: pct, height: 6, borderRadius: corner, backgroundColor: theme.c.accent }} />
          <View style={{ position: "absolute", left: pct, marginLeft: -2, top: -3, width: 4, height: 12, borderRadius: 2, backgroundColor: theme.c.accent }} />
        </View>
      </View>
    )
  }
  return (
    <View style={{ height: 3, backgroundColor: theme.c.surface }}>
      <View style={{ width: pct, height: 3, backgroundColor: theme.c.accent }} />
    </View>
  )
}

const styles = StyleSheet.create({
  dock: { flexDirection: "row", paddingHorizontal: DOCK_PAD, overflow: "hidden" },
  notchLayer: { position: "absolute", height: NOTCH },
  fillet: { position: "absolute", top: NOTCH / 2, width: FILLET, height: FILLET, overflow: "hidden" },
  dot: { position: "absolute", width: DOT, height: DOT, borderRadius: DOT / 2, overflow: "hidden" },
  centre: { alignItems: "center", justifyContent: "center" },
  tab: { flex: 1, alignItems: "center", paddingTop: 12, paddingBottom: 9, gap: 4 },
  mini: { marginHorizontal: 8, marginBottom: 8, overflow: "hidden" },
  miniBody: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8 },
  miniMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
})

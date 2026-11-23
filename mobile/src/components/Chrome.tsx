import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, PanResponder, StyleSheet, useWindowDimensions, View } from "react-native"
import { Marquee } from "./Marquee"
import { Equalizer } from "./Pixel"
import { Cover, Icon, IconName, motion, PixelCorners, PlayButton, Press, T } from "./ui"
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
 * two small rounded shoulders, so it all moves on the native driver. Each theme draws it its own way: pixel themes
 * use a square notch and marker and move them in steps, sticker themes give the marker a flat shadow, glowing themes
 * make it glow. Besides tapping a button, the person can slide a finger along the dock: the marker follows the
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
    motion(theme, pos, active, 240).start()
  }, [active, pos, theme])
  const slot = (dockWidth - DOCK_PAD * 2) / TABS.length
  const dotRadius = notched ? 0 : DOT / 2
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
  const sticker = theme.shadow === "solid"
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
          <TabItem key={t.key} tab={t} on={active === i} onPress={() => onChange(t.key)} />
        ))}
        {notched && <PixelCorners step={5} color={bg} />}
      </View>
      {dockWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.notchLayer, { left: firstCentre - span / 2, top: TOP - NOTCH / 2, width: span, transform: [{ translateX: Animated.multiply(pos, slot) }] }]}
        >
          <View style={{ position: "absolute", left: FILLET, top: 0, width: NOTCH, height: NOTCH, borderRadius: notched ? 0 : NOTCH / 2, backgroundColor: bg }} />
          {!notched && (
            <>
              {/* Rounded shoulders where the dip meets the top edge of the dock */}
              <View style={[styles.fillet, { left: 0, backgroundColor: bg }]}>
                <View style={{ position: "absolute", left: -FILLET, top: 0, width: FILLET * 2, height: FILLET * 2, borderRadius: FILLET, backgroundColor: dock }} />
              </View>
              <View style={[styles.fillet, { right: 0, backgroundColor: bg }]}>
                <View style={{ position: "absolute", left: 0, top: 0, width: FILLET * 2, height: FILLET * 2, borderRadius: FILLET, backgroundColor: dock }} />
              </View>
            </>
          )}
          <View
            style={[
              styles.dot,
              { left: (span - DOT) / 2, top: NOTCH / 2 - LIFT - DOT / 2, borderRadius: dotRadius, backgroundColor: theme.c.accent },
              // Sticker themes press the marker onto a flat shadow; glowing themes light it up
              sticker && { borderBottomWidth: 4, borderRightWidth: 4, borderColor: theme.shadowColor },
              theme.shadow === "glow" && { shadowColor: theme.c.accent, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
            ]}
          >
            <Icon name={TABS[active].icon} size={24} color={theme.c.onAccent} />
            {notched && <PixelCorners step={4} color={bg} />}
          </View>
        </Animated.View>
      )}
    </View>
  )
}

/** One tab: its icon over its name. The open tab's icon is lifted into the marker, so here only its name stays, in the accent. */
function TabItem({ tab, on, onPress }: { tab: (typeof TABS)[number]; on: boolean; onPress: () => void }) {
  const theme = useTheme()
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
      <View style={{ opacity: on ? 0 : 1 }}>
        <Icon name={tab.icon} size={24} color={theme.c.textMuted} />
      </View>
      <T variant="label" numberOfLines={1} color={on ? theme.c.accent : theme.c.textMuted} style={{ fontSize: Math.min(theme.type.label.size, 11) }}>
        {tab.label}
      </T>
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
  dot: { position: "absolute", width: DOT, height: DOT, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tab: { flex: 1, alignItems: "center", paddingTop: 12, paddingBottom: 9, gap: 4 },
  mini: { marginHorizontal: 8, marginBottom: 8, overflow: "hidden" },
  miniBody: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8 },
  miniMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
})

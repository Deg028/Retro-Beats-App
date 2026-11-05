import { useEffect, useState } from "react"
import { Animated, StyleSheet, View } from "react-native"
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

export function TabBar({ screen, onChange, bottom }: { screen: Screen; onChange: (s: Screen) => void; bottom: number }) {
  const theme = useTheme()
  const blocks = theme.nav === "blocks"
  const bar = blocks || theme.nav === "indicator" ? theme.c.surface : theme.c.bg
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.tabs,
        {
          paddingBottom: bottom + 8,
          paddingHorizontal: 6,
          backgroundColor: bar,
          borderTopWidth: Math.max(theme.border, theme.nav === "plain" ? 1 : 0),
          borderTopColor: theme.c.border,
        },
      ]}
    >
      {TABS.map((t) => (
        <TabItem key={t.key} tab={t} on={screen === t.key} bar={bar} onPress={() => onChange(t.key)} />
      ))}
    </View>
  )
}

/** One tab: the logo sits in a rounded bubble that fills with the accent and lifts when the tab is active. */
function TabItem({ tab, on, bar, onPress }: { tab: (typeof TABS)[number]; on: boolean; bar: string; onPress: () => void }) {
  const theme = useTheme()
  const [lift] = useState(() => new Animated.Value(on ? 1 : 0))
  useEffect(() => {
    motion(theme, lift, on ? 1 : 0, 220).start()
  }, [on, lift, theme])

  const blocks = theme.nav === "blocks"
  const plain = theme.nav === "plain"
  // Pixel themes keep their notched corners; the others get a pill, never a hard square
  const notched = theme.pixelCorners
  const radius = notched ? 0 : 18
  const color = on ? theme.c.onAccent : plain ? theme.c.textMuted : theme.c.text
  const fill = on ? theme.c.accent : blocks ? theme.c.surface2 : "transparent"
  const labelColor = on ? (plain ? theme.c.accent : theme.c.text) : theme.c.textMuted

  return (
    <Press
      onPress={onPress}
      radius={20}
      scaleTo={0.9}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: on }}
      style={styles.tab}
    >
      <Animated.View
        style={[
          styles.bubble,
          {
            borderRadius: radius,
            backgroundColor: fill,
            borderWidth: blocks || on ? theme.border : 0,
            borderColor: on && !blocks ? "transparent" : theme.c.border,
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
            ],
          },
          on && { shadowColor: theme.c.accent, shadowOpacity: blocks ? 0 : 0.5, shadowRadius: 8, elevation: blocks ? 0 : 5 },
        ]}
      >
        <Icon name={tab.icon} size={24} color={color} />
        {notched && <PixelCorners step={3} color={bar} />}
      </Animated.View>
      <T variant="label" color={labelColor} style={{ fontSize: Math.min(theme.type.label.size, 11) }}>
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
  tabs: { flexDirection: "row", paddingTop: 10 },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  bubble: { width: 60, height: 36, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  mini: { marginHorizontal: 8, marginBottom: 8, overflow: "hidden" },
  miniBody: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8 },
  miniMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
})

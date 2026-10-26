import { StyleSheet, View } from "react-native"
import { Equalizer } from "./Pixel"
import { Cover, Icon, IconName, PlayButton, Press, T } from "./ui"
import { useTheme } from "../themes/ThemeContext"
import { PlayerApi, usePlaybackTime } from "../usePlayer"

export type Screen = "home" | "player" | "scan" | "themes" | "playlists" | "recap"

const TABS: { key: Screen; label: string; icon: IconName }[] = [
  { key: "home", label: "Inicio", icon: "home" },
  { key: "player", label: "Canción", icon: "player" },
  { key: "scan", label: "Música", icon: "queue" },
  { key: "themes", label: "Temas", icon: "themes" },
]

export function TabBar({ screen, onChange, bottom }: { screen: Screen; onChange: (s: Screen) => void; bottom: number }) {
  const theme = useTheme()
  const blocks = theme.nav === "blocks"
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.tabs,
        {
          paddingBottom: bottom + 8,
          gap: blocks ? 6 : 0,
          paddingHorizontal: blocks ? 10 : 0,
          backgroundColor: blocks || theme.nav === "indicator" ? theme.c.surface : theme.c.bg,
          borderTopWidth: Math.max(theme.border, theme.nav === "plain" ? 1 : 0),
          borderTopColor: theme.c.border,
        },
      ]}
    >
      {TABS.map((t) => {
        const on = screen === t.key
        const color = blocks ? (on ? theme.c.onAccent : theme.c.text) : on ? (theme.nav === "plain" ? theme.c.accent : theme.c.text) : theme.c.textMuted
        return (
          <Press
            key={t.key}
            onPress={() => onChange(t.key)}
            radius={blocks ? theme.radius.sm : 16}
            scaleTo={0.9}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            style={[
              styles.tab,
              blocks && {
                paddingVertical: 6,
                borderRadius: theme.radius.sm,
                borderWidth: theme.border,
                borderColor: theme.c.border,
                backgroundColor: on ? theme.c.accent : theme.c.surface2,
              },
            ]}
          >
            <View style={[styles.indicator, theme.nav === "indicator" && on && { backgroundColor: theme.c.surface2 }]}>
              <Icon name={t.icon} size={22} color={color} />
            </View>
            <T variant="label" color={color} style={{ fontSize: Math.min(theme.type.label.size, 11) }}>
              {t.label}
            </T>
          </Press>
        )
      })}
    </View>
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
            <T variant="title" numberOfLines={1} style={{ fontSize: Math.min(theme.type.title.size, 14), lineHeight: 20 }}>
              {current.title}
            </T>
            <T variant="caption" numberOfLines={1} color={theme.c.warm}>
              {current.artist}
            </T>
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
  return (
    <View style={{ height: 3, backgroundColor: theme.c.surface }}>
      <View style={{ width: `${progress * 100}%`, height: 3, backgroundColor: theme.c.accent }} />
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", paddingTop: 10 },
  tab: { flex: 1, alignItems: "center", gap: 4 },
  indicator: { width: 56, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  mini: { marginHorizontal: 8, marginBottom: 8, overflow: "hidden" },
  miniBody: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8 },
  miniMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
})

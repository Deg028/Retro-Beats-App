import { useEffect, useRef, useState } from "react"
import { Animated, Easing, GestureResponderEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Icon, IconName, motion, PixelCorners, Press, T } from "./ui"
import { useTheme } from "../themes/ThemeContext"
import { CATEGORY_LABEL } from "../themes/themes"
import { Section, SECTIONS } from "../screens/Home"
import { VERSION_LABEL } from "../version"

type Shortcut = "themes" | "scan" | "sleep" | "playlists" | "recap"

/**
 * Side menu that slides in from the left over the whole app: brand header, a featured mix card,
 * the Home sections and shortcuts. Closes on the backdrop, the back button or a swipe to the left.
 */
export function Drawer({
  open,
  onClose,
  section,
  counts,
  onSection,
  libraryCount,
  phoneCount,
  playlistCount,
  onMix,
  onShortcut,
  sleepLabel,
}: {
  open: boolean
  onClose: () => void
  section: Section
  counts: Record<Section, number>
  onSection: (s: Section) => void
  libraryCount: number
  phoneCount: number
  playlistCount: number
  onMix: () => void
  onShortcut: (s: Shortcut) => void
  sleepLabel: string | null
}) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const panel = Math.min(340, Math.round(width * 0.8))
  const [x] = useState(() => new Animated.Value(-panel))
  // Stay mounted until the closing animation ends
  const [visible, setVisible] = useState(open)
  if (open && !visible) setVisible(true)

  useEffect(() => {
    if (open) motion(theme, x, 0, 260).start()
    else
      (theme.motion === "stepped" ? motion(theme, x, -panel, 220) : Animated.timing(x, { toValue: -panel, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true })).start(
        ({ finished }) => finished && setVisible(false),
      )
  }, [open, x, panel, theme])

  const start = useRef({ x: 0, y: 0 })
  const dx = (e: GestureResponderEvent) => e.nativeEvent.pageX - start.current.x
  const swipe: ViewProps = {
    onTouchStart: (e) => {
      start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
    },
    onMoveShouldSetResponderCapture: (e) => dx(e) < -10 && Math.abs(dx(e)) > Math.abs(e.nativeEvent.pageY - start.current.y),
    onResponderMove: (e) => x.setValue(Math.min(0, dx(e))),
    onResponderRelease: (e) => (dx(e) < -panel / 4 ? onClose() : motion(theme, x, 0, 160).start()),
    onResponderTerminate: () => motion(theme, x, 0, 160).start(),
  }

  if (!visible) return null

  const row = (key: string, icon: IconName, label: string, onPress: () => void, opts: { active?: boolean; trailing?: string } = {}) => (
    <Press
      key={key}
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: !!opts.active }}
      radius={theme.radius.md}
      scaleTo={0.97}
      style={[styles.row, { borderRadius: theme.radius.md }, opts.active && { backgroundColor: theme.c.accent }]}
    >
      <Icon name={icon} size={24} color={opts.active ? theme.c.onAccent : theme.c.text} />
      <T variant="body" color={opts.active ? theme.c.onAccent : theme.c.text} style={{ flex: 1 }} numberOfLines={2}>
        {label}
      </T>
      {opts.trailing !== undefined && (
        <T variant="number" color={opts.active ? theme.c.onAccent : theme.c.textMuted}>
          {opts.trailing}
        </T>
      )}
    </Press>
  )
  const divider = <View style={[styles.divider, { backgroundColor: theme.c.border }]} />
  const square = theme.pixelCorners || theme.radius.md === 0

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: x.interpolate({ inputRange: [-panel, 0], outputRange: [0, 0.55], extrapolate: "clamp" }) }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar menú" />
      </Animated.View>

      <Animated.View
        {...swipe}
        accessibilityViewIsModal
        style={[
          styles.panel,
          {
            width: panel,
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 12,
            backgroundColor: theme.c.surface,
            borderRightWidth: theme.border,
            borderColor: theme.c.border,
            borderTopRightRadius: theme.radius.lg,
            borderBottomRightRadius: theme.radius.lg,
            transform: [{ translateX: x }],
          },
        ]}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <T variant="display" style={{ flex: 1 }}>
              {"Retro\nBeats"}
            </T>
            <View style={[styles.logo, { borderRadius: square ? 0 : 34, backgroundColor: theme.c.accent, borderColor: theme.c.highlight }]}>
              <Icon name="player" size={30} color={theme.c.onAccent} />
              {square && <PixelCorners step={5} color={theme.c.surface} />}
            </View>
          </View>

          <Press
            onPress={onMix}
            disabled={!libraryCount}
            accessibilityRole="button"
            accessibilityLabel="Reproducir mix aleatorio"
            radius={theme.radius.lg}
            style={[styles.card, { borderRadius: theme.radius.lg, backgroundColor: theme.c.accent, opacity: libraryCount ? 1 : 0.5 }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="title" color={theme.c.onAccent}>
                Mix aleatorio
              </T>
              <T variant="caption" color={theme.c.onAccent}>
                {libraryCount} temas en tu biblioteca
              </T>
            </View>
            <View style={[styles.cardArrow, { borderRadius: square ? 0 : 20, borderColor: theme.c.onAccent }]}>
              <Icon name="arrow" size={20} color={theme.c.onAccent} />
            </View>
          </Press>

          <T variant="label" color={theme.c.textMuted} style={styles.heading}>
            Tu música
          </T>
          {SECTIONS.map((s) => row(s.key, s.icon, s.label, () => onSection(s.key), { active: s.key === section, trailing: String(counts[s.key]) }))}

          {divider}
          {row("playlists", "playlist", "Listas de reproducción", () => onShortcut("playlists"), { trailing: String(playlistCount) })}
          {row("recap", "stats", "Resumen de escucha", () => onShortcut("recap"))}
          {row("scan", "player", "Música del teléfono", () => onShortcut("scan"), { trailing: String(phoneCount) })}
          {row("sleep", "moon", "Temporizador de apagado", () => onShortcut("sleep"), { trailing: sleepLabel ?? undefined })}
          {row("themes", "themes", `Temas · ${theme.name}`, () => onShortcut("themes"))}
          <T variant="caption" color={theme.c.textMuted} style={{ paddingHorizontal: 12, marginTop: 2 }}>
            {CATEGORY_LABEL[theme.category]} · cambia colores, letras y animaciones
          </T>
          <T variant="caption" color={theme.c.textMuted} style={{ paddingHorizontal: 12, marginTop: 18, marginBottom: 8, textAlign: "center" }}>
            Retro Beats · {VERSION_LABEL}
          </T>
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { position: "absolute", top: 0, bottom: 0, left: 0, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, marginBottom: 16 },
  logo: { width: 68, height: 68, borderWidth: 6, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 18, paddingHorizontal: 18, marginBottom: 12 },
  cardArrow: { width: 44, height: 34, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  heading: { paddingHorizontal: 12, marginTop: 4, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 52, paddingVertical: 6, paddingHorizontal: 12 },
  divider: { height: 1, marginVertical: 10, marginHorizontal: 8 },
})

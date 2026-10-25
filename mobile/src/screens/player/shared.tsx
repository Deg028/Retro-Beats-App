import { ReactNode, useEffect, useRef, useState } from "react"
import {
  Animated,
  Easing,
  FlatList,
  GestureResponderEvent,
  LayoutChangeEvent,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewProps,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fmt, LyricLine, Song } from "../../data"
import { Equalizer } from "../../components/Pixel"
import { Cover, Icon, Press, T } from "../../components/ui"
import { useTheme } from "../../themes/ThemeContext"
import { PlayerApi } from "../../usePlayer"

/**
 * Draggable seek: the bar follows the finger and only seeks the audio on release.
 * The bar's children must use pointerEvents="none" so locationX is measured on the bar itself.
 */
export function useSeek(time: number, duration: number, onSeek: (s: number) => void) {
  const [width, setWidth] = useState(0)
  const [drag, setDrag] = useState<number | null>(null)
  // Seconds just sought to; shown until the player's position catches up, so the thumb doesn't jump back
  const [held, setHeld] = useState<number | null>(null)
  const start = useRef({ loc: 0, page: 0 })

  const ratio = (x: number) => Math.max(0, Math.min(1, x / (width || 1)))
  const at = (e: GestureResponderEvent) => ratio(start.current.loc + e.nativeEvent.pageX - start.current.page)
  const panHandlers: ViewProps = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e) => {
      start.current = { loc: e.nativeEvent.locationX, page: e.nativeEvent.pageX }
      setDrag(ratio(e.nativeEvent.locationX))
    },
    onResponderMove: (e) => setDrag(at(e)),
    onResponderRelease: (e) => {
      const target = at(e) * duration
      onSeek(target)
      setHeld(target)
      setDrag(null)
    },
    onResponderTerminate: () => setDrag(null),
  }

  useEffect(() => {
    if (held === null) return
    const id = setTimeout(() => setHeld(null), 1000)
    return () => clearTimeout(id)
  }, [held])

  const shown = drag !== null ? drag * duration : held !== null && Math.abs(time - held) >= 1 ? held : time
  return {
    width,
    shown,
    dragging: drag !== null,
    progress: duration ? Math.min(1, shown / duration) : 0,
    onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width),
    panHandlers,
  }
}

/** Swipe the cover left/right to change track; taps still reach the cover's Pressable. */
export function useSwipe(onNext: () => void, onPrev: () => void) {
  const [x] = useState(() => new Animated.Value(0))
  const start = useRef({ x: 0, y: 0 })
  const dx = (e: GestureResponderEvent) => e.nativeEvent.pageX - start.current.x
  const settle = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 6 }).start()
  const panHandlers: ViewProps = {
    onTouchStart: (e) => {
      start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
    },
    onMoveShouldSetResponder: (e) => Math.abs(dx(e)) > 12 && Math.abs(dx(e)) > Math.abs(e.nativeEvent.pageY - start.current.y),
    onResponderMove: (e) => x.setValue(dx(e) * 0.6),
    onResponderRelease: (e) => {
      if (dx(e) < -80) onNext()
      else if (dx(e) > 80) onPrev()
      settle()
    },
    onResponderTerminate: settle,
  }
  return { panHandlers, style: { transform: [{ translateX: x }] } }
}

/**
 * Drag down to dismiss: moves `y` with the finger and closes past a distance or on a fast flick.
 * Captures vertical drags from the buttons inside, so attach it to a bar outside any ScrollView.
 */
export function useDismiss(y: Animated.Value, onClose: () => void, onSettle: () => void) {
  const start = useRef({ x: 0, y: 0, t: 0 })
  const dy = (e: GestureResponderEvent) => e.nativeEvent.pageY - start.current.y
  const panHandlers: ViewProps = {
    onTouchStart: (e) => {
      start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now() }
    },
    onMoveShouldSetResponderCapture: (e) => dy(e) > 10 && dy(e) > Math.abs(e.nativeEvent.pageX - start.current.x) * 1.2,
    onResponderTerminationRequest: () => false,
    onResponderMove: (e) => y.setValue(Math.max(0, dy(e))),
    onResponderRelease: (e) => {
      const d = dy(e)
      const speed = d / Math.max(1, Date.now() - start.current.t)
      if (d > 140 || (d > 40 && speed > 0.7)) onClose()
      else onSettle()
    },
    onResponderTerminate: onSettle,
  }
  return panHandlers
}

/** Elapsed / total, or elapsed / remaining after a tap on the total. */
export function useTimeLabels(shown: number, duration: number) {
  const [remaining, setRemaining] = useState(false)
  return {
    elapsed: fmt(shown),
    total: remaining ? `-${fmt(Math.max(0, duration - shown))}` : fmt(duration),
    toggle: () => setRemaining((r) => !r),
  }
}

export const activeLine = (lines: LyricLine[], time: number) => {
  let i = -1
  lines.forEach((l, j) => {
    if (time >= l.t) i = j
  })
  return i
}

/** Lyrics synced to timestamps; the active line stays in a fixed slot of the window. Tap a line to jump there. */
export function LyricsWindow({
  lines,
  time,
  onSeek,
  lineH,
  visible = 3,
  slot = 1,
  lineStyle,
  activeStyle,
  dimColor,
}: {
  lines: LyricLine[]
  time: number
  onSeek: (s: number) => void
  lineH: number
  visible?: number
  slot?: number
  lineStyle: TextStyle
  activeStyle: TextStyle
  dimColor: string
}) {
  const idx = activeLine(lines, time)
  const [shift] = useState(() => new Animated.Value(slot * lineH))
  useEffect(() => {
    Animated.timing(shift, {
      toValue: (slot - Math.max(idx, 0)) * lineH,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [idx, lineH, slot, shift])

  return (
    <View style={{ height: lineH * visible, overflow: "hidden" }}>
      <Animated.View style={{ transform: [{ translateY: shift }] }}>
        {lines.map((l, i) => (
          <Text
            key={i}
            numberOfLines={1}
            onPress={() => onSeek(l.t)}
            style={[lineStyle, { height: lineH, lineHeight: lineH }, i === idx ? activeStyle : { color: dimColor }]}
          >
            {l.text}
          </Text>
        ))}
      </Animated.View>
    </View>
  )
}

export const shareSong = (song: Song) =>
  Share.share({ message: `Estoy escuchando "${song.title}" de ${song.artist} en Retro Beats` }).catch(() => {})

export const sleepLabel = (sleep: PlayerApi["sleep"]) => {
  if (!sleep) return null
  if (sleep.kind === "end") return "Fin de canción"
  return `${Math.max(1, Math.ceil((sleep.until - Date.now()) / 60_000))} min`
}

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={sh.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View
        style={[
          sh.panel,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: theme.c.surface,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            borderTopWidth: Math.max(theme.border, 0),
            borderColor: theme.c.border,
          },
        ]}
      >
        {theme.radius.lg > 0 && <View style={[sh.handle, { backgroundColor: theme.c.border }]} />}
        <T variant="title" style={{ marginBottom: 12 }}>
          {title}
        </T>
        {children}
      </View>
    </Modal>
  )
}

export function QueueSheet({ player, visible, onClose }: { player: PlayerApi; visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const { current, upNext, shuffle, repeat } = player
  const mode = [shuffle && "Aleatorio", repeat === "all" && "Repetir todo", repeat === "one" && "Repetir una"].filter(Boolean).join(" · ")
  const row = (song: Song, now: boolean) => (
    <Press
      key={song.id}
      radius={theme.radius.sm}
      scaleTo={0.97}
      onPress={() => !now && player.play(song.id)}
      accessibilityLabel={now ? `Sonando: ${song.title}` : `Reproducir ${song.title}`}
      style={[sh.row, { borderRadius: theme.radius.sm }, now && { backgroundColor: theme.c.surface2 }]}
    >
      <Cover seed={song.id} size={40} behind={now ? theme.c.surface2 : theme.c.surface} />
      <View style={{ flex: 1 }}>
        <T variant="title" numberOfLines={1} color={now ? theme.c.accent : theme.c.text} style={{ fontSize: Math.min(theme.type.title.size, 15) }}>
          {song.title}
        </T>
        <T variant="caption" numberOfLines={1} color={theme.c.textMuted}>
          {song.artist} · {fmt(song.duration)}
        </T>
      </View>
      {now ? (
        <Equalizer playing={player.playing} bars={3} height={14} color={theme.c.accent} />
      ) : (
        <Pressable onPress={() => player.removeFromQueue(song.id)} hitSlop={10} accessibilityLabel={`Quitar ${song.title} de la cola`}>
          <Icon name="close" size={20} color={theme.c.textMuted} />
        </Pressable>
      )}
    </Press>
  )
  return (
    <Sheet visible={visible} onClose={onClose} title="Cola de reproducción">
      {!!mode && (
        <T variant="caption" color={theme.c.textMuted} style={{ marginTop: -8, marginBottom: 12 }}>
          {mode}
        </T>
      )}
      {current && row(current, true)}
      <T variant="label" color={theme.c.textMuted} style={{ marginTop: 16, marginBottom: 6 }}>
        A continuación ({upNext.length})
      </T>
      <FlatList
        data={upNext}
        keyExtractor={(x) => String(x.id)}
        style={{ maxHeight: 340 }}
        renderItem={({ item }) => row(item, false)}
        ListEmptyComponent={<T variant="caption" color={theme.c.textMuted}>No hay más canciones en la cola</T>}
      />
    </Sheet>
  )
}

const SLEEP_OPTIONS: { label: string; value: number | "end" | null }[] = [
  { label: "Desactivado", value: null },
  { label: "5 minutos", value: 5 },
  { label: "15 minutos", value: 15 },
  { label: "30 minutos", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "Al terminar la canción", value: "end" },
]

export function SleepSheet({ player, visible, onClose }: { player: PlayerApi; visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const label = sleepLabel(player.sleep)
  const isOn = (v: number | "end" | null) => (v === null ? !player.sleep : v === "end" && player.sleep?.kind === "end")
  return (
    <Sheet visible={visible} onClose={onClose} title="Temporizador de apagado">
      {label && (
        <T variant="caption" color={theme.c.textMuted} style={{ marginTop: -8, marginBottom: 12 }}>
          Activo: {label}
        </T>
      )}
      {SLEEP_OPTIONS.map((o) => (
        <Press
          key={o.label}
          radius={theme.radius.sm}
          scaleTo={0.97}
          onPress={() => {
            player.setSleepTimer(o.value)
            onClose()
          }}
          style={[sh.option, { borderRadius: theme.radius.sm }, isOn(o.value) && { backgroundColor: theme.c.surface2 }]}
        >
          <T variant="body" color={isOn(o.value) ? theme.c.accent : theme.c.text}>
            {o.label}
          </T>
        </Press>
      ))}
    </Sheet>
  )
}

const sh = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  panel: { paddingHorizontal: 20, paddingTop: 12 },
  handle: { alignSelf: "center", width: 32, height: 4, borderRadius: 2, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 8 },
  option: { paddingVertical: 14, paddingHorizontal: 12 },
})

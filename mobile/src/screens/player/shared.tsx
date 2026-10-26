import { File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"
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
import { fmt, LyricLine, lengthSuffix, Song } from "../../data"
import { extensionOf } from "../../library/files"
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

/** A line lights up this long before its time stamp: sung words are heard as the line already being there. */
const LYRICS_LEAD = 0.25

/**
 * The playback time, moved on between the player's updates (it reports four times a second), so the lyrics
 * change on the beat instead of up to a quarter of a second late. Follows the real time again at every update.
 */
function useSmoothTime(time: number, playing: boolean) {
  const base = useRef({ time, at: 0 })
  const [now, setNow] = useState(time)
  useEffect(() => {
    base.current = { time, at: Date.now() }
  }, [time])
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setNow(base.current.time + (Date.now() - base.current.at) / 1000), 100)
    return () => clearInterval(id)
  }, [playing])
  // Only trust the estimate while it is just ahead of the real time: after a seek it must not hold the old place
  return playing && now >= time && now - time < 0.5 ? now : time
}

/**
 * Lyrics synced to timestamps; the active line stays in the middle of the window. Long lines wrap onto as many
 * rows as they need instead of being cut off. Tap a line to jump there.
 */
export function LyricsWindow({
  lines,
  time,
  playing,
  onSeek,
  height,
  lineStyle,
  activeStyle,
  dimColor,
}: {
  lines: LyricLine[]
  time: number
  playing: boolean
  onSeek: (s: number) => void
  height: number
  lineStyle: TextStyle
  activeStyle: TextStyle
  dimColor: string
}) {
  const idx = activeLine(lines, useSmoothTime(time, playing) + LYRICS_LEAD)
  // Where each line starts and how tall it is, measured once drawn: wrapped lines are taller than the rest
  const [boxes, setBoxes] = useState<Record<number, { y: number; h: number }>>({})
  const [shift] = useState(() => new Animated.Value(0))
  const box = boxes[Math.max(idx, 0)]
  useEffect(() => {
    if (!box) return
    Animated.timing(shift, {
      toValue: height / 2 - (box.y + box.h / 2),
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [box, height, shift])

  return (
    <View style={{ height, overflow: "hidden" }}>
      <Animated.View style={{ transform: [{ translateY: shift }] }}>
        {lines.map((l, i) => (
          <Text
            key={i}
            onPress={() => onSeek(l.t)}
            onLayout={(e) => {
              const { y, height: h } = e.nativeEvent.layout
              setBoxes((prev) => (prev[i]?.y === y && prev[i]?.h === h ? prev : { ...prev, [i]: { y, h } }))
            }}
            style={[lineStyle, { paddingVertical: 5 }, i === idx ? activeStyle : { color: dimColor, opacity: 0.65 }]}
          >
            {l.text}
          </Text>
        ))}
      </Animated.View>
    </View>
  )
}

const MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  mka: "audio/x-matroska",
  "3gp": "audio/3gpp",
  amr: "audio/amr",
}

/**
 * Sends the song's audio file to another app. The file is copied into the app's cache first: the address Android gives
 * for a song belongs to the media index or a picked folder, and share sheets can't open it from there.
 * If the file can't be handed over, a message naming the song goes instead.
 */
export async function shareSong(song: Song) {
  try {
    if (await Sharing.isAvailableAsync()) {
      const ext = extensionOf(song.file ?? song.uri) || "mp3"
      const name = `${song.title.replace(/[\/:*?"<>|]+/g, " ").trim() || "cancion"}.${ext}`
      const copy = new File(Paths.cache, name)
      if (copy.exists) copy.delete()
      new File(song.uri).copy(copy)
      await Sharing.shareAsync(copy.uri, { mimeType: MIME[ext] ?? "audio/*", dialogTitle: `Compartir "${song.title}"` })
      return
    }
  } catch {
    // falls through to the text
  }
  await Share.share({ message: `Estoy escuchando "${song.title}" de ${song.artist} en Retro Beats` }).catch(() => {})
}

const HOLD_FIRST_STEP = 10
const HOLD_DELAY_MS = 450
const HOLD_TICK_MS = 250

/**
 * A button that skips ±10 s when pressed and keeps going while it is held, faster the longer it is held
 * (10 s, then 20, 30… up to a minute per step). Each step seeks right away, so the sound follows the finger.
 */
export function HoldSeek({ dir, time, duration, onSeek }: { dir: 1 | -1; time: number; duration: number; onSeek: (s: number) => void }) {
  const theme = useTheme()
  const latest = useRef({ time, duration, onSeek })
  useEffect(() => {
    latest.current = { time, duration, onSeek }
  })
  const run = useRef<{ target: number; ticks: number; timer?: ReturnType<typeof setTimeout> }>({ target: 0, ticks: 0 })
  const step = (size: number) => {
    const { duration: d, onSeek: seek } = latest.current
    run.current.target = Math.max(0, Math.min(run.current.target + dir * size, Math.max(0, d - 1)))
    seek(run.current.target)
  }
  const tick = () => {
    run.current.ticks++
    step(HOLD_FIRST_STEP * Math.min(6, 1 + Math.floor(run.current.ticks / 6)))
    run.current.timer = setTimeout(tick, HOLD_TICK_MS)
  }
  const stop = () => clearTimeout(run.current.timer)
  useEffect(() => stop, [])
  return (
    <Press
      onPressIn={() => {
        run.current = { target: latest.current.time, ticks: 0 }
        step(HOLD_FIRST_STEP)
        run.current.timer = setTimeout(tick, HOLD_DELAY_MS)
      }}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={dir > 0 ? "Adelantar 10 segundos; mantén pulsado para avanzar más rápido" : "Retroceder 10 segundos; mantén pulsado para retroceder más rápido"}
      radius={theme.radius.sm}
      scaleTo={0.9}
      style={{ height: 36, minWidth: 64, paddingHorizontal: 12, borderRadius: theme.radius.sm, borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: theme.c.surface, alignItems: "center", justifyContent: "center" }}
    >
      <T variant="label" color={theme.c.text} style={{ textTransform: "none" }}>
        {dir > 0 ? "+10 s" : "−10 s"}
      </T>
    </Press>
  )
}

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
          {song.artist}{lengthSuffix(song.duration)}
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

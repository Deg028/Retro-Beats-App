import { ReactNode, useEffect, useState } from "react"
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons"
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg"
import { Art } from "./Art"
import { Icon as PixelIcon, ICONS } from "./Pixel"
import { useTheme } from "../themes/ThemeContext"
import { TextRole, Theme } from "../themes/themes"

// ---------- Text

export function textStyle(theme: Theme, role: TextRole): TextStyle {
  const s = theme.type[role]
  return {
    fontFamily: s.family,
    fontSize: s.size,
    lineHeight: s.line,
    fontWeight: s.family ? undefined : s.weight,
    letterSpacing: s.spacing,
    textTransform: s.upper ? "uppercase" : "none",
    color: theme.c.text,
  }
}

export function T({ variant = "body", color, style, children, ...rest }: TextProps & { variant?: TextRole; color?: string; children: ReactNode }) {
  const theme = useTheme()
  return (
    <Text {...rest} style={[textStyle(theme, variant), color ? { color } : null, style]}>
      {children}
    </Text>
  )
}

// ---------- Icons: one semantic name, drawn from the theme's icon set

export type IconName =
  | "back"
  | "more"
  | "queue"
  | "heart"
  | "heartOn"
  | "library"
  | "libraryOn"
  | "shuffle"
  | "repeat"
  | "repeatOne"
  | "prev"
  | "next"
  | "play"
  | "pause"
  | "lyrics"
  | "moon"
  | "share"
  | "home"
  | "player"
  | "catalog"
  | "themes"
  | "close"
  | "search"
  | "check"
  | "menu"
  | "top"
  | "recent"
  | "arrow"

const MI: Record<IconName, keyof typeof MaterialIcons.glyphMap> = {
  back: "keyboard-arrow-down",
  more: "more-vert",
  queue: "queue-music",
  heart: "favorite-border",
  heartOn: "favorite",
  library: "library-add",
  libraryOn: "library-add-check",
  shuffle: "shuffle",
  repeat: "repeat",
  repeatOne: "repeat-one",
  prev: "skip-previous",
  next: "skip-next",
  play: "play-arrow",
  pause: "pause",
  lyrics: "lyrics",
  moon: "bedtime",
  share: "share",
  home: "home",
  player: "album",
  catalog: "grid-view",
  themes: "palette",
  close: "close",
  search: "search",
  check: "check",
  menu: "menu",
  top: "leaderboard",
  recent: "history",
  arrow: "arrow-forward",
}

const MCI: Record<IconName, keyof typeof MaterialCommunityIcons.glyphMap> = {
  back: "chevron-down",
  more: "dots-vertical",
  queue: "playlist-music",
  heart: "heart-outline",
  heartOn: "heart",
  library: "bookmark-plus-outline",
  libraryOn: "bookmark-check",
  shuffle: "shuffle-variant",
  repeat: "repeat",
  repeatOne: "repeat-once",
  prev: "skip-previous",
  next: "skip-next",
  play: "play",
  pause: "pause",
  lyrics: "microphone-variant",
  moon: "weather-night",
  share: "share-variant",
  home: "home-variant",
  player: "album",
  catalog: "view-grid",
  themes: "palette",
  close: "close",
  search: "magnify",
  check: "check",
  menu: "menu",
  top: "chart-bar",
  recent: "history",
  arrow: "arrow-right",
}

const PX: Record<IconName, { d: string[]; filled?: boolean }> = {
  back: { d: ICONS.chevronDown },
  more: { d: ICONS.more, filled: true },
  queue: { d: ICONS.queue },
  heart: { d: ICONS.heart },
  heartOn: { d: ICONS.heart, filled: true },
  library: { d: ICONS.bookmark },
  libraryOn: { d: ICONS.bookmarkOn },
  shuffle: { d: ICONS.shuffle },
  repeat: { d: ICONS.repeatAll },
  repeatOne: { d: ICONS.repeatOne },
  prev: { d: ICONS.prev, filled: true },
  next: { d: ICONS.next, filled: true },
  play: { d: ICONS.play, filled: true },
  pause: { d: ICONS.pause, filled: true },
  lyrics: { d: ICONS.lyrics },
  moon: { d: ICONS.moon },
  share: { d: ICONS.share },
  home: { d: ICONS.home },
  player: { d: ICONS.disc },
  catalog: { d: ICONS.grid },
  themes: { d: ICONS.palette },
  close: { d: ICONS.close },
  search: { d: ICONS.search },
  check: { d: ICONS.check },
  menu: { d: ICONS.menu },
  top: { d: ICONS.bars },
  recent: { d: ICONS.clock },
  arrow: { d: ICONS.arrow },
}

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: string }) {
  const theme = useTheme()
  const tint = color ?? theme.c.text
  if (theme.icons === "pixel") return <PixelIcon d={PX[name].d} filled={PX[name].filled} color={tint} size={size * 0.85} />
  if (theme.icons === "material") return <MaterialIcons name={MI[name]} size={size} color={tint} />
  return <MaterialCommunityIcons name={MCI[name]} size={size} color={tint} />
}

// ---------- Shapes

/** Stepped corners: paints the three-step staircase of each corner in the color behind the shape. */
export function PixelCorners({ step, color }: { step: number; color: string }) {
  const bars = [3, 2, 1]
  const corners: ViewStyle[] = []
  for (const v of ["top", "bottom"] as const) {
    for (const h of ["left", "right"] as const) {
      bars.forEach((n, i) => corners.push({ position: "absolute", [v]: i * step, [h]: 0, width: n * step, height: step, backgroundColor: color }))
    }
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {corners.map((c, i) => (
        <View key={i} style={c} />
      ))}
    </View>
  )
}

/** A flat, unblurred offset shadow (retro "sticker" look); wraps a fixed-size child. */
function SolidShadow({ offset, color, radius, children }: { offset: number; color: string; radius: number; children: ReactNode }) {
  return (
    <View style={{ marginRight: offset, marginBottom: offset }}>
      <View style={{ position: "absolute", top: offset, left: offset, right: -offset, bottom: -offset, borderRadius: radius, backgroundColor: color }} />
      {children}
    </View>
  )
}

function elevation(theme: Theme, strong = false): ViewStyle {
  if (theme.shadow === "glow") return { elevation: strong ? 16 : 8, shadowColor: theme.c.accent, shadowOpacity: 0.6, shadowRadius: 16 }
  if (theme.shadow === "soft") return { elevation: strong ? 8 : 3, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }
  return {}
}

/** Song cover in the theme's shape: radius or pixel corners, outline, shadow and signature overlay. */
export function Cover({ seed, size, behind, style }: { seed: number; size: number; behind?: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme()
  const border = theme.c.coverBorder ? Math.max(1.5, theme.border) : 0
  const radius = theme.pixelCorners ? 0 : Math.round(theme.radius.cover * Math.min(1, size / 220))
  const step = Math.max(2, Math.round(size / 40))
  const inner = (
    <View
      style={[
        { width: size, height: size, borderRadius: radius, overflow: "hidden", borderWidth: border, borderColor: theme.c.coverBorder },
        // Glow only on the big player cover; small list covers stay flat
        (theme.shadow === "glow" && size > 120) || theme.shadow === "soft" ? elevation(theme, size > 120) : null,
        style,
      ]}
    >
      <Art seed={seed} size={size - border * 2} palette={theme.c.cover} bg={theme.c.coverBg} />
      {theme.signature === "scanlines" && size > 80 && (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={size} height={size}>
          <Defs>
            <Pattern id="scan" width={4} height={4} patternUnits="userSpaceOnUse">
              <Rect y={3} width={4} height={1} fill="#000" fillOpacity={0.18} />
            </Pattern>
          </Defs>
          <Rect width={size} height={size} fill="url(#scan)" />
        </Svg>
      )}
      {theme.signature === "lcd" && size > 60 && (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={size} height={size}>
          <Defs>
            <Pattern id="dots" width={size / 16} height={size / 16} patternUnits="userSpaceOnUse">
              <Rect width={size / 16} height={1} fill={theme.c.bg} fillOpacity={0.5} />
              <Rect width={1} height={size / 16} fill={theme.c.bg} fillOpacity={0.5} />
            </Pattern>
          </Defs>
          <Rect width={size} height={size} fill="url(#dots)" />
        </Svg>
      )}
      {theme.pixelCorners && <PixelCorners step={step} color={behind ?? theme.c.bg} />}
    </View>
  )
  if (theme.shadow !== "solid") return inner
  return (
    <SolidShadow offset={Math.max(3, Math.round(size / 36))} color={theme.shadowColor} radius={radius}>
      {inner}
    </SolidShadow>
  )
}

export function Surface({
  children,
  style,
  tone = "surface",
  radius = "md",
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  tone?: "surface" | "surface2" | "bg"
  radius?: "sm" | "md" | "lg"
}) {
  const theme = useTheme()
  return (
    <View
      style={[
        {
          backgroundColor: theme.c[tone],
          borderRadius: theme.radius[radius],
          borderWidth: theme.border,
          borderColor: theme.c.border,
        },
        theme.shadow === "soft" ? elevation(theme) : null,
        style,
      ]}
    >
      {children}
    </View>
  )
}

// ---------- Motion

export const steps = (n: number) => (t: number) => Math.min(1, Math.ceil(t * n) / n)

/** Animates a value in the theme's motion style: stepped frames (retro), a spring, or a smooth ease. */
export function motion(theme: Theme, value: Animated.Value, toValue: number, duration = 280) {
  if (theme.motion === "spring") return Animated.spring(value, { toValue, useNativeDriver: true, damping: 20, stiffness: 240, mass: 0.9 })
  return Animated.timing(value, {
    toValue,
    duration,
    easing: theme.motion === "stepped" ? steps(Math.max(3, Math.round(duration / 55))) : Easing.out(Easing.cubic),
    useNativeDriver: true,
  })
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * Pressable with feedback in every theme: a tint over the control while held, plus a press-in scale,
 * or a push into the solid shadow on sticker themes. `radius` rounds the tint to the control's shape.
 */
export function Press({
  style,
  children,
  radius = 0,
  scaleTo = 0.94,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, "style" | "children"> & { style?: StyleProp<ViewStyle>; children: ReactNode; radius?: number; scaleTo?: number }) {
  const theme = useTheme()
  const [p] = useState(() => new Animated.Value(0))
  const run = (to: number) =>
    (theme.motion === "stepped"
      ? Animated.timing(p, { toValue: to, duration: 40, useNativeDriver: true })
      : Animated.spring(p, { toValue: to, useNativeDriver: true, speed: 40, bounciness: to ? 0 : 10 })
    ).start()
  const range = (to: number) => p.interpolate({ inputRange: [0, 1], outputRange: [0, to], extrapolateLeft: "clamp" })
  const transform =
    theme.shadow === "solid"
      ? [{ translateX: range(2) }, { translateY: range(2) }]
      : [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }]
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        run(1)
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        run(0)
        onPressOut?.(e)
      }}
      style={[style, { transform }]}
    >
      {children}
      {/* Sticker themes already show the push; the others get a tint while held */}
      {theme.shadow !== "solid" && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: theme.dark ? "#ffffff" : "#000000", opacity: range(0.1) }]}
        />
      )}
    </AnimatedPressable>
  )
}

// ---------- Buttons

export function IconButton({
  icon,
  onPress,
  label,
  active = false,
  color,
  size = 24,
  boxed,
}: {
  icon: IconName
  onPress: () => void
  label: string
  active?: boolean
  color?: string
  size?: number
  /** Square bordered box (retro themes) instead of a round hit area */
  boxed?: boolean
}) {
  const theme = useTheme()
  const isBoxed = boxed ?? theme.actions === "blocks"
  const radius = isBoxed ? theme.radius.sm : 22
  // An active toggle is always filled with the accent, so the state reads on light and dark themes alike
  const tint = active ? theme.c.onAccent : (color ?? theme.c.text)
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={4}
      radius={radius}
      scaleTo={0.86}
      style={[
        { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius },
        isBoxed && { borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: theme.c.surface },
        active && { backgroundColor: theme.c.accent, borderColor: theme.c.accent },
      ]}
    >
      <Icon name={icon} size={size} color={tint} />
    </Press>
  )
}

export function SkipButton({ icon, onPress, label }: { icon: "prev" | "next"; onPress: () => void; label: string }) {
  const theme = useTheme()
  const shape: ViewStyle =
    theme.play === "sticker"
      ? { width: 56, height: 56, borderRadius: 16, borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: theme.c.surface }
      : theme.play === "morph"
        ? { width: 64, height: 56, borderRadius: 28, backgroundColor: theme.c.surface2 }
        : { width: 52, height: 52, borderRadius: 26 }
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      radius={Number(shape.borderRadius)}
      scaleTo={0.86}
      style={[shape, { alignItems: "center", justifyContent: "center" }]}
    >
      <Icon name={icon} size={30} />
    </Press>
  )
}

export function PlayButton({
  playing,
  buffering = false,
  onPress,
  size = 76,
  behind,
}: {
  playing: boolean
  buffering?: boolean
  onPress: () => void
  size?: number
  behind?: string
}) {
  const theme = useTheme()
  const [bounce] = useState(() => new Animated.Value(1))
  useEffect(() => {
    bounce.setValue(0.9)
    Animated.spring(bounce, { toValue: 1, friction: 4, useNativeDriver: true }).start()
  }, [playing, bounce])

  const wide = theme.play === "morph" && size >= 64
  const w = wide ? Math.round(size * 1.3) : size
  const radius =
    theme.play === "circle"
      ? size / 2
      : theme.play === "sticker"
        ? Math.round(size * 0.3)
        : theme.play === "morph" && !theme.pixelCorners
          ? Math.round(size * 0.3)
          : 0
  const icon = (
    <Animated.View style={{ transform: [{ scale: bounce }] }}>
      {buffering && !playing ? (
        <ActivityIndicator color={theme.c.onAccent} />
      ) : (
        <Icon name={playing ? "pause" : "play"} size={Math.round(size * 0.45)} color={theme.c.onAccent} />
      )}
    </Animated.View>
  )
  const button = (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={playing ? "Pausar" : "Reproducir"}
      radius={radius}
      scaleTo={0.9}
      style={[
        {
          width: w,
          height: size,
          borderRadius: radius,
          backgroundColor: theme.c.accent,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        theme.play === "sticker" && { borderWidth: 1.5, borderColor: theme.c.text },
        theme.play === "square" && { borderWidth: theme.border, borderColor: theme.c.border },
        elevation(theme, true),
      ]}
    >
      {icon}
      {(theme.pixelCorners || theme.play === "lcd") && <PixelCorners step={Math.max(3, Math.round(size / 18))} color={behind ?? theme.c.bg} />}
    </Press>
  )
  if (theme.shadow !== "solid") return button
  return (
    <SolidShadow offset={Math.max(3, Math.round(size / 15))} color={theme.shadowColor} radius={radius}>
      {button}
    </SolidShadow>
  )
}

/** Primary/secondary text button; shape follows the theme (blocks, pills or rounded). */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  style,
}: {
  label: string
  onPress: () => void
  variant?: "primary" | "secondary"
  icon?: IconName
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const theme = useTheme()
  const primary = variant === "primary"
  const fg = primary ? theme.c.onAccent : theme.c.text
  const radius = theme.actions === "pills" ? 999 : theme.radius.sm
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      radius={radius}
      style={[
        {
          minHeight: 40,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          borderRadius: radius,
          backgroundColor: primary ? theme.c.accent : theme.c.surface2,
          borderWidth: theme.border,
          borderColor: primary && theme.actions === "blocks" ? theme.c.bg : theme.c.border,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={18} color={fg} />}
      <T variant="label" color={fg}>
        {label}
      </T>
    </Press>
  )
}

/** Toggle chip for filters and sections. */
export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme()
  const pill = theme.actions === "pills"
  const radius = pill ? 999 : theme.radius.sm
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      radius={radius}
      style={{
        height: 36,
        paddingHorizontal: 12,
        justifyContent: "center",
        borderRadius: radius,
        borderWidth: theme.border,
        borderColor: active ? theme.c.accent : theme.c.border,
        backgroundColor: active ? theme.c.accent : theme.c.surface2,
      }}
    >
      <T variant="label" color={active ? theme.c.onAccent : theme.c.text}>
        {label}
      </T>
    </Press>
  )
}

/** Container for the player's secondary actions, laid out per theme. */
export function ActionBar({ children }: { children: ReactNode }) {
  const theme = useTheme()
  if (theme.actions === "toolbar") {
    return (
      <View style={{ alignSelf: "center", flexDirection: "row", gap: 4, padding: 6, borderRadius: 28, backgroundColor: theme.c.surface, borderWidth: theme.border, borderColor: theme.c.border }}>
        {children}
      </View>
    )
  }
  if (theme.actions === "pills") return <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>{children}</View>
  return <View style={{ flexDirection: "row", gap: 6 }}>{children}</View>
}

export function Action({ icon, label, active = false, onPress }: { icon: IconName; label: string; active?: boolean; onPress: () => void }) {
  const theme = useTheme()
  if (theme.actions === "toolbar") {
    return (
      <Press
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        radius={22}
        scaleTo={0.9}
        style={{ height: 44, minWidth: 44, paddingHorizontal: active ? 12 : 0, borderRadius: 22, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: active ? theme.c.accent : "transparent" }}
      >
        <Icon name={icon} size={20} color={active ? theme.c.onAccent : theme.c.text} />
        {active && (
          <T variant="caption" color={theme.c.onAccent} style={{ fontWeight: "700" }}>
            {label}
          </T>
        )}
      </Press>
    )
  }
  if (theme.actions === "pills") {
    return (
      <Press
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        radius={999}
        style={{ height: 40, paddingHorizontal: 14, borderRadius: 999, flexDirection: "row", gap: 6, alignItems: "center", borderWidth: theme.border, borderColor: active ? theme.c.accent : theme.c.border, backgroundColor: active ? theme.c.accent : theme.c.surface }}
      >
        <Icon name={icon} size={16} color={active ? theme.c.onAccent : theme.c.text} />
        <T variant="caption" color={active ? theme.c.onAccent : theme.c.text}>
          {label}
        </T>
      </Press>
    )
  }
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      radius={theme.radius.sm}
      scaleTo={0.9}
      style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.sm, borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: active ? theme.c.accent : theme.c.surface }}
    >
      <Icon name={icon} size={20} color={active ? theme.c.onAccent : theme.c.highlight} />
    </Press>
  )
}

// ---------- Progress

const WAVE = 24

/** Visual track only; the parent supplies the drag handlers and measures `width`. */
export function ProgressTrack({ progress, width, playing, dragging }: { progress: number; width: number; playing: boolean; dragging: boolean }) {
  const theme = useTheme()
  const x = progress * width

  if (theme.progress === "segments") {
    const n = 24
    const filled = Math.round(progress * n)
    return (
      <View style={{ height: 32, flexDirection: "row", alignItems: "center", gap: 3 }}>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 14, borderRadius: theme.pixelCorners ? 0 : 3, backgroundColor: i < filled ? theme.c.accent : theme.c.surface2 }} />
        ))}
      </View>
    )
  }

  if (theme.progress === "wave") return <WaveTrack x={x} width={width} wavy={playing && !dragging} color={theme.c.accent} track={theme.c.surface2} />

  const blocks = theme.progress === "blocks"
  const glow = theme.progress === "glow"
  const thick = blocks ? 8 : 4
  const thumb = blocks ? 16 : 16
  return (
    <View style={{ height: 32, justifyContent: "center" }}>
      <View style={{ height: thick, borderRadius: blocks ? 0 : thick / 2, backgroundColor: theme.c.surface2, overflow: "hidden", borderWidth: blocks ? 0 : 0 }}>
        <View style={{ width: x, height: thick, backgroundColor: theme.c.accent }} />
      </View>
      <View
        style={[
          {
            position: "absolute",
            left: x - thumb / 2,
            width: thumb,
            height: thumb,
            borderRadius: blocks ? 0 : thumb / 2,
            backgroundColor: blocks ? theme.c.accent : glow ? theme.c.text : theme.c.accent,
            borderWidth: blocks ? 2 : 0,
            borderColor: theme.c.border,
            transform: [{ scale: dragging ? 1.3 : 1 }],
          },
          glow && { elevation: 10, shadowColor: theme.c.accent, shadowOpacity: 0.9, shadowRadius: 10 },
          theme.shadow === "soft" && { elevation: 3 },
        ]}
      />
    </View>
  )
}

function WaveTrack({ x, width, wavy, color, track }: { x: number; width: number; wavy: boolean; color: string; track: string }) {
  const [phase] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (!wavy) return
    phase.setValue(0)
    const loop = Animated.loop(Animated.timing(phase, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [wavy, phase])

  let d = "M0 6"
  for (let i = 2; i <= width + WAVE; i += 2) d += ` L${i} ${(6 + 3 * Math.sin((2 * Math.PI * i) / WAVE)).toFixed(2)}`
  const gap = 6
  return (
    <View style={{ height: 32, justifyContent: "center" }}>
      <View style={{ position: "absolute", left: Math.min(width, x + gap), right: 0, height: 4, borderRadius: 2, backgroundColor: track }} />
      <View style={{ position: "absolute", left: 0, width: Math.max(0, x - gap), height: 12, overflow: "hidden", justifyContent: "center" }}>
        {wavy ? (
          <Animated.View style={{ transform: [{ translateX: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -WAVE] }) }] }}>
            <Svg width={width + WAVE} height={12}>
              <Path d={d} stroke={color} strokeWidth={4} strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>
        ) : (
          <View style={{ height: 4, borderRadius: 2, backgroundColor: color }} />
        )}
      </View>
      <View style={{ position: "absolute", left: x - 2, width: 4, height: 28, borderRadius: 2, backgroundColor: color }} />
    </View>
  )
}

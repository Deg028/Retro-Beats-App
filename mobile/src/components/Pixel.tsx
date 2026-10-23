import { useEffect, useRef } from "react"
import { Animated, Easing, StyleProp, View, ViewStyle } from "react-native"
import Svg, { Path } from "react-native-svg"
import { colors } from "../theme"

const stepped = (t: number) => Math.floor(t * 6) / 6

const PALETTE = ["#e62429", "#ff7547", "#f2c14e"]

function rng(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

/** Symmetric 8x8 pixel-art cover generated from the song id. */
export function PixelCover({ seed, size, style }: { seed: number; size: number; style?: StyleProp<ViewStyle> }) {
  const r = rng(seed)
  const bg = seed % 2 ? colors.panel2 : colors.ink
  const fg = PALETTE[seed % 3]
  const cells: boolean[] = []
  for (let y = 0; y < 8; y++) {
    const half = Array.from({ length: 4 }, () => r() > 0.5)
    cells.push(...half, ...[...half].reverse())
  }
  const cell = size / 8
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Portada pixel art"
      style={[{ width: size, height: size, flexDirection: "row", flexWrap: "wrap", backgroundColor: bg }, style]}
    >
      {cells.map((on, i) => (
        <View key={i} style={{ width: cell, height: cell, backgroundColor: on ? fg : "transparent" }} />
      ))}
    </View>
  )
}

export function PixelHeart({ active, size = 20 }: { active: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      <Path
        d="M7 3h7v2h4v2h4V5h4V3h6v2h2v4h2v7h-2v5h-2v4h-3v3h-4v2h-4v2h-3v-2h-4v-2h-3v-3H8v-4H5v-5H3V9h2V5h2z"
        fill={active ? "#e3131c" : "#526079"}
      />
    </Svg>
  )
}

/** Outline icon in the same 32px square-cap style as the web version. */
export function Icon({ d, color, size = 20, filled = false }: { d: string[]; color: string; size?: number; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill={filled ? color : "none"}>
      {d.map((p, i) => (
        <Path
          key={i}
          d={p}
          stroke={filled ? "none" : color}
          strokeWidth={2.5}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ))}
    </Svg>
  )
}

export const ICONS = {
  shuffle: ["M4 8h3c6 0 10 16 16 16h5M24 20l4 4-4 4M4 24h3c2 0 4-2 6-5M19 11c1.5-1.8 2.7-3 4-3h5M24 4l4 4-4 4"],
  repeatAll: ["M6 14v-2a4 4 0 0 1 4-4h16M22 4l4 4-4 4M26 18v2a4 4 0 0 1-4 4H6M10 28l-4-4 4-4"],
  repeatOne: [
    "M6 14v-2a4 4 0 0 1 4-4h16M22 4l4 4-4 4M26 18v2a4 4 0 0 1-4 4H6M10 28l-4-4 4-4",
    "M14 14l2.5-2.5V20",
  ],
  bookmark: ["M8 4h16v24l-8-6-8 6z", "M16 9v8M12 13h8"],
  bookmarkOn: ["M8 4h16v24l-8-6-8 6z", "M12 13l3 3 5-6"],
  play: ["M9 5l18 11L9 27z"],
  pause: ["M8 5h5v22H8zM19 5h5v22h-5z"],
  prev: ["M7 5h4v22H7zM27 5v22L12 16z"],
  next: ["M21 5h4v22h-4zM5 5v22l15-11z"],
}

export function Equalizer({ playing = true, bars = 5, height = 20 }: { playing?: boolean; bars?: number; height?: number }) {
  const values = useRef(Array.from({ length: bars }, () => new Animated.Value(0.2))).current

  useEffect(() => {
    if (!playing) return
    const loops = values.map((v, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 450 + (i % 3) * 180, easing: stepped, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.2, duration: 450 + (i % 3) * 180, easing: stepped, useNativeDriver: true }),
        ]),
      )
      loop.start()
      return loop
    })
    return () => loops.forEach((l) => l.stop())
  }, [playing, values])

  return (
    <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{ width: 5, height, backgroundColor: colors.coral, transform: [{ scaleY: v }] }}
        />
      ))}
    </View>
  )
}

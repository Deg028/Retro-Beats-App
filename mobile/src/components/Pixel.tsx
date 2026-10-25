import { useEffect, useState } from "react"
import { Animated, StyleProp, View, ViewStyle } from "react-native"
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

/** Symmetric 8x8 pixel-art cover generated from the song id; themes pass their own palette. */
export function PixelCover({
  seed,
  size,
  style,
  palette = PALETTE,
  bg: bgColor,
}: {
  seed: number
  size: number
  style?: StyleProp<ViewStyle>
  palette?: readonly string[]
  bg?: string
}) {
  const r = rng(seed)
  const bg = bgColor ?? (seed % 2 ? colors.panel2 : colors.ink)
  const fg = palette[seed % 3]
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
  queue: ["M4 8h20M4 15h20M4 22h12", "M22 20v8l6-4z"],
  moon: ["M20 4a12 12 0 1 0 8 18A10 10 0 0 1 20 4z"],
  share: ["M16 4v16M10 10l6-6 6 6", "M6 16v12h20V16"],
  lyrics: ["M12 24V6l14-4v19", "M6 21h6v6H6z", "M20 18h6v6h-6z"],
  close: ["M8 8l16 16M24 8L8 24"],
  chevronDown: ["M8 12l8 8 8-8"],
  more: ["M15 6h2v2h-2zM15 15h2v2h-2zM15 24h2v2h-2z"],
  heart: ["M7 6h6v2h2v2h2V8h2V6h6v2h2v8h-2v2h-2v2h-2v2h-2v2h-2v2h-2v-2h-2v-2h-2v-2H9v-2H7v-2H5V8h2z"],
  home: ["M4 15L16 5l12 10M8 12v14h6v-8h4v8h6V12"],
  grid: ["M5 5h9v9H5zM18 5h9v9h-9zM5 18h9v9H5zM18 18h9v9h-9z"],
  disc: ["M16 4a12 12 0 1 1 0 24 12 12 0 0 1 0-24z", "M16 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"],
  palette: ["M16 4C9 4 4 9 4 16s5 12 12 12c2 0 3-1 3-2.5S18 23 18 21.5s1-2.5 3-2.5h3c2 0 4-2 4-5C28 8 22 4 16 4z", "M10 14h2v2h-2zM14 9h2v2h-2zM20 10h2v2h-2z"],
  check: ["M7 16l6 6 12-12"],
  menu: ["M5 8h22M5 16h22M5 24h22"],
  bars: ["M6 26V17h5v9zM14 26V7h5v19zM22 26V12h5v14z"],
  clock: ["M16 4a12 12 0 1 1 0 24 12 12 0 0 1 0-24z", "M16 9v7h6"],
}

export function Equalizer({
  playing = true,
  bars = 5,
  height = 20,
  color = colors.coral,
}: {
  playing?: boolean
  bars?: number
  height?: number
  color?: string
}) {
  const [values] = useState(() => Array.from({ length: bars }, () => new Animated.Value(0.2)))

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
          style={{ width: 5, height, backgroundColor: color, transform: [{ scaleY: v }] }}
        />
      ))}
    </View>
  )
}

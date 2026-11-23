import { ReactNode } from "react"
import { Animated, Pressable, StyleSheet, View } from "react-native"
import Svg, { Defs, Pattern, Rect } from "react-native-svg"
import { Art } from "./Art"
import { T } from "./ui"

// The handheld's own colours, after the grey pocket console the person sent: they stay the same whatever the theme's
// palette is, and the screen keeps the four greens of the original
const BODY = "#babdb6"
const BODY_EDGE = "#9a9d95"
const BEZEL = "#888a85"
const LCD = "#9bbc0f"
const LCD_DARK = "#0f380f"
const LED_ON = "#ef2929"
const LED_OFF = "#6b2b2b"
const BUTTON = "#5c3566"
const BUTTON_DEEP = "#482a50"
const PAD = "#2e3436"
const PILL = "#555753"
const BRAND = "#204a87"
const INK = "#eeeeec"

/**
 * The pocket console: the cover of the "Bolsillo LCD" theme in the player and the star of its opening. In the player
 * the song's picture is on the green screen, the pad moves between songs, A plays and pauses, B marks the favourite
 * and tapping the screen also plays and pauses. The opening passes its own `screen` and drives the power light with
 * `led`; with a `screen` the console does not take touches.
 */
export function GameBoy({
  seed,
  width,
  playing,
  fav,
  onToggle,
  onPrev,
  onNext,
  onFav,
  screen,
  led,
}: {
  seed: number
  width: number
  playing: boolean
  fav: boolean
  onToggle: () => void
  onPrev: () => void
  onNext: () => void
  onFav: () => void
  screen?: (w: number, h: number) => ReactNode
  led?: Animated.AnimatedInterpolation<number>
}) {
  const w = width
  const h = Math.round(w * 1.6)
  const corner = w * 0.24
  const bezelW = w * 0.86
  const bezelH = bezelW * 0.74
  const bezelLeft = (w - bezelW) / 2
  const bezelTop = h * 0.075
  const lcdW = bezelW * 0.6
  const lcdH = lcdW * 0.92
  const padSize = w * 0.3
  const arm = padSize / 3
  const btn = w * 0.15
  const label = { fontSize: 6, lineHeight: 8, letterSpacing: 0.6 }

  return (
    <View
      pointerEvents={screen ? "none" : "auto"}
      accessibilityLabel={screen ? undefined : `Consola de bolsillo. ${playing ? "Sonando" : "En pausa"}`}
      style={{ width: w, height: h, backgroundColor: BODY, borderRadius: 14, borderBottomRightRadius: corner, overflow: "hidden" }}
    >
      {/* The power switch line along the top, with its two marks */}
      <View style={{ position: "absolute", top: h * 0.045, left: 0, right: 0, height: 2, backgroundColor: BODY_EDGE }} />
      <View style={{ position: "absolute", top: 0, left: w * 0.08, width: 2, height: h * 0.045, backgroundColor: BODY_EDGE }} />
      <View style={{ position: "absolute", top: 0, right: w * 0.06, width: 2, height: h * 0.045, backgroundColor: BODY_EDGE }} />

      {/* Screen bezel */}
      <View style={{ position: "absolute", left: bezelLeft, top: bezelTop, width: bezelW, height: bezelH, backgroundColor: BEZEL, borderRadius: 8, borderBottomRightRadius: bezelW * 0.14 }}>
        <View style={{ position: "absolute", top: 7, left: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Stripes flex={1} />
          <T variant="caption" color={INK} style={label}>
            PIXEL MATRIX WITH STEREO SOUND
          </T>
          <Stripes width={bezelW * 0.12} />
        </View>
        <View style={{ position: "absolute", left: bezelW * 0.05, top: bezelH * 0.36, alignItems: "center", gap: 3 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: LED_OFF }}>
            <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 4, backgroundColor: LED_ON, opacity: led ?? (playing ? 1 : 0) }]} />
          </View>
          <T variant="caption" color={INK} style={{ fontSize: 5, lineHeight: 6 }}>
            BATTERY
          </T>
        </View>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pausar" : "Reproducir"}
          style={{ position: "absolute", left: (bezelW - lcdW) / 2 + bezelW * 0.02, top: bezelH * 0.15, width: lcdW, height: lcdH, backgroundColor: LCD, overflow: "hidden", borderRadius: 3 }}
        >
          {screen ? (
            screen(lcdW, lcdH)
          ) : (
            <>
              <Art seed={seed} size={lcdW} palette={[LCD_DARK, "#306230", "#8bac0f"]} bg={LCD} />
              {/* The picture is tinted into the four greens of the original screen */}
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: LCD, mixBlendMode: "multiply" }]} />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: LCD_DARK, opacity: 0.12 }]} />
              {!playing && (
                <View pointerEvents="none" style={styles.paused}>
                  <T variant="label" color={LCD_DARK} style={{ fontSize: 9 }}>
                    ▶ PAUSA
                  </T>
                </View>
              )}
            </>
          )}
          <Dots w={lcdW} h={lcdH} />
        </Pressable>
      </View>

      <T variant="display" color={BRAND} style={{ position: "absolute", left: w * 0.09, top: bezelTop + bezelH + 6, fontSize: 16, lineHeight: 20, fontStyle: "italic" }}>
        RetroBeats
      </T>

      {/* Directional pad */}
      <View style={{ position: "absolute", left: w * 0.08, top: h * 0.6, width: padSize, height: padSize }}>
        <View style={{ position: "absolute", left: arm, top: 0, width: arm, height: padSize, backgroundColor: PAD, borderRadius: 3 }} />
        <View style={{ position: "absolute", top: arm, left: 0, height: arm, width: padSize, backgroundColor: PAD, borderRadius: 3 }} />
        <View style={{ position: "absolute", left: arm + 3, top: arm + 3, width: arm - 6, height: arm - 6, borderRadius: arm, backgroundColor: "#25292b" }} />
        <Pressable onPress={onPrev} accessibilityRole="button" accessibilityLabel="Canción anterior" hitSlop={4} style={{ position: "absolute", left: 0, top: arm, width: arm + 4, height: arm }} />
        <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel="Canción siguiente" hitSlop={4} style={{ position: "absolute", right: 0, top: arm, width: arm + 4, height: arm }} />
      </View>

      {/* A and B, each on its darker shadow */}
      <View style={{ position: "absolute", right: w * 0.07, top: h * 0.565, width: btn * 2.6, height: btn * 2.1, transform: [{ rotate: "-27deg" }] }}>
        <View style={[styles.round, { left: 2, bottom: -2, width: btn, height: btn, borderRadius: btn / 2, backgroundColor: BUTTON_DEEP }]} />
        <View style={[styles.round, { right: -2, top: 2, width: btn, height: btn, borderRadius: btn / 2, backgroundColor: BUTTON_DEEP }]} />
        <Pressable
          onPress={onFav}
          accessibilityRole="button"
          accessibilityLabel={fav ? "Quitar de favoritas" : "Agregar a favoritas"}
          style={[styles.round, { left: 0, bottom: 0, width: btn, height: btn, borderRadius: btn / 2, borderWidth: fav ? 2 : 0, borderColor: "#f2c14e" }]}
        />
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pausar" : "Reproducir"}
          style={[styles.round, { right: 0, top: 0, width: btn, height: btn, borderRadius: btn / 2 }]}
        />
        <T variant="label" color={BRAND} style={{ position: "absolute", left: btn * 0.3, bottom: -btn * 0.62, fontSize: 9 }}>
          B
        </T>
        <T variant="label" color={BRAND} style={{ position: "absolute", right: btn * 0.3, top: -btn * 0.65, fontSize: 9 }}>
          A
        </T>
      </View>

      {/* Select and start */}
      <View style={{ position: "absolute", left: w * 0.14, right: w * 0.5, top: h * 0.84, flexDirection: "row", justifyContent: "center", gap: w * 0.07, transform: [{ rotate: "-27deg" }] }}>
        {["SELECT", "START"].map((name) => (
          <View key={name} style={{ alignItems: "center", gap: 3 }}>
            <View style={{ width: w * 0.12, height: w * 0.034, borderRadius: w * 0.02, backgroundColor: PILL }} />
            <T variant="caption" color={BRAND} style={{ fontSize: 5, lineHeight: 6 }}>
              {name}
            </T>
          </View>
        ))}
      </View>

      {/* Speaker grille: six slanted slots kept clear of the rounded corner */}
      <View style={{ position: "absolute", right: w * 0.1, bottom: w * 0.1, width: w * 0.17, height: w * 0.1, flexDirection: "row", justifyContent: "space-between", transform: [{ rotate: "-30deg" }] }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ width: 3, borderRadius: 2, backgroundColor: PILL }} />
        ))}
      </View>
    </View>
  )
}

/** The two thin coloured lines across the top of the bezel */
function Stripes({ flex, width }: { flex?: number; width?: number }) {
  return (
    <View style={{ flex, width, gap: 2 }}>
      <View style={{ height: 1.5, backgroundColor: BUTTON }} />
      <View style={{ height: 1.5, backgroundColor: BRAND }} />
    </View>
  )
}

/** The dot matrix over the screen */
function Dots({ w, h }: { w: number; h: number }) {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={w} height={h}>
      <Defs>
        <Pattern id="dots" width={3} height={3} patternUnits="userSpaceOnUse">
          <Rect width={3} height={1} fill={LCD_DARK} fillOpacity={0.16} />
          <Rect width={1} height={3} fill={LCD_DARK} fillOpacity={0.1} />
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill="url(#dots)" />
    </Svg>
  )
}

/** The two ends of the screen's green, for drawings shown on it */
export const LCD_COLORS = { light: LCD, dark: LCD_DARK }

const styles = StyleSheet.create({
  round: { position: "absolute", backgroundColor: BUTTON },
  paused: { position: "absolute", right: 4, bottom: 3 },
})

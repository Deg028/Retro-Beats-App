import { Pressable, StyleSheet, View } from "react-native"
import Svg, { Defs, Pattern, Rect } from "react-native-svg"
import { Art } from "./Art"
import { T } from "./ui"

// The handheld's own colours: they stay the same whatever the theme's palette is
const BODY = "#cdcabb"
const BODY_EDGE = "#8f8d7e"
const BEZEL = "#5b5c70"
const LCD = "#9bbc0f"
const LCD_DARK = "#0f380f"
const BUTTON = "#9b2257"
const PAD = "#2c2c36"
const BRAND = "#2e3192"

/**
 * The cover of the "Bolsillo LCD" theme: the song's picture on the green screen of a pocket console. The pad moves
 * between songs, A plays and pauses, B marks the favourite; tapping the screen also plays and pauses.
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
}: {
  seed: number
  width: number
  playing: boolean
  fav: boolean
  onToggle: () => void
  onPrev: () => void
  onNext: () => void
  onFav: () => void
}) {
  const w = width
  const h = Math.round(w * 1.56)
  const bezelW = w * 0.86
  const bezelH = bezelW * 0.82
  const lcdW = bezelW * 0.64
  const lcdH = lcdW * 0.92
  const padSize = w * 0.3
  const arm = padSize / 3
  const btn = w * 0.15

  return (
    <View
      accessibilityLabel={`Consola de bolsillo. ${playing ? "Sonando" : "En pausa"}`}
      style={{ width: w, height: h, backgroundColor: BODY, borderRadius: 12, borderBottomRightRadius: w * 0.26, borderWidth: 2, borderColor: BODY_EDGE }}
    >
      {/* Grooves along the top edge */}
      <View style={{ position: "absolute", top: 8, left: 14, right: 14, height: 2, backgroundColor: BODY_EDGE, opacity: 0.55 }} />
      <View style={{ position: "absolute", top: 13, left: 14, right: 14, height: 2, backgroundColor: BODY_EDGE, opacity: 0.35 }} />

      {/* Screen bezel */}
      <View style={{ position: "absolute", left: (w - bezelW) / 2 - 2, top: h * 0.07, width: bezelW, height: bezelH, backgroundColor: BEZEL, borderRadius: 8, borderBottomRightRadius: bezelW * 0.16 }}>
        <T variant="caption" color="#c7c8e0" style={{ position: "absolute", top: 5, left: 0, right: 0, textAlign: "center", fontSize: 6, lineHeight: 8, letterSpacing: 0.6 }}>
          PIXEL MATRIX WITH STEREO SOUND
        </T>
        <View style={{ position: "absolute", left: bezelW * 0.07, top: bezelH * 0.33, alignItems: "center", gap: 3 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: playing ? "#e8453c" : "#6b2b2b" }} />
          <T variant="caption" color="#c7c8e0" style={{ fontSize: 5, lineHeight: 6 }}>
            BATTERY
          </T>
        </View>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pausar" : "Reproducir"}
          style={{ position: "absolute", left: bezelW * 0.2, top: bezelH * 0.17, width: lcdW, height: lcdH, backgroundColor: LCD, overflow: "hidden", borderWidth: 2, borderColor: "#3c3d4c" }}
        >
          <Art seed={seed} size={lcdW} palette={[LCD_DARK, "#306230", "#8bac0f"]} bg={LCD} />
          {/* The picture is tinted into the four greens of the original screen */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: LCD, mixBlendMode: "multiply" }]} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: LCD_DARK, opacity: 0.12 }]} />
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={lcdW} height={lcdH}>
            <Defs>
              <Pattern id="dots" width={3} height={3} patternUnits="userSpaceOnUse">
                <Rect width={3} height={1} fill={LCD_DARK} fillOpacity={0.16} />
                <Rect width={1} height={3} fill={LCD_DARK} fillOpacity={0.1} />
              </Pattern>
            </Defs>
            <Rect width={lcdW} height={lcdH} fill="url(#dots)" />
          </Svg>
          {!playing && (
            <View pointerEvents="none" style={styles.paused}>
              <T variant="label" color={LCD_DARK} style={{ fontSize: 9 }}>
                ▶ PAUSA
              </T>
            </View>
          )}
        </Pressable>
      </View>

      <T variant="display" color={BRAND} style={{ position: "absolute", left: w * 0.1, top: h * 0.07 + bezelH + 8, fontSize: 15, lineHeight: 18 }}>
        Retro Beats
      </T>

      {/* Directional pad */}
      <View style={{ position: "absolute", left: w * 0.1, top: h * 0.66, width: padSize, height: padSize }}>
        <View style={{ position: "absolute", left: arm, top: 0, width: arm, height: padSize, backgroundColor: PAD, borderRadius: 3 }} />
        <View style={{ position: "absolute", top: arm, left: 0, height: arm, width: padSize, backgroundColor: PAD, borderRadius: 3 }} />
        <View style={{ position: "absolute", left: arm + 3, top: arm + 3, width: arm - 6, height: arm - 6, borderRadius: arm, backgroundColor: "#1d1d25" }} />
        <Pressable onPress={onPrev} accessibilityRole="button" accessibilityLabel="Canción anterior" hitSlop={4} style={{ position: "absolute", left: 0, top: arm, width: arm + 4, height: arm }} />
        <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel="Canción siguiente" hitSlop={4} style={{ position: "absolute", right: 0, top: arm, width: arm + 4, height: arm }} />
      </View>

      {/* A and B */}
      <View style={{ position: "absolute", right: w * 0.07, top: h * 0.625, width: btn * 2.6, height: btn * 2.1, transform: [{ rotate: "-24deg" }] }}>
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
        <T variant="label" color={BRAND} style={{ position: "absolute", left: btn * 0.3, bottom: -btn * 0.55, fontSize: 9 }}>
          B
        </T>
        <T variant="label" color={BRAND} style={{ position: "absolute", right: btn * 0.3, top: -btn * 0.6, fontSize: 9 }}>
          A
        </T>
      </View>

      {/* Select and start */}
      <View style={{ position: "absolute", left: w * 0.12, right: w * 0.52, top: h * 0.87, flexDirection: "row", justifyContent: "center", gap: w * 0.07, transform: [{ rotate: "-24deg" }] }}>
        {["SELECT", "START"].map((label) => (
          <View key={label} style={{ alignItems: "center", gap: 3 }}>
            <View style={{ width: w * 0.12, height: w * 0.034, borderRadius: w * 0.02, backgroundColor: "#7c7b70" }} />
            <T variant="caption" color={BRAND} style={{ fontSize: 5, lineHeight: 6 }}>
              {label}
            </T>
          </View>
        ))}
      </View>

      {/* Speaker grille */}
      <View style={{ position: "absolute", right: w * 0.05, bottom: w * 0.05, width: w * 0.17, height: w * 0.17, transform: [{ rotate: "-30deg" }], justifyContent: "space-between" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ height: 3, borderRadius: 2, backgroundColor: BODY_EDGE, opacity: 0.8 }} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  round: { position: "absolute", backgroundColor: BUTTON },
  paused: { position: "absolute", right: 4, bottom: 3 },
})

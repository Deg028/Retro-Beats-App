import { useEffect, useEffectEvent, useState } from "react"
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { Equalizer } from "./Pixel"
import { Icon, PixelCorners, steps } from "./ui"
import { useTheme } from "../themes/ThemeContext"
import { Theme } from "../themes/themes"
import { VERSION_LABEL } from "../version"

// Each opening is driven by one 0..1 value; retro intros advance in visible frames
const SPEC: Record<Theme["intro"], { duration: number; frames?: number }> = {
  coin: { duration: 2400, frames: 40 },
  boot: { duration: 2300, frames: 46 },
  tape: { duration: 2300 },
  morph: { duration: 2100 },
  flicker: { duration: 2200 },
  fade: { duration: 1700 },
  vinyl: { duration: 2500 },
  terminal: { duration: 2600, frames: 52 },
}

type V = Animated.Value

const seg = (t: V, a: number, b: number, from = 0, to = 1) =>
  t.interpolate({ inputRange: [a, b], outputRange: [from, to], extrapolate: "clamp" })

/** On/off blinking between `a` and `b`. */
const blink = (t: V, a: number, b: number, n: number) => {
  const input: number[] = [0]
  const output: number[] = [0]
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n
    input.push(x, x + 0.0001)
    output.push(i % 2 ? 1 : 0, i % 2 ? 0 : 1)
  }
  return t.interpolate({ inputRange: input, outputRange: output, extrapolate: "clamp" })
}

/** Opening animation in the style of the saved theme; tap to skip. */
export default function Intro({ onDone }: { onDone: () => void }) {
  const theme = useTheme()
  const [t] = useState(() => new Animated.Value(0))
  const finish = useEffectEvent(onDone)
  const { duration, frames } = SPEC[theme.intro]

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.timing(t, { toValue: 1, duration, easing: frames ? steps(frames) : Easing.linear, useNativeDriver: true }),
      Animated.delay(250),
    ])
    anim.start(({ finished }) => finished && finish())
    return () => anim.stop()
  }, [t, duration, frames])

  const Body = { coin: Coin, boot: Boot, tape: Tape, morph: Morph, flicker: Flicker, fade: Fade, vinyl: Vinyl, terminal: Terminal }[theme.intro]
  return (
    <Pressable style={[styles.root, { backgroundColor: theme.c.bg }]} onPress={onDone} accessibilityLabel="Saltar introducción">
      <Body t={t} theme={theme} />
      <Text style={[styles.version, { color: theme.c.textMuted, fontFamily: theme.type.label.family }]}>{VERSION_LABEL}</Text>
    </Pressable>
  )
}

type BodyProps = { t: V; theme: Theme }

/** Arcade: logo drops in frame by frame, the load bar fills in blocks. */
function Coin({ t, theme }: BodyProps) {
  const logo = { fontFamily: theme.type.display.family, fontSize: 30, lineHeight: 48 }
  return (
    <View style={styles.center}>
      <Animated.Text style={{ fontFamily: theme.type.label.family, fontSize: 11, color: theme.c.warm, opacity: blink(t, 0, 1, 12) }}>★ 1UP ★</Animated.Text>
      <View style={{ alignItems: "center", marginVertical: -8 }}>
        <Animated.Text style={[logo, { color: theme.c.text, transform: [{ translateY: seg(t, 0.05, 0.3, -420, 0) }] }]}>RETRO</Animated.Text>
        <Animated.Text style={[logo, { color: theme.c.accent, textShadowColor: theme.shadowColor, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0, transform: [{ translateY: seg(t, 0.2, 0.45, -520, 0) }] }]}>
          BEATS
        </Animated.Text>
      </View>
      <Animated.View style={{ opacity: seg(t, 0.45, 0.46) }}>
        <Equalizer bars={11} height={48} color={theme.c.warm} />
      </Animated.View>
      <View style={[styles.loadBox, { borderColor: theme.c.border }]}>
        {Array.from({ length: 10 }, (_, i) => (
          <Animated.View key={i} style={{ flex: 1, backgroundColor: theme.c.accent, opacity: seg(t, 0.45 + i * 0.045, 0.451 + i * 0.045) }} />
        ))}
      </View>
      <Animated.Text style={{ fontFamily: theme.type.label.family, fontSize: 8, color: theme.c.highlight, opacity: blink(t, 0.45, 1, 8) }}>PRESIONA START</Animated.Text>
    </View>
  )
}

/** Bolsillo LCD: the logo scrolls down a handheld screen, flashes, then the four tones light up. */
function Boot({ t, theme }: BodyProps) {
  const tones = [theme.c.text, theme.c.border, theme.c.tonal, theme.c.surface2]
  return (
    <View style={styles.center}>
      <View style={[styles.lcd, { borderColor: theme.c.text, backgroundColor: theme.c.surface }]}>
        <Animated.Text style={{ fontFamily: theme.type.display.family, fontSize: 30, color: theme.c.text, transform: [{ translateY: seg(t, 0, 0.6, -150, 0) }] }}>Retro Beats</Animated.Text>
        <Animated.Text style={{ fontFamily: theme.type.label.family, fontSize: 10, letterSpacing: 2, color: theme.c.textMuted, opacity: seg(t, 0.72, 0.73) }}>MODO BOLSILLO</Animated.Text>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.c.text, opacity: blink(t, 0.62, 0.7, 3) }]} />
        <PixelCorners step={4} color={theme.c.bg} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {tones.map((c, i) => (
          <Animated.View key={i} style={{ width: 22, height: 22, backgroundColor: c, borderWidth: 2, borderColor: theme.c.text, opacity: seg(t, 0.75 + i * 0.05, 0.751 + i * 0.05) }} />
        ))}
      </View>
    </View>
  )
}

/** Cinta: a cassette slides up and its reels spin while the label fades in. */
function Tape({ t, theme }: BodyProps) {
  const spin = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "1080deg"] })
  const reel = (
    <Animated.View style={[styles.reel, { borderColor: theme.c.text, transform: [{ rotate: spin }] }]}>
      <View style={[styles.spoke, { backgroundColor: theme.c.text }]} />
      <View style={[styles.spoke, { position: "absolute", backgroundColor: theme.c.text, transform: [{ rotate: "90deg" }] }]} />
    </Animated.View>
  )
  return (
    <View style={styles.center}>
      <Animated.View
        style={[
          styles.cassette,
          {
            borderColor: theme.c.text,
            backgroundColor: theme.c.surface,
            opacity: seg(t, 0, 0.15),
            transform: [{ translateY: t.interpolate({ inputRange: [0, 0.28, 0.36], outputRange: [380, -14, 0], extrapolate: "clamp" }) }],
          },
        ]}
      >
        <View style={[styles.tapeLabel, { backgroundColor: theme.c.lyricsBg }]}>
          <Animated.Text style={{ fontFamily: theme.type.display.family, fontSize: 22, color: theme.c.lyricsText, opacity: seg(t, 0.35, 0.5) }}>RETRO BEATS</Animated.Text>
          <Animated.Text style={{ fontFamily: theme.type.label.family, fontSize: 12, letterSpacing: 2, color: theme.c.accent, opacity: seg(t, 0.45, 0.6) }}>LADO A</Animated.Text>
        </View>
        <View style={[styles.window, { borderColor: theme.c.border, backgroundColor: theme.c.bg }]}>
          {reel}
          <View style={{ flex: 1, height: 3, backgroundColor: theme.c.borderInput }} />
          {reel}
        </View>
      </Animated.View>
      <Animated.Text style={{ fontFamily: theme.type.caption.family, fontSize: 13, color: theme.c.textMuted, opacity: seg(t, 0.6, 0.75) }}>Rebobinando tu música…</Animated.Text>
    </View>
  )
}

/** Pixel dinámico: a pixel-cornered square spins in, morphs into a circle and the logo rises. */
function Morph({ t, theme }: BodyProps) {
  const { width } = useWindowDimensions()
  const scale = t.interpolate({ inputRange: [0, 0.3, 0.4], outputRange: [0.2, 1.12, 1], extrapolate: "clamp" })
  const rotate = seg(t, 0, 0.4, -90, 0).interpolate({ inputRange: [-90, 0], outputRange: ["-90deg", "0deg"] })
  return (
    <View style={styles.center}>
      <Animated.View style={{ position: "absolute", width: width * 1.6, height: width * 1.6, borderRadius: width * 0.8, backgroundColor: theme.c.tonal, transform: [{ scale: seg(t, 0, 0.55, 0, 1) }] }} />
      <Animated.View style={{ width: 120, height: 120, transform: [{ scale }, { rotate }] }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.c.accent, opacity: seg(t, 0.45, 0.6, 1, 0) }]}>
          <PixelCorners step={8} color={theme.c.tonal} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 60, backgroundColor: theme.c.accent, opacity: seg(t, 0.45, 0.6) }]} />
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <Icon name="play" size={52} color={theme.c.onAccent} />
        </View>
      </Animated.View>
      <Animated.View style={{ alignItems: "center", gap: 6, opacity: seg(t, 0.5, 0.7), transform: [{ translateY: seg(t, 0.5, 0.75, 24, 0) }] }}>
        <Text style={{ fontSize: 30, fontWeight: "500", color: theme.c.text }}>Retro Beats</Text>
        <Text style={{ fontFamily: theme.type.label.family, fontSize: 12, letterSpacing: 2, color: theme.c.accent }}>TU MÚSICA, A TU COLOR</Text>
      </Animated.View>
    </View>
  )
}

/** Neón: the sign flickers on with a glow while a scanline sweeps the screen. */
function Flicker({ t, theme }: BodyProps) {
  const { height } = useWindowDimensions()
  const flicker = t.interpolate({
    inputRange: [0, 0.18, 0.2, 0.24, 0.28, 0.32, 0.38, 0.41, 0.48],
    outputRange: [0, 0, 1, 0.1, 1, 0.3, 1, 0.55, 1],
    extrapolate: "clamp",
  })
  const glow = { textShadowColor: theme.c.accent, textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } }
  return (
    <View style={styles.center}>
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, backgroundColor: theme.c.accent, opacity: 0.35, transform: [{ translateY: seg(t, 0, 1, 0, height) }] }} />
      <Animated.View style={{ alignItems: "center", opacity: flicker }}>
        <Text style={[{ fontFamily: theme.type.display.family, fontSize: 44, lineHeight: 52, color: theme.c.text }, glow]}>RETRO</Text>
        <Text style={[{ fontFamily: theme.type.display.family, fontSize: 44, lineHeight: 52, color: theme.c.accent }, glow]}>BEATS</Text>
      </Animated.View>
      <Animated.View style={{ width: 180, height: 3, borderRadius: 2, backgroundColor: theme.c.highlight, elevation: 8, shadowColor: theme.c.highlight, shadowOpacity: 0.9, shadowRadius: 10, transform: [{ scaleX: seg(t, 0.5, 0.7) }] }} />
      <Animated.Text style={{ fontFamily: theme.type.label.family, fontSize: 11, letterSpacing: 3, color: theme.c.textMuted, opacity: seg(t, 0.62, 0.8) }}>SINTONIZANDO…</Animated.Text>
    </View>
  )
}

/** Estudio: a red dot stretches into a line and the logo fades up. */
function Fade({ t, theme }: BodyProps) {
  return (
    <View style={styles.center}>
      <Animated.Text style={{ fontFamily: theme.type.display.family, fontSize: 36, lineHeight: 44, color: theme.c.text, opacity: seg(t, 0.25, 0.55), transform: [{ translateY: seg(t, 0.25, 0.6, 16, 0) }] }}>
        Retro Beats
      </Animated.Text>
      <Animated.View style={{ width: 140, height: 3, borderRadius: 2, backgroundColor: theme.c.accent, transform: [{ scaleX: t.interpolate({ inputRange: [0, 0.18, 0.5], outputRange: [0, 0.03, 1], extrapolate: "clamp" }) }] }} />
      <Animated.Text style={{ fontFamily: theme.type.label.family, fontSize: 11, letterSpacing: 2, color: theme.c.textMuted, opacity: seg(t, 0.55, 0.8) }}>ESTUDIO</Animated.Text>
    </View>
  )
}

/** Vinilo: a record rises and spins while the title letters appear and the label names the side. */
function Vinyl({ t, theme }: BodyProps) {
  const spin = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "900deg"] })
  return (
    <View style={styles.center}>
      <Animated.View
        style={{
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: theme.c.text,
          alignItems: "center",
          justifyContent: "center",
          opacity: seg(t, 0, 0.12),
          transform: [{ translateY: seg(t, 0, 0.3, 160, 0) }, { scale: seg(t, 0, 0.3, 0.7, 1) }, { rotate: spin }],
        }}
      >
        {[104, 84, 64].map((size) => (
          <View key={size} style={{ position: "absolute", width: size * 2.2, height: size * 2.2, borderRadius: size * 1.1, borderWidth: 1, borderColor: theme.c.textMuted, opacity: 0.35 }} />
        ))}
        <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: theme.c.accent, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.c.bg }} />
        </View>
      </Animated.View>
      <Animated.View style={{ alignItems: "center", gap: 4, opacity: seg(t, 0.4, 0.6), transform: [{ translateY: seg(t, 0.4, 0.65, 18, 0) }] }}>
        <Text style={{ fontFamily: theme.type.display.family, fontSize: 38, lineHeight: 44, color: theme.c.text }}>Retro</Text>
        <Text style={{ fontFamily: theme.type.display.family, fontSize: 38, lineHeight: 44, color: theme.c.accent }}>Beats</Text>
      </Animated.View>
      <Animated.Text style={{ fontFamily: theme.type.label.family, fontSize: 12, letterSpacing: 4, color: theme.c.textMuted, opacity: seg(t, 0.65, 0.85) }}>
        TU MÚSICA · LADO A
      </Animated.Text>
    </View>
  )
}

/** Terminal Pro: boot lines print one by one, then the logo with its cursor and a block loading bar. */
function Terminal({ t, theme }: BodyProps) {
  const mono = { fontFamily: theme.type.body.family, fontSize: 18, lineHeight: 24 }
  const lines: [string, string][] = [
    ["retro-beats@telefono:~$ iniciar", theme.c.textMuted],
    ["[ ok ] cargando temas", theme.c.accent],
    ["[ ok ] leyendo carpetas de música", theme.c.accent],
    ["[ ok ] letras y carátulas listas", theme.c.accent],
    ["[ .. ] preparando el reproductor", theme.c.warm],
  ]
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28, gap: 28 }}>
      <View>
        {lines.map(([text, color], i) => (
          <Animated.Text key={text} style={[mono, { color, opacity: seg(t, 0.04 + i * 0.1, 0.041 + i * 0.1) }]}>
            {text}
          </Animated.Text>
        ))}
      </View>
      <Animated.View style={{ opacity: seg(t, 0.58, 0.59) }}>
        <Text style={{ fontFamily: theme.type.display.family, fontSize: 56, lineHeight: 56, color: theme.c.accent, textShadowColor: theme.c.accent, textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } }}>
          {"RETRO\nBEATS"}
          <Animated.Text style={{ color: theme.c.warm, opacity: blink(t, 0.6, 1, 10) }}>_</Animated.Text>
        </Text>
      </Animated.View>
      <View style={[styles.loadBox, { borderColor: theme.c.accent, width: "100%", height: 20 }]}>
        {Array.from({ length: 16 }, (_, i) => (
          <Animated.View key={i} style={{ flex: 1, backgroundColor: theme.c.accent, opacity: seg(t, 0.62 + i * 0.022, 0.621 + i * 0.022) }} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  version: { position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center", fontSize: 12, letterSpacing: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22, overflow: "hidden" },
  loadBox: { width: 224, height: 22, borderWidth: 4, flexDirection: "row", gap: 2, padding: 2 },
  lcd: { width: 260, height: 170, borderWidth: 4, alignItems: "center", justifyContent: "center", gap: 10, overflow: "hidden" },
  cassette: { width: 270, borderWidth: 2, borderRadius: 16, padding: 12, gap: 12 },
  tapeLabel: { borderRadius: 8, paddingVertical: 10, alignItems: "center", gap: 2 },
  window: { height: 64, borderRadius: 32, borderWidth: 2, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 },
  reel: { width: 36, height: 36, borderRadius: 18, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  spoke: { width: 4, height: 16, borderRadius: 2 },
})

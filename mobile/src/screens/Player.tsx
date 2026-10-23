import { useEffect, useRef, useState } from "react"
import { Animated, Easing, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { fmt } from "../data"
import { Icon, ICONS, PixelCover, PixelHeart } from "../components/Pixel"
import { PlayerApi, PlayMode } from "../usePlayer"
import { colors, fonts } from "../theme"

const LINE_H = 32
const MODES: { mode: Exclude<PlayMode, "off">; icon: string[]; label: string }[] = [
  { mode: "shuffle", icon: ICONS.shuffle, label: "Reproducir biblioteca en orden aleatorio" },
  { mode: "repeat-one", icon: ICONS.repeatOne, label: "Repetir canción actual" },
  { mode: "repeat-all", icon: ICONS.repeatAll, label: "Repetir toda la playlist" },
]

export default function Player({ player, onBrowse }: { player: PlayerApi; onBrowse: () => void }) {
  const { current: song, playing, time, playMode } = player
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [barWidth, setBarWidth] = useState(0)

  const spin = useRef(new Animated.Value(0)).current
  const drawer = useRef(new Animated.Value(0)).current
  const lineShift = useRef(new Animated.Value(0)).current

  // Open the lyrics drawer automatically whenever a song with lyrics starts
  const songId = song?.id
  const hasLyrics = !!song?.lyrics
  useEffect(() => {
    setLyricsOpen(hasLyrics)
  }, [songId, hasLyrics])

  useEffect(() => {
    Animated.timing(drawer, {
      toValue: lyricsOpen ? 1 : 0,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [lyricsOpen, drawer])

  useEffect(() => {
    if (!playing) return
    spin.setValue(0)
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [playing, spin])

  const lines = song?.lyrics
  const lineIdx = song && lines ? Math.min(lines.length - 1, Math.floor((time / song.duration) * lines.length)) : -1

  useEffect(() => {
    if (lineIdx < 0) return
    Animated.timing(lineShift, {
      toValue: (1 - lineIdx) * LINE_H,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [lineIdx, lineShift])

  if (!song) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>ELIGE UNA CANCIÓN PARA PONER EL DISCO</Text>
        <Pressable onPress={onBrowse} style={styles.btn}>
          <Text style={styles.btnText}>IR AL INICIO</Text>
        </Pressable>
      </View>
    )
  }

  const progress = Math.min(1, time / song.duration)
  const seekTo = (x: number) => barWidth && player.seek(Math.round(Math.max(0, Math.min(1, x / barWidth)) * song.duration))

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Animated.View
        style={[styles.disc, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]}
      >
        <View style={styles.groove} />
        <Pressable onPress={player.togglePlaying} accessibilityLabel={playing ? "Pausar canción" : "Reanudar canción"} style={styles.label}>
          <PixelCover seed={song.id} size={76} />
        </Pressable>
      </Animated.View>

      <View style={styles.info}>
        <View style={{ width: 36 }} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text numberOfLines={1} style={styles.title}>
            {song.title}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {song.artist}
          </Text>
        </View>
        <Pressable onPress={() => player.toggleFav(song.id)} accessibilityLabel="Favorita" style={styles.fav}>
          <PixelHeart active={song.fav} size={20} />
        </Pressable>
      </View>

      <Pressable
        onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
        onPress={(e) => seekTo(e.nativeEvent.locationX)}
        style={styles.barHit}
        accessibilityRole="adjustable"
        accessibilityLabel="Posición de reproducción"
        accessibilityValue={{ text: `${fmt(time)} de ${fmt(song.duration)}` }}
      >
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={[styles.thumb, { left: progress * barWidth - 8 }]} />
      </Pressable>
      <View style={styles.times}>
        <Text style={styles.time}>{fmt(time)}</Text>
        <Text style={styles.time}>{fmt(song.duration)}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={() => player.step(-1)} accessibilityLabel="Anterior" style={styles.ctl}>
          <Icon d={ICONS.prev} color={colors.cream} filled size={20} />
        </Pressable>
        <Pressable onPress={player.togglePlaying} accessibilityLabel={playing ? "Pausar canción" : "Reanudar canción"} style={styles.main}>
          <Icon d={playing ? ICONS.pause : ICONS.play} color={colors.cream} filled size={20} />
        </Pressable>
        <Pressable onPress={() => player.step(1)} accessibilityLabel="Siguiente" style={styles.ctl}>
          <Icon d={ICONS.next} color={colors.cream} filled size={20} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        {MODES.map(({ mode, icon, label }) => (
          <Pressable
            key={mode}
            onPress={() => player.changePlayMode(playMode === mode ? "off" : mode)}
            accessibilityLabel={label}
            accessibilityState={{ selected: playMode === mode }}
            style={styles.action}
          >
            <Icon d={icon} color={playMode === mode ? colors.coral : colors.secondary} />
          </Pressable>
        ))}
        <Pressable
          onPress={() => player.toggleLibrary(song.id)}
          accessibilityLabel={song.added ? "Quitar de la biblioteca" : "Agregar a la biblioteca"}
          accessibilityState={{ selected: song.added }}
          style={styles.action}
        >
          <Icon d={song.added ? ICONS.bookmarkOn : ICONS.bookmark} color={song.added ? colors.coral : colors.secondary} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => setLyricsOpen((o) => !o)}
        accessibilityState={{ expanded: lyricsOpen }}
        style={[styles.lyricsBtn, lyricsOpen && { backgroundColor: colors.primary }]}
      >
        <Text style={styles.lyricsBtnText}>♪ LYRICS {lyricsOpen ? "▾" : "▴"}</Text>
      </Pressable>

      <Animated.View
        style={{
          height: drawer.interpolate({ inputRange: [0, 1], outputRange: [0, lines ? LINE_H * 3 + 8 : 40] }),
          opacity: drawer,
          overflow: "hidden",
        }}
      >
        {lines ? (
          <View style={styles.window}>
            <Animated.View style={{ transform: [{ translateY: lineShift }] }}>
              {lines.map((l, i) => (
                <Text
                  key={i}
                  numberOfLines={1}
                  style={[styles.line, i === lineIdx ? styles.lineOn : { color: "rgba(255,246,224,0.3)" }]}
                >
                  {l}
                </Text>
              ))}
            </Animated.View>
          </View>
        ) : (
          <Text style={styles.instrumental}>♪ TEMA INSTRUMENTAL ♪</Text>
        )}
      </Animated.View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 32 },
  emptyText: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 20, color: colors.coral, textAlign: "center" },
  btn: { backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.ink, padding: 14 },
  btnText: { fontFamily: fonts.pixel, fontSize: 10, color: colors.cream },
  disc: {
    alignSelf: "center",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 4,
    borderColor: colors.secondary,
    backgroundColor: "#122240",
    alignItems: "center",
    justifyContent: "center",
  },
  groove: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: colors.panel2 },
  label: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: colors.primary, overflow: "hidden" },
  info: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 8 },
  title: { fontFamily: fonts.pixel, fontSize: 12, lineHeight: 19, color: colors.cream },
  artist: { fontFamily: fonts.term, fontSize: 24, color: colors.coral },
  fav: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  barHit: { height: 28, justifyContent: "center", marginTop: 8 },
  bar: { height: 4, backgroundColor: colors.panel2 },
  barFill: { height: 4, backgroundColor: colors.primary },
  thumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.primary,
  },
  times: { flexDirection: "row", justifyContent: "space-between" },
  time: { fontFamily: fonts.pixel, fontSize: 8, color: colors.coral },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 },
  ctl: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  main: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", marginTop: 8, gap: 6 },
  action: { flex: 1, height: 36, alignItems: "center", justifyContent: "center" },
  lyricsBtn: { marginTop: 8, paddingVertical: 8, alignItems: "center", backgroundColor: colors.panel2, borderWidth: 3, borderColor: colors.ink },
  lyricsBtnText: { fontFamily: fonts.pixel, fontSize: 10, color: colors.cream },
  window: { height: LINE_H * 3, marginTop: 8, overflow: "hidden" },
  line: { height: LINE_H, lineHeight: LINE_H, textAlign: "center", fontFamily: fonts.term, fontSize: 22, color: colors.cream },
  lineOn: { color: colors.cream, textShadowColor: colors.blood, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  instrumental: { paddingTop: 14, textAlign: "center", fontFamily: fonts.pixel, fontSize: 8, color: colors.coral },
})

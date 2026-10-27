import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, TextStyle, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"
import { Art } from "../components/Art"
import { GameBoy } from "../components/GameBoy"
import { LyricLine } from "../data"
import { Equalizer } from "../components/Pixel"
import { Action, ActionBar, Button, Cover, IconButton, PlayButton, Press, ProgressTrack, SkipButton, T, textStyle } from "../components/ui"
import { lyricsHaveJapanese } from "../online/romaji"
import { PlaylistsApi } from "../playlists"
import { LyricsState, SongInfo } from "../online/useSongInfo"
import { useTheme } from "../themes/ThemeContext"
import { PlayerApi, usePlaybackTime } from "../usePlayer"
import { AddToPlaylistSheet } from "./Playlists"
import { InfoSheet } from "./player/InfoSheet"
import { HoldSeek, LyricsWindow, QueueSheet, shareSong, useDismiss, useSeek, useSwipe, useTimeLabels } from "./player/shared"

/** Height of the lyrics window: room for four short lines, or two that wrap */
const LYRICS_H = 168

/** One player for every theme: the theme decides cover style, progress, buttons, background and its retro signature. */
export default function Player({
  player,
  info,
  playlists,
  onClose,
  drag,
}: {
  player: PlayerApi
  info: SongInfo
  playlists: PlaylistsApi
  onClose: () => void
  /** Offset of the player layer, moved by the drag-to-close bar; `settle` springs it back */
  drag: { y: Animated.Value; settle: () => void }
}) {
  const theme = useTheme()
  const { current: song, playing, shuffle, repeat } = player
  const [sheet, setSheet] = useState<"queue" | "playlists" | "info" | null>(null)
  const [lyricsOpen, setLyricsOpen] = useState(true)
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const swipe = useSwipe(() => player.step(1), () => player.step(-1))
  const dragToClose = useDismiss(drag.y, onClose, drag.settle)

  const [spin] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (!playing) return
    spin.setValue(0)
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [playing, spin])
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] })

  if (!song) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.c.bg }]}>
        <T variant="title" style={{ textAlign: "center" }}>
          Elige una canción para empezar
        </T>
        <Button label="Ir al inicio" onPress={onClose} />
      </View>
    )
  }

  const coverSize = theme.cover === "disc" ? 210 : Math.min(width - 72, theme.signature === "reels" ? 250 : 290)
  const coverBehind = theme.background === "tonal" ? theme.c.tonal : theme.c.bg

  return (
    <View style={{ flex: 1, backgroundColor: theme.c.bg }}>
      {theme.background === "artGlow" && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={{ position: "absolute", top: -60, left: -80, opacity: 0.4 }}>
            <Art seed={song.id} size={width + 160} palette={theme.c.cover} bg={theme.c.coverBg} blur={24} />
          </View>
          <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
            <Defs>
              <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.c.bg} stopOpacity={0.35} />
                <Stop offset="0.55" stopColor={theme.c.bg} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={height} fill="url(#fade)" />
          </Svg>
        </View>
      )}

      {/* Fixed bar outside the ScrollView so it can be dragged down to close the player */}
      <View
        {...dragToClose}
        style={[
          styles.bar,
          theme.background === "tonal" && { backgroundColor: theme.c.tonal },
          theme.background === "solid" && { backgroundColor: theme.c.bg },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.c.borderInput, borderRadius: theme.pixelCorners || theme.radius.sm === 0 ? 0 : 2 }]} />
        <View style={styles.header}>
          <IconButton icon="back" onPress={onClose} label="Cerrar reproductor" />
          <View style={{ alignItems: "center", flex: 1 }}>
            <T variant="label" color={theme.c.highlight === theme.c.text ? theme.c.accent : theme.c.highlight}>
              Ahora suena
            </T>
            <T variant="caption" color={theme.c.textMuted}>
              {player.sourceLabel}
            </T>
          </View>
          <IconButton icon="queue" onPress={() => setSheet("queue")} label="Cola de reproducción" />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View
          style={[
            { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 16 },
            theme.background === "tonal" && { backgroundColor: theme.c.tonal, borderBottomLeftRadius: theme.radius.lg + 8, borderBottomRightRadius: theme.radius.lg + 8 },
          ]}
        >
          <Animated.View {...swipe.panHandlers} style={[{ alignSelf: "center", alignItems: "center", gap: 12 }, swipe.style]}>
            {theme.signature === "lcd" ? (
              <GameBoy
                seed={song.id}
                width={Math.min(width - 120, 236)}
                playing={playing}
                fav={song.fav}
                onToggle={player.togglePlaying}
                onPrev={() => player.step(-1)}
                onNext={() => player.step(1)}
                onFav={() => player.toggleFav(song.id)}
              />
            ) : theme.cover === "disc" ? (
              <Animated.View style={[styles.disc, { width: coverSize, height: coverSize, borderRadius: coverSize / 2, borderColor: theme.c.border, backgroundColor: theme.c.coverBg, transform: [{ rotate }] }]}>
                <View style={[styles.groove, { width: coverSize * 0.8, height: coverSize * 0.8, borderRadius: coverSize * 0.4, borderColor: theme.c.surface }]} />
                <Pressable onPress={player.togglePlaying} accessibilityLabel={playing ? "Pausar" : "Reproducir"} style={[styles.label, { borderColor: theme.c.accent }]}>
                  <Art seed={song.id} size={84} palette={theme.c.cover} bg={theme.c.coverBg} />
                </Pressable>
              </Animated.View>
            ) : (
              <Pressable onPress={player.togglePlaying} accessibilityLabel={playing ? "Pausar" : "Reproducir"}>
                <Cover seed={song.id} size={coverSize} behind={coverBehind} />
              </Pressable>
            )}
            {theme.signature === "reels" && (
              <View style={[styles.reels, { width: coverSize, borderRadius: theme.radius.sm + 4, borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: theme.c.surface }]}>
                <Animated.View style={[styles.reel, { borderColor: theme.c.text, transform: [{ rotate }] }]}>
                  <View style={[styles.spoke, { backgroundColor: theme.c.text }]} />
                </Animated.View>
                <View style={[styles.tape, { backgroundColor: theme.c.borderInput }]} />
                <T variant="label" color={theme.c.textMuted} style={{ fontSize: 11 }}>
                  Lado A
                </T>
                <View style={[styles.tape, { backgroundColor: theme.c.borderInput }]} />
                <Animated.View style={[styles.reel, { borderColor: theme.c.text, transform: [{ rotate }] }]}>
                  <View style={[styles.spoke, { backgroundColor: theme.c.text }]} />
                </Animated.View>
              </View>
            )}
          </Animated.View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 14, paddingTop: theme.background === "tonal" ? 18 : 0 }}>
          <View style={styles.info}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T variant="display" numberOfLines={1}>
                {song.title}
              </T>
              <T variant="body" numberOfLines={1} color={theme.c.warm}>
                {song.artist}
              </T>
            </View>
            <IconButton
              icon={song.added ? "libraryOn" : "library"}
              onPress={() => player.toggleLibrary(song.id)}
              label={song.added ? "Quitar de la biblioteca" : "Agregar a la biblioteca"}
              color={song.added ? theme.c.accent : theme.c.textMuted}
            />
            <IconButton icon={song.fav ? "heartOn" : "heart"} onPress={() => player.toggleFav(song.id)} label="Favorita" color={song.fav ? theme.c.accent : theme.c.textMuted} />
          </View>

          <Timeline player={player} />

          <View style={styles.controls}>
            <IconButton icon="shuffle" onPress={player.toggleShuffle} label="Aleatorio" active={shuffle} boxed={false} />
            <SkipButton icon="prev" onPress={() => player.step(-1)} label="Anterior" />
            <PlayButton playing={playing} buffering={player.buffering} onPress={player.togglePlaying} />
            <SkipButton icon="next" onPress={() => player.step(1)} label="Siguiente" />
            <IconButton
              icon={repeat === "one" ? "repeatOne" : "repeat"}
              onPress={player.cycleRepeat}
              label={repeat === "off" ? "Repetir: desactivado" : repeat === "all" ? "Repetir: todo" : "Repetir: una"}
              active={repeat !== "off"}
              boxed={false}
              color={repeat === "off" ? theme.c.textMuted : undefined}
            />
          </View>

          <ActionBar>
            <Action icon="lyrics" label="Letra" active={lyricsOpen} onPress={() => setLyricsOpen((o) => !o)} />
            <Action icon="queue" label="Cola" onPress={() => setSheet("queue")} />
            <Action icon="playlist" label="Listas" onPress={() => setSheet("playlists")} />
            <Action icon="share" label="Compartir" onPress={() => shareSong(song)} />
            <Action icon="more" label="Datos" onPress={() => setSheet("info")} />
          </ActionBar>

          {lyricsOpen && (
            <View
              style={{
                borderRadius: theme.radius.lg,
                padding: 18,
                backgroundColor: theme.c.lyricsBg,
                // Light themes get an outline so the white card doesn't vanish into the background
                borderWidth: Math.max(theme.border, theme.dark ? 0 : 1),
                borderColor: theme.c.border,
              }}
            >
              <View style={styles.lyricsHead}>
                <View style={styles.offset}>
                  <T variant="label" color={theme.c.lyricsText}>
                    Letra
                  </T>
                  {!!song.lyrics && lyricsHaveJapanese(song.lyrics) && (
                    <Press
                      onPress={() => info.setRomajiOn(!info.romajiOn)}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: info.romajiOn }}
                      accessibilityLabel="Mostrar la letra en romaji"
                      radius={theme.radius.sm}
                      style={[styles.chip, { borderRadius: theme.radius.sm, borderColor: theme.c.lyricsText, backgroundColor: info.romajiOn ? theme.c.lyricsText : "transparent" }]}
                    >
                      <T variant="caption" color={info.romajiOn ? theme.c.lyricsBg : theme.c.lyricsText} style={{ textTransform: "none" }}>
                        Romaji
                      </T>
                    </Press>
                  )}
                </View>
                {song.lyrics ? (
                  <View style={styles.offset}>
                    <Press
                      onPress={() => info.setLyricsOffset(song.id, (song.lyricsOffset ?? 0) - 0.5)}
                      accessibilityLabel="Retrasar la letra medio segundo"
                      radius={theme.radius.sm}
                      style={[styles.offsetBtn, { borderColor: theme.c.lyricsDim, borderRadius: theme.radius.sm }]}
                    >
                      <T variant="label" color={theme.c.lyricsText}>
                        −
                      </T>
                    </Press>
                    <T variant="caption" color={theme.c.lyricsDim} style={{ minWidth: 64, textAlign: "center", textTransform: "none" }}>
                      {song.lyricsOffset ? `${song.lyricsOffset > 0 ? "+" : "−"}${Math.abs(song.lyricsOffset).toFixed(1)} s` : "Ajuste"}
                    </T>
                    <Press
                      onPress={() => info.setLyricsOffset(song.id, (song.lyricsOffset ?? 0) + 0.5)}
                      accessibilityLabel="Adelantar la letra medio segundo"
                      radius={theme.radius.sm}
                      style={[styles.offsetBtn, { borderColor: theme.c.lyricsDim, borderRadius: theme.radius.sm }]}
                    >
                      <T variant="label" color={theme.c.lyricsText}>
                        +
                      </T>
                    </Press>
                  </View>
                ) : (
                  <Equalizer playing={playing} bars={4} height={14} color={theme.lyricsLined ? theme.c.lyricsText : theme.c.accent} />
                )}
              </View>
              {song.lyrics ? (
                <>
                  <SyncedLyrics player={player} lines={song.lyrics} offset={song.lyricsOffset ?? 0} romaji={info.romajiOn ? song.romaji : undefined} />
                  {song.lyricsEstimated && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                      <T variant="caption" color={theme.c.lyricsDim} style={{ flex: 1, textTransform: "none" }}>
                        No hay una versión con tiempos de esta canción: los tiempos son aproximados. Ajústalos con − y +.
                      </T>
                      {info.enabled && !info.searching && <Button label="Buscar" variant="secondary" icon="repeat" onPress={info.retrySynced} />}
                    </View>
                  )}
                </>
              ) : song.plain ? (
                <View style={{ gap: 10 }}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                    <T variant="body" color={theme.c.lyricsText} style={{ lineHeight: 26, textTransform: "none" }}>
                      {song.plain}
                    </T>
                  </ScrollView>
                  {info.enabled && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      {info.searching && <ActivityIndicator color={theme.c.accent} />}
                      <T variant="caption" color={theme.c.lyricsDim} style={{ flex: 1, textTransform: "none" }}>
                        {info.searching ? "Buscando la letra con tiempos…" : "Esta letra no tiene tiempos, por eso no avanza con la canción."}
                      </T>
                      {!info.searching && <Button label="Sincronizar" variant="secondary" icon="repeat" onPress={info.retrySynced} />}
                    </View>
                  )}
                </View>
              ) : (
                <LyricsStatus state={info.lyricsState(song)} error={info.error} onRetry={info.retry} />
              )}
              {info.romajiOn && !!song.lyrics && lyricsHaveJapanese(song.lyrics) && !song.romaji && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                  {info.romajiBusy === song.id && <ActivityIndicator color={theme.c.accent} />}
                  <T variant="caption" color={theme.c.lyricsDim} style={{ flex: 1, textTransform: "none" }}>
                    {info.romajiBusy === song.id ? "Convirtiendo la letra a romaji…" : info.romajiError ? `${info.romajiError}.` : "Preparando el romaji…"}
                  </T>
                  {!!info.romajiError && info.romajiBusy !== song.id && <Button label="Reintentar" variant="secondary" icon="repeat" onPress={info.retryRomaji} />}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {sheet === "info" && <InfoSheet song={song} info={info} visible onClose={() => setSheet(null)} />}
      <QueueSheet player={player} visible={sheet === "queue"} onClose={() => setSheet(null)} />
      <AddToPlaylistSheet visible={sheet === "playlists"} onClose={() => setSheet(null)} song={song} playlists={playlists} />
    </View>
  )
}

/**
 * The progress bar, the times and the skip buttons: the only part of the player that follows the running time,
 * so the cover, the buttons and the rest are not drawn again four times a second.
 */
function Timeline({ player }: { player: PlayerApi }) {
  const theme = useTheme()
  const { playing, duration } = player
  const time = usePlaybackTime(player)
  const seek = useSeek(time, duration, player.seek)
  const labels = useTimeLabels(seek.shown, duration)
  return (
    <View>
      <View
        onLayout={seek.onLayout}
        {...seek.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Posición de reproducción"
        accessibilityValue={{ text: `${labels.elapsed} de ${labels.total}` }}
      >
        <View pointerEvents="none">
          <ProgressTrack progress={seek.progress} width={seek.width} playing={playing} dragging={seek.dragging} />
        </View>
      </View>
      <View style={styles.times}>
        <T variant="number" color={theme.c.textMuted}>
          {labels.elapsed}
        </T>
        <View style={styles.hold}>
          <HoldSeek dir={-1} time={time} duration={duration} onSeek={player.seek} />
          <HoldSeek dir={1} time={time} duration={duration} onSeek={player.seek} />
        </View>
        <T variant="number" color={theme.c.textMuted} onPress={labels.toggle} accessibilityHint="Alterna entre duración y tiempo restante">
          {labels.total}
        </T>
      </View>
    </View>
  )
}

/** The timed lyrics, which follow the running time on their own for the same reason as the timeline. */
function SyncedLyrics({ player, lines, offset, romaji }: { player: PlayerApi; lines: LyricLine[]; offset: number; romaji?: string[] }) {
  const theme = useTheme()
  const time = usePlaybackTime(player)
  const lineStyle = useMemo<TextStyle>(
    () => ({
      ...textStyle(theme, theme.icons === "pixel" ? "body" : "title"),
      textTransform: "none",
      ...(theme.lyricsLined ? { borderBottomWidth: 1, borderColor: theme.c.lyricsDim + "40" } : null),
    }),
    [theme],
  )
  const activeStyle = useMemo<TextStyle>(
    () => ({
      color: theme.c.lyricsText,
      ...(theme.shadow === "glow" ? { textShadowColor: theme.c.accent, textShadowRadius: 12 } : null),
      ...(theme.shadow === "solid" && theme.icons === "pixel" ? { textShadowColor: theme.shadowColor, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 } : null),
    }),
    [theme],
  )
  return (
    <LyricsWindow
      lines={lines}
      time={time + offset}
      onSeek={(t) => player.seek(t - offset)}
      playing={player.playing}
      height={LYRICS_H}
      romaji={romaji}
      lineStyle={lineStyle}
      activeStyle={activeStyle}
      dimColor={theme.c.lyricsDim}
    />
  )
}

/** What to say where the lyrics would be: still looking, nothing found, no connection, or searching turned off. */
function LyricsStatus({ state, error, onRetry }: { state: LyricsState; error?: string; onRetry: () => void }) {
  const theme = useTheme()
  const message: Record<LyricsState, string> = {
    loading: "Buscando la letra en internet…",
    none: "No encontramos la letra de esta canción.",
    off: "La búsqueda en internet está desactivada. Puedes activarla en la pestaña Música.",
    error: error ? `No se pudo buscar la letra. ${error}.` : "No se pudo buscar la letra.",
    found: "",
  }
  return (
    <View style={{ gap: 10, marginTop: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {state === "loading" && <ActivityIndicator color={theme.c.accent} />}
        <T variant="caption" color={theme.c.lyricsDim} style={{ flex: 1 }}>
          {message[state]}
        </T>
      </View>
      {state === "error" && <Button label="Reintentar" variant="secondary" icon="repeat" onPress={onRetry} />}
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 32 },
  bar: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  handle: { alignSelf: "center", width: 36, height: 4, marginBottom: 4, opacity: 0.6 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 },
  disc: { borderWidth: 4, alignItems: "center", justifyContent: "center" },
  groove: { position: "absolute", borderWidth: 2 },
  label: { width: 92, height: 92, borderRadius: 46, borderWidth: 4, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  reels: { height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 },
  reel: { width: 26, height: 26, borderRadius: 13, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  spoke: { width: 4, height: 11, borderRadius: 2 },
  tape: { flex: 1, height: 2 },
  info: { flexDirection: "row", alignItems: "center", gap: 2 },
  times: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hold: { flexDirection: "row", gap: 10 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  offset: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { height: 26, paddingHorizontal: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  offsetBtn: { width: 34, height: 30, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  lyricsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
})

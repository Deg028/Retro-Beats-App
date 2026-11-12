import { useEffect, useState } from "react"
import { Modal, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fmt, Song } from "../../data"
import { toLrc } from "../../online/lrclib"
import { Button, Press, T } from "../../components/ui"
import { useTheme } from "../../themes/ThemeContext"
import { PlayerApi, usePlaybackTime } from "../../usePlayer"

// A finger lands a little after the singer starts: each mark is moved this much earlier, so the line lights up just
// before it is sung (1 s, chosen by the person so it feels natural)
const REACTION = 1


/**
 * Timing by hand, the way an LRC generator works: the song plays from the start and the person presses «Marcar» when
 * each line begins. «Deshacer» takes the last mark back, «−5 s» goes back and drops the marks after that point.
 * Only offered for lyrics with no real times (plain words or guessed times); the result is saved as the person's own.
 * Mounted only while open, so each opening starts with no marks.
 */
export function TapSyncSheet({ song, lines, player, visible, onClose, onDone }: { song: Song; lines: string[]; player: PlayerApi; visible: boolean; onClose: () => void; onDone: (lrc: string) => void }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const time = usePlaybackTime(player)
  const [marks, setMarks] = useState<number[]>([])
  const [started, setStarted] = useState(false)
  const at = marks.length
  const done = at >= lines.length
  // Another song started (the queue moved on, or the person changed it): these marks belong to the old one
  const lost = player.current?.id !== song.id

  useEffect(() => {
    // All lines marked: the song stops so the person can save without it running on to the next one
    if (done && started && player.playing) player.togglePlaying()
  }, [done, started, player])

  const start = () => {
    setMarks([])
    setStarted(true)
    player.seek(0)
    if (!player.playing) player.togglePlaying()
  }
  const mark = () => {
    if (done) return
    // Read straight from the audio, not from the time shown, which is only refreshed a few times a second
    const now = Math.max(0, player.audio.currentTime - REACTION)
    setMarks((m) => (m.length && now <= m[m.length - 1] ? [...m, m[m.length - 1] + 0.1] : [...m, now]))
  }
  const undo = () => {
    const last = marks[marks.length - 1]
    if (last === undefined) return
    setMarks(marks.slice(0, -1))
    player.seek(Math.max(0, last - 3))
    if (!player.playing) player.togglePlaying()
  }
  const back = () => {
    const to = Math.max(0, player.audio.currentTime - 5)
    setMarks((m) => m.filter((t) => t < to))
    player.seek(to)
  }

  const row = (i: number, size: "big" | "small") =>
    lines[i] !== undefined && (
      <T key={i} variant={size === "big" ? "title" : "body"} color={size === "big" ? theme.c.text : theme.c.textMuted} style={{ textTransform: "none", textAlign: "center" }} numberOfLines={3}>
        {lines[i]}
      </T>
    )

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: theme.c.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16, paddingHorizontal: 16, gap: 14 }}>
        <View>
          <T variant="title" numberOfLines={1}>
            Sincronizar a mano
          </T>
          <T variant="caption" color={theme.c.textMuted} numberOfLines={1} style={{ textTransform: "none" }}>
            {song.title} · {fmt(time)} · {Math.min(at, lines.length)} de {lines.length} líneas
          </T>
        </View>

        {lost ? (
          <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
            <T variant="body" style={{ textTransform: "none", textAlign: "center" }}>
              Empezó otra canción, así que se perdieron las marcas. Vuelve a abrir esta canción para sincronizarla.
            </T>
            <Button label="Cerrar" variant="secondary" onPress={onClose} />
          </View>
        ) : !started ? (
          <View style={{ flex: 1, justifyContent: "center", gap: 14 }}>
            <T variant="body" style={{ textTransform: "none" }}>
              La canción empezará desde el principio. Cuando empiece a cantarse cada línea, pulsa «Marcar». Si te equivocas, «Deshacer» quita la última marca y vuelve un poco atrás.
            </T>
            <T variant="caption" color={theme.c.textMuted} style={{ textTransform: "none" }}>
              Al terminar, la letra queda como tuya, con tiempos: las búsquedas no la cambian, y si va un poco adelantada o atrasada la ajustas con − y +.
            </T>
            <Button label="Empezar" icon="play" onPress={start} />
            <Button label="Cancelar" variant="secondary" onPress={onClose} />
          </View>
        ) : (
          <>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", gap: 14 }}>
              {at > 0 && row(at - 1, "small")}
              {done ? (
                <T variant="title" color={theme.c.accent} style={{ textTransform: "none", textAlign: "center" }}>
                  Todas las líneas marcadas
                </T>
              ) : (
                <View style={{ gap: 6 }}>
                  <T variant="label" color={theme.c.accent} style={{ textAlign: "center" }}>
                    Siguiente
                  </T>
                  {row(at, "big")}
                </View>
              )}
              {row(at + 1, "small")}
              {row(at + 2, "small")}
            </ScrollView>

            {done ? (
              <View style={{ gap: 10 }}>
                <Button label="Guardar la letra con tiempos" icon="check" onPress={() => onDone(toLrc(lines, marks))} />
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <Button label="Deshacer" variant="secondary" onPress={undo} />
                  <Button label="Empezar de nuevo" variant="secondary" icon="repeat" onPress={start} />
                  <Button label="Cancelar" variant="secondary" onPress={onClose} />
                </View>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Press
                  onPressIn={mark}
                  accessibilityRole="button"
                  accessibilityLabel="Marcar"
                  radius={theme.radius.lg}
                  style={{ height: 120, borderRadius: theme.radius.lg, backgroundColor: theme.c.accent, alignItems: "center", justifyContent: "center" }}
                >
                  <T variant="title" color={theme.c.onAccent}>
                    Marcar
                  </T>
                </Press>
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <Button label="Deshacer" variant="secondary" disabled={!at} onPress={undo} />
                  <Button label="−5 s" variant="secondary" onPress={back} />
                  <Button label={player.playing ? "Pausa" : "Seguir"} variant="secondary" icon={player.playing ? "pause" : "play"} onPress={player.togglePlaying} />
                  <Button label="Cancelar" variant="secondary" onPress={onClose} />
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  )
}

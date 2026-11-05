import { useMemo, useState } from "react"
import { ScrollView, TextInput, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Song } from "../../data"
import { Button, T, textStyle } from "../../components/ui"
import { useTheme } from "../../themes/ThemeContext"
import { checkSharedLyrics, Reliability } from "../../online/lyricsCheck"
import { SongInfo } from "../../online/useSongInfo"
import { Sheet, useKeyboardHeight } from "./shared"

const LEVEL: Record<Reliability, string> = { alta: "Fiabilidad alta", media: "Fiabilidad media", baja: "Fiabilidad baja" }

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/**
 * Lyrics that another app shared to Retro Beats. They are for the song that is open in the player, and before they are
 * saved the sheet shows which song that is, the first lines, and how far the text can be trusted to fit that recording.
 */
export function SharedLyricsSheet({ text, song, info, onClose }: { text: string | null; song: Song | null; info: SongInfo; onClose: () => void }) {
  const theme = useTheme()
  const [saved, setSaved] = useState<string | null>(null)
  // The person's corrections to the received text, kept only for that text
  const [edit, setEdit] = useState<{ of: string; value: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const keyboard = useKeyboardHeight()
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const listHeight = keyboard ? Math.max(140, windowHeight - keyboard - insets.top - 130) : 520
  const current = text !== null && edit?.of === text ? edit.value : text
  const check = useMemo(() => (current !== null && song ? checkSharedLyrics(current, song) : null), [current, song])
  const close = () => {
    setSaved(null)
    setEdit(null)
    setEditing(false)
    onClose()
  }
  const levelColor = check?.ok ? (check.level === "alta" ? theme.c.accent : check.level === "media" ? theme.c.warm : theme.c.textMuted) : theme.c.textMuted

  return (
    <Sheet visible={text !== null} onClose={close} title="Letra recibida">
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: listHeight }} contentContainerStyle={{ gap: 10 }}>
        {!song ? (
          <>
            <T variant="body" style={{ textTransform: "none" }}>
              Abre primero la canción a la que pertenece esta letra y vuelve a compartirla.
            </T>
            <Button label="Cerrar" variant="secondary" onPress={close} />
          </>
        ) : saved ? (
          <>
            <T variant="body" color={theme.c.accent} style={{ textTransform: "none" }}>
              {saved}
            </T>
            <Button label="Listo" icon="check" onPress={close} />
          </>
        ) : (
          <>
            <T variant="caption" color={theme.c.textMuted} style={{ textTransform: "none" }}>
              Para la canción que está abierta:
            </T>
            <T variant="body" style={{ textTransform: "none" }}>
              «{song.title}» · {song.artist}
              {song.duration > 0 ? ` · ${time(song.duration)}` : ""}
            </T>
            {editing && text !== null ? (
              <>
                <T variant="caption" color={theme.c.textMuted} style={{ textTransform: "none" }}>
                  Corrige la letra: quita lo que sobre y arregla las líneas. Si trae tiempos como [01:23.45], se conservan.
                </T>
                <View style={{ borderRadius: theme.radius.md, borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: theme.c.surface2, paddingHorizontal: 12 }}>
                  <TextInput
                    value={current ?? ""}
                    onChangeText={(value) => setEdit({ of: text, value })}
                    multiline
                    autoFocus
                    accessibilityLabel="Letra"
                    style={[textStyle(theme, "body"), { color: theme.c.text, textTransform: "none", paddingVertical: 10, minHeight: 200, maxHeight: Math.max(160, listHeight - 130), textAlignVertical: "top" as const }]}
                  />
                </View>
                <Button label="Listo, ver cómo queda" icon="check" onPress={() => setEditing(false)} />
              </>
            ) : null}
            {!editing && check && !check.ok && (
              <T variant="body" color={theme.c.warm} style={{ textTransform: "none" }}>
                {check.reason}
              </T>
            )}
            {!editing && check?.ok && (
              <>
                <T variant="label" color={levelColor}>
                  {LEVEL[check.level]} · {check.timed ? "con tiempos" : "sin tiempos"} · {check.lines} líneas
                </T>
                {check.notes.map((n) => (
                  <T key={n} variant="caption" color={theme.c.textMuted} style={{ textTransform: "none" }}>
                    • {n}
                  </T>
                ))}
                <View style={{ borderRadius: theme.radius.md, borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: theme.c.surface2, padding: 12, gap: 4 }}>
                  {check.preview.map((row, i) => (
                    <T key={i} variant="caption" style={{ textTransform: "none" }} numberOfLines={1}>
                      {row}
                    </T>
                  ))}
                  {check.lines > check.preview.length && (
                    <T variant="caption" color={theme.c.textMuted} style={{ textTransform: "none" }}>
                      …
                    </T>
                  )}
                </View>
                <Button
                  label={check.level === "baja" ? "Usar de todos modos" : "Usar como letra de esta canción"}
                  icon="lyrics"
                  onPress={() => {
                    const ok = info.importLyrics(song, check.text)
                    setSaved(
                      ok
                        ? check.timed
                          ? "Letra guardada. Sigue la canción con los tiempos que trae; si va adelantada o atrasada, ajústala con − y +."
                          : "Letra guardada, sin tiempos. Pulsa «Sincronizar» en el reproductor para buscar su versión con tiempos."
                        : "No se pudo leer esa letra.",
                    )
                  }}
                />
              </>
            )}
            {!editing && (
              <Button
                label="Editar la letra"
                variant="secondary"
                icon="lyrics"
                onPress={() => {
                  if (text === null) return
                  // Start from the cleaned text when there is one
                  setEdit({ of: text, value: check?.ok ? check.text : (current ?? text) })
                  setEditing(true)
                }}
              />
            )}
            <Button label="Descartar" variant="secondary" onPress={close} />
          </>
        )}
      </ScrollView>
    </Sheet>
  )
}

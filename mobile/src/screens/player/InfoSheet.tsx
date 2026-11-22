import { useRef, useState } from "react"
import { Alert, ScrollView, ScrollViewInstance, StyleSheet, TextInput, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Clipboard from "expo-clipboard"
import { Song } from "../../data"
import { Button, T, textStyle } from "../../components/ui"
import { useTheme } from "../../themes/ThemeContext"
import { SongInfo } from "../../online/useSongInfo"
import { looksLikeRomaji } from "../../online/japanese"
import { lyricsToText } from "../../online/lrclib"
import { LyricsWebSheet } from "./LyricsWebSheet"
import { SharedLyricsSheet } from "./SharedLyricsSheet"
import { Sheet, useKeyboardHeight } from "./shared"

/**
 * Lets the person correct what the app got wrong: the title and artist (the databases then never replace them) and the
 * lyrics, which they can look for on the internet and paste here, with or without [mm:ss] times. It also takes the song out of the app or deletes its file.
 */
export function InfoSheet({ song, info, visible, onClose, onDelete }: { song: Song; info: SongInfo; visible: boolean; onClose: () => void; onDelete: (fromPhone: boolean) => Promise<boolean> }) {
  const theme = useTheme()
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist)
  const [lyrics, setLyrics] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const scroll = useRef<ScrollViewInstance>(null)
  const keyboard = useKeyboardHeight()
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // With the keyboard open, the list shrinks to the room left above it (minus the sheet's handle, title and padding)
  const listHeight = keyboard ? Math.max(140, windowHeight - keyboard - insets.top - 130) : 520

  const field = (value: string, set: (v: string) => void, label: string, multiline = false) => (
    <View style={{ borderRadius: theme.radius.md, borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: theme.c.surface2, paddingHorizontal: 12 }}>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={label}
        placeholderTextColor={theme.c.textMuted}
        accessibilityLabel={label}
        multiline={multiline}
        // The field being typed in goes to the top of the visible list: the lyrics box is at the end, the others near the start
        onFocus={() => setTimeout(() => (multiline ? scroll.current?.scrollToEnd({ animated: true }) : scroll.current?.scrollTo({ y: 0, animated: true })), 250)}
        style={[textStyle(theme, "body"), { color: theme.c.text, textTransform: "none", paddingVertical: 10, ...(multiline ? { minHeight: 110, maxHeight: 260, textAlignVertical: "top" as const } : null) }]}
      />
    </View>
  )
  // The search happens inside the app; what the person picks goes through the same check as lyrics shared from another app
  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState<string | null>(null)
  const hasLyrics = !!song.lyrics?.length || !!song.plain?.trim()
  const hasReading = !!(song.lyrics?.length ? song.romaji : song.plainRomaji)?.some((r) => r.trim())
  const confirmDelete = (fromPhone: boolean) =>
    Alert.alert(
      fromPhone ? "¿Borrar del teléfono?" : "¿Quitar de la app?",
      fromPhone ? `«${song.title}» se borra del teléfono y no se puede recuperar.` : `«${song.title}» deja de aparecer en la app. El archivo sigue en el teléfono.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: fromPhone ? "Borrar" : "Quitar", style: "destructive", onPress: () => void onDelete(fromPhone).then((ok) => ok && onClose()) },
      ],
    )

  return (
    <Sheet visible={visible} onClose={onClose} title="Datos y letra">
      {/* What the last action did stays in sight, whatever part of the sheet is scrolled to */}
      {!!message && (
        <T variant="caption" color={theme.c.accent} style={{ textTransform: "none", marginBottom: 8 }} accessibilityLiveRegion="polite">
          {message}
        </T>
      )}
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" style={{ maxHeight: listHeight }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
        <T variant="label" color={theme.c.textMuted}>
          Canción
        </T>
        {field(title, setTitle, "Título")}
        {field(artist, setArtist, "Artista")}
        <View style={styles.row}>
          <Button
            label="Intercambiar"
            variant="secondary"
            icon="repeat"
            style={styles.half}
            disabled={!artist.trim() || artist === "Artista desconocido"}
            onPress={() => {
              setTitle(artist)
              setArtist(title)
            }}
          />
          <Button
            label="Guardar"
            icon="check"
            style={styles.half}
            disabled={!title.trim() || (title === song.title && artist === song.artist)}
            onPress={() => {
              info.editSong(song, { title, artist })
              setMessage("Guardado. Buscando la letra y la carátula con estos datos…")
            }}
          />
        </View>

        <T variant="label" color={theme.c.textMuted} style={styles.heading}>
          Letra
        </T>
        {hasLyrics && (
          <>
            <T variant="caption" color={theme.c.textMuted} style={{ textTransform: "none" }}>
              ¿Un error en la letra? Corrígela{hasReading ? " con su romaji" : ""}: los tiempos se conservan.
            </T>
            <View style={styles.row}>
              <Button
                label="Corregir aquí"
                variant="secondary"
                icon="check"
                style={styles.half}
                onPress={() => {
                  setLyrics(lyricsToText(song))
                  setMessage("La letra está en el cuadro: corrígela y pulsa «Guardar letra».")
                  setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250)
                }}
              />
              <Button
                label="Copiar"
                variant="secondary"
                icon="lyrics"
                style={styles.half}
                onPress={async () => {
                  await Clipboard.setStringAsync(lyricsToText(song)).catch(() => {})
                  setMessage(hasReading ? "Letra copiada: japonés y romaji, línea por línea. Corrígela y pégala con «Pegar»." : "Letra copiada. Corrígela y pégala con «Pegar».")
                }}
              />
            </View>
          </>
        )}
        <T variant="caption" color={theme.c.textMuted} style={{ textTransform: "none" }}>
          {hasLyrics ? "¿Otra letra?" : "La app no la encontró."} Búscala en internet o pégala; con tiempos como [01:23.45] se sincroniza.
        </T>
        <View style={styles.row}>
          <Button label="Buscar" variant="secondary" icon="search" style={styles.half} onPress={() => setSearching(true)} />
          <Button
            label="Pegar"
            variant="secondary"
            icon="lyrics"
            style={styles.half}
            onPress={async () => {
              const text = (await Clipboard.getStringAsync().catch(() => "")).trim()
              if (!text) return setMessage("El portapapeles está vacío: copia la letra primero.")
              // One tap: what was copied is saved as this song's lyrics
              const ok = info.importLyrics(song, text)
              setMessage(ok ? "Letra pegada y guardada." : "Lo copiado no parece una letra.")
            }}
          />
        </View>
        {field(lyrics, setLyrics, "Escribe o pega aquí la letra", true)}
        {!!lyrics.trim() && (
          <Button
            label="Guardar letra"
            icon="check"
            onPress={() => {
              const ok = info.importLyrics(song, lyrics)
              setMessage(ok ? "Letra guardada." : "No se pudo leer esa letra.")
              if (ok) setLyrics("")
            }}
          />
        )}
        {!!song.lyrics && looksLikeRomaji(song.lyrics.map((l) => l.text)) && (
          <>
            <T variant="caption" color={theme.c.textMuted} style={{ textTransform: "none" }}>
              Esta letra está solo en romaji. La app puede buscar el original en japonés y mostrarlo con tu romaji debajo.
            </T>
            <Button label={info.japaneseBusy === song.id ? "Buscando el japonés…" : "Buscar la letra en japonés"} variant="secondary" icon="lyrics" disabled={info.japaneseBusy === song.id} onPress={() => void info.addJapanese(song)} />
            {!!info.japaneseMessage && (
              <T variant="caption" color={theme.c.accent} style={{ textTransform: "none" }}>
                {info.japaneseMessage}
              </T>
            )}
          </>
        )}
        {info.hasPreviousLyrics(song.id) && (
          <Button
            label="Restaurar la letra anterior"
            variant="secondary"
            icon="repeat"
            onPress={async () => setMessage((await info.restorePreviousLyrics(song.id)) ? "Letra anterior restaurada." : "No se pudo restaurar la letra anterior.")}
          />
        )}

        <T variant="label" color={theme.c.danger} style={styles.heading}>
          Eliminar
        </T>
        <Button label="Quitar de la app" variant="danger" icon="close" onPress={() => confirmDelete(false)} />
        <Button label="Borrar del teléfono" variant="danger" icon="close" onPress={() => confirmDelete(true)} />
      </ScrollView>
      <LyricsWebSheet
        song={song}
        visible={searching}
        onClose={() => setSearching(false)}
        onText={(text) => {
          setSearching(false)
          setFound(text)
        }}
      />
      <SharedLyricsSheet text={found} song={song} info={info} onClose={() => setFound(null)} />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  heading: { marginTop: 14 },
})

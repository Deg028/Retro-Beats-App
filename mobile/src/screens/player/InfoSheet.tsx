import { useRef, useState } from "react"
import { Alert, ScrollView, ScrollViewInstance, TextInput, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Clipboard from "expo-clipboard"
import { Song } from "../../data"
import { Button, T, textStyle } from "../../components/ui"
import { useTheme } from "../../themes/ThemeContext"
import { SongInfo } from "../../online/useSongInfo"
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
        style={[textStyle(theme, "body"), { color: theme.c.text, textTransform: "none", paddingVertical: 10, ...(multiline ? { minHeight: 110, maxHeight: 180, textAlignVertical: "top" as const } : null) }]}
      />
    </View>
  )
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
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" style={{ maxHeight: listHeight }} contentContainerStyle={{ gap: 10 }}>
        <T variant="label" color={theme.c.textMuted}>
          Canción
        </T>
        {field(title, setTitle, "Título")}
        {field(artist, setArtist, "Artista")}
        <Button
          label="Intercambiar título y artista"
          variant="secondary"
          icon="repeat"
          disabled={!artist.trim() || artist === "Artista desconocido"}
          onPress={() => {
            setTitle(artist)
            setArtist(title)
          }}
        />
        <Button
          label="Guardar y buscar de nuevo"
          icon="check"
          disabled={!title.trim()}
          onPress={() => {
            info.editSong(song, { title, artist })
            setMessage("Guardado. Buscando la letra y la carátula con estos datos…")
          }}
        />

        <T variant="label" color={theme.c.textMuted} style={{ marginTop: 8 }}>
          Letra
        </T>
        <T variant="caption" color={theme.c.textMuted} style={{ textTransform: "none" }}>
          Si la app no la encuentra, cópiala y pégala aquí. Si trae tiempos como [01:23.45], se sincroniza con la canción.
        </T>
        <Button
          label="Pegar del portapapeles"
          variant="secondary"
          icon="lyrics"
          onPress={async () => {
            const text = (await Clipboard.getStringAsync().catch(() => "")).trim()
            if (!text) return setMessage("El portapapeles está vacío: copia la letra primero.")
            // One tap: what was copied is saved as this song's lyrics
            const ok = info.importLyrics(song, text)
            setMessage(ok ? "Letra pegada y guardada." : "Lo copiado no parece una letra.")
          }}
        />
        {field(lyrics, setLyrics, "Pega aquí la letra", true)}
        <Button
          label="Guardar letra"
          icon="lyrics"
          disabled={!lyrics.trim()}
          onPress={() => {
            const ok = info.importLyrics(song, lyrics)
            setMessage(ok ? "Letra guardada." : "No se pudo leer esa letra.")
            if (ok) setLyrics("")
          }}
        />

        <T variant="label" color={theme.c.textMuted} style={{ marginTop: 8 }}>
          Eliminar
        </T>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Button label="Quitar de la app" variant="secondary" icon="close" onPress={() => confirmDelete(false)} />
          <Button label="Borrar del teléfono" variant="secondary" icon="close" onPress={() => confirmDelete(true)} />
        </View>
        {!!message && (
          <T variant="caption" color={theme.c.accent} style={{ textTransform: "none" }}>
            {message}
          </T>
        )}
      </ScrollView>
    </Sheet>
  )
}

import { useState } from "react"
import { Linking, ScrollView, TextInput, View } from "react-native"
import { Song } from "../../data"
import { Button, T, textStyle } from "../../components/ui"
import { useTheme } from "../../themes/ThemeContext"
import { SongInfo } from "../../online/useSongInfo"
import { Sheet } from "./shared"

/**
 * Lets the person correct what the app got wrong: the title and artist (the databases then never replace them) and the
 * lyrics, which they can look for on the internet and paste here, with or without [mm:ss] times.
 */
export function InfoSheet({ song, info, visible, onClose }: { song: Song; info: SongInfo; visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist)
  const [lyrics, setLyrics] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const field = (value: string, set: (v: string) => void, label: string, multiline = false) => (
    <View style={{ borderRadius: theme.radius.md, borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: theme.c.surface2, paddingHorizontal: 12 }}>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={label}
        placeholderTextColor={theme.c.textMuted}
        accessibilityLabel={label}
        multiline={multiline}
        style={[textStyle(theme, "body"), { color: theme.c.text, textTransform: "none", paddingVertical: 10, ...(multiline ? { minHeight: 110, maxHeight: 180, textAlignVertical: "top" as const } : null) }]}
      />
    </View>
  )
  const terms = encodeURIComponent(`${song.title} ${song.artist === "Artista desconocido" ? "" : song.artist}`.trim())
  const open = (url: string) => Linking.openURL(url).catch(() => setMessage("No se pudo abrir el navegador."))

  return (
    <Sheet visible={visible} onClose={onClose} title="Datos y letra">
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 10 }}>
        <T variant="label" color={theme.c.textMuted}>
          Canción
        </T>
        {field(title, setTitle, "Título")}
        {field(artist, setArtist, "Artista")}
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
          Si la app no la encuentra, búscala en internet, cópiala y pégala aquí. Si trae tiempos como [01:23.45], se sincroniza con la canción.
        </T>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Button label="Buscar en Genius" variant="secondary" icon="search" onPress={() => open(`https://genius.com/search?q=${terms}`)} />
          <Button label="Buscar en Google" variant="secondary" icon="search" onPress={() => open(`https://www.google.com/search?q=${terms}+letra+lyrics`)} />
        </View>
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
        {!!message && (
          <T variant="caption" color={theme.c.accent} style={{ textTransform: "none" }}>
            {message}
          </T>
        )}
      </ScrollView>
    </Sheet>
  )
}

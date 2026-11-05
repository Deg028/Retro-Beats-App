import { ComponentType, Ref, useRef, useState } from "react"
import { Modal, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { WebView as NativeWebView, WebViewMessageEvent } from "react-native-webview"
import { Song } from "../../data"
import { Button, Chip, T } from "../../components/ui"
import { useTheme } from "../../themes/ThemeContext"

type Engine = "genius" | "google"
type WebHandle = { injectJavaScript: (script: string) => void }
// The package's own typings do not match this React Native version's, so only the props used here are declared
const WebView = NativeWebView as unknown as ComponentType<{
  ref?: Ref<WebHandle>
  source: { uri: string }
  onMessage: (e: WebViewMessageEvent) => void
  style: object
  setSupportMultipleWindows: boolean
}>

// Runs inside the page the person is looking at: the lyrics block of a Genius page, or else the text they selected
const GRAB = `(function () {
  var text = ""
  var blocks = document.querySelectorAll('[data-lyrics-container="true"]')
  blocks.forEach(function (b) {
    var copy = b.cloneNode(true)
    copy.querySelectorAll("br").forEach(function (br) { br.replaceWith("\\n") })
    text += copy.textContent + "\\n"
  })
  if (!text.trim()) text = String(window.getSelection() || "")
  window.ReactNativeWebView.postMessage(JSON.stringify({ text: text }))
})();
true;`

/**
 * Looks for a song's lyrics on Genius or Google without leaving the app. The person browses as usual and presses the
 * button on the page that has the lyrics: on Genius it takes the lyrics block, anywhere else the text they selected.
 * The text then goes through the same reliability check as lyrics shared from another app.
 */
export function LyricsWebSheet({ song, visible, onClose, onText }: { song: Song; visible: boolean; onClose: () => void; onText: (text: string) => void }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const web = useRef<WebHandle>(null)
  const [engine, setEngine] = useState<Engine>("genius")
  const [notice, setNotice] = useState<string | null>(null)

  const terms = encodeURIComponent(`${song.title} ${song.artist === "Artista desconocido" ? "" : song.artist}`.trim())
  const url = engine === "genius" ? `https://genius.com/search?q=${terms}` : `https://www.google.com/search?q=${terms}+letra+lyrics`

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const { text } = JSON.parse(e.nativeEvent.data) as { text: string }
      if (!text.trim()) return setNotice("Abre la página con la letra (en Genius se toma sola) o selecciona el texto de la letra y vuelve a pulsar.")
      setNotice(null)
      onText(text)
    } catch {
      setNotice("No se pudo leer la página.")
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: theme.c.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
          <View style={{ flex: 1 }}>
            <T variant="title" numberOfLines={1}>
              Buscar la letra
            </T>
            <T variant="caption" color={theme.c.textMuted} numberOfLines={1} style={{ textTransform: "none" }}>
              {song.title}
              {song.artist !== "Artista desconocido" ? ` · ${song.artist}` : ""}
            </T>
          </View>
          <Chip label="Genius" active={engine === "genius"} onPress={() => setEngine("genius")} />
          <Chip label="Google" active={engine === "google"} onPress={() => setEngine("google")} />
        </View>
        {/* Changing the engine changes the key, so the page loads again with the new search */}
        <WebView ref={web} key={url} source={{ uri: url }} onMessage={onMessage} style={{ flex: 1, backgroundColor: theme.c.bg }} setSupportMultipleWindows={false} />
        <View style={{ gap: 8, padding: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.c.surface }}>
          {!!notice && (
            <T variant="caption" color={theme.c.accent} style={{ textTransform: "none" }}>
              {notice}
            </T>
          )}
          <T variant="caption" color={theme.c.textMuted} style={{ textTransform: "none" }}>
            Entra en el resultado con la letra y pulsa el botón. Si la página no es de Genius, selecciona antes el texto de la letra.
          </T>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Button label="Usar la letra de esta página" icon="lyrics" onPress={() => web.current?.injectJavaScript(GRAB)} />
            <Button label="Cerrar" variant="secondary" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

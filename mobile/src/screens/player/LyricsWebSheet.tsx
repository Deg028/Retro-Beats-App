import { ComponentType, Ref, useRef, useState } from "react"
import { Modal, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { WebView as NativeWebView, WebViewMessageEvent } from "react-native-webview"
import { Song } from "../../data"
import { Button, Chip, T } from "../../components/ui"
import { useTheme } from "../../themes/ThemeContext"

type Engine = "genius" | "letras" | "musixmatch" | "google"
// The order the search moves through when a page has no lyrics: Genius first, then the two lyric sites, then Google
const ENGINES: { id: Engine; label: string }[] = [
  { id: "genius", label: "Genius" },
  { id: "letras", label: "Letras.com" },
  { id: "musixmatch", label: "Musixmatch" },
  { id: "google", label: "Google" },
]
// Letras.com's own search is a Google embed and Musixmatch answers its search address with a 403 inside a WebView, so both
// are reached through Google limited to the site; the person opens the result and presses the button there
const searchUrl = (engine: Engine, terms: string) =>
  engine === "genius"
    ? `https://genius.com/search?q=${terms}`
    : engine === "letras"
      ? `https://www.google.com/search?q=${terms}+letra+site%3Aletras.com`
      : engine === "musixmatch"
        ? `https://www.google.com/search?q=${terms}+lyrics+site%3Amusixmatch.com`
        : `https://www.google.com/search?q=${terms}+letra+lyrics`

type WebHandle = { injectJavaScript: (script: string) => void }
// The package's own typings do not match this React Native version's, so only the props used here are declared
const WebView = NativeWebView as unknown as ComponentType<{
  ref?: Ref<WebHandle>
  source: { uri: string }
  onMessage: (e: WebViewMessageEvent) => void
  style: object
  setSupportMultipleWindows: boolean
}>

// Runs inside the page the person is looking at. What they selected wins; otherwise the lyrics block of Genius or of
// other well-known lyric sites; otherwise the biggest block of the page that looks like lyrics.
const GRAB = `(function () {
  var text = String(window.getSelection() || "")
  if (text.trim().length < 20) {
    text = ""
    var blocks = document.querySelectorAll('[data-lyrics-container="true"]')
    blocks.forEach(function (b) { text += b.innerText + "\\n" })
    var known = ['.lyric-original', '.cnt-letra', '.mxm-lyrics__content', '[class*="lyrics__content"]', '#lyric-body-text', '#lyrics', '.lyrics', '.ringtone ~ div:not([class])', '[class*="Lyrics__Container"]', '[class*="lyric"]', '[id*="lyric"]']
    for (var i = 0; i < known.length && text.trim().length < 80; i++) {
      var best = ""
      document.querySelectorAll(known[i]).forEach(function (el) {
        var t = el.innerText || ""
        if (t.length > best.length && t.length < 12000) best = t
      })
      if (best.trim().length >= 80) text = best
    }
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({ text: text, url: location.href }))
})();
true;`

/**
 * Looks for a song's lyrics on Genius, Letras.com, Musixmatch or Google without leaving the app. The person browses as usual and presses the
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
  const url = searchUrl(engine, terms)

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const { text } = JSON.parse(e.nativeEvent.data) as { text: string }
      // Under 4 lines is a results list or a heading the page script picked up, not a song (the check would refuse it anyway)
      if (text.split("\n").filter((l) => l.trim()).length < 4) {
        // A results page or a page with no lyrics: try the next site of the list instead of leaving the person stuck
        const at = ENGINES.findIndex((x) => x.id === engine)
        const next = ENGINES[at + 1]
        if (next) {
          setEngine(next.id)
          return setNotice(`No encontré la letra en ${ENGINES[at].label}: busco en ${next.label}. Entra en la canción y vuelve a pulsar el botón.`)
        }
        return setNotice("No encontré la letra en esta página: selecciona el texto de la letra (mantén pulsado y arrastra) y vuelve a pulsar.")
      }
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
              Buscar letra
            </T>
            <T variant="caption" color={theme.c.textMuted} numberOfLines={1} style={{ textTransform: "none" }}>
              {song.title}
              {song.artist !== "Artista desconocido" ? ` · ${song.artist}` : ""}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", paddingHorizontal: 16, paddingBottom: 8 }}>
          {ENGINES.map((e) => (
            <Chip key={e.id} label={e.label} active={engine === e.id} onPress={() => setEngine(e.id)} />
          ))}
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
            Entra en cualquier página con la letra y pulsa el botón. Si seleccionas un texto, se usa ese; si no, la app busca la letra en la página. Podrás corregirla antes de guardarla.
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

import { useState } from "react"
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from "react-native"
import { Button, Chip, Icon, Surface, T } from "../components/ui"
import { useTheme } from "../themes/ThemeContext"
import { SKIP_LABEL, SkipReason } from "../library/files"
import { folderLabel } from "../library/scan"
import { DEFAULT_MIN_SECONDS, DeviceLibrary } from "../library/useDeviceLibrary"
import { SongInfo } from "../online/useSongInfo"
import { PlayerApi } from "../usePlayer"

const REASONS: SkipReason[] = ["format", "empty", "short"]
// Names listed per reason before "and N more", so a huge folder doesn't make the screen endless
const SHOWN = 30

const span = (seconds: number) => {
  const m = Math.round(seconds / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}

const clock = (t: number) => new Date(t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })

/** Phone music: what the scan found, what it left out and why, and what could not be played. */
export default function Scan({ lib, player, info, onOpenHome }: { lib: DeviceLibrary; player: PlayerApi; info: SongInfo; onOpenHome: () => void }) {
  const theme = useTheme()
  const [open, setOpen] = useState<SkipReason | "broken" | null>(null)
  const { access, phase, tracks, skipped } = lib
  const byFolder = lib.mode === "folders"
  const scanning = phase === "scanning"
  const total = tracks.length + skipped.length
  const totalTime = tracks.reduce((n, t) => n + t.duration, 0)
  const count = (r: SkipReason) => skipped.filter((f) => f.reason === r).length

  const status = (() => {
    if (byFolder && !lib.folders.length && !scanning && phase !== "error")
      return {
        icon: "player" as const,
        title: "Elige tu carpeta de música",
        text: "Esta versión de prueba no puede leer toda la música del teléfono sola. Elige la carpeta donde guardas tus canciones (por ejemplo Music) una sola vez: Android recuerda el permiso y la app la revisa cada vez que la abres.",
      }
    if (scanning) return { icon: "player" as const, title: "Buscando música…", text: lib.progress ? `${lib.progress} archivos revisados` : "Pidiendo la lista al teléfono" }
    if (access === "blocked")
      return { icon: "close" as const, title: "Android bloqueó el permiso", text: "Para leer tu música hay que activarlo a mano en los ajustes de la app, en Permisos." }
    if (phase === "error")
      return { icon: "close" as const, title: "No se pudo leer la música", text: lib.error ?? "Error desconocido" }
    if (access === "denied" && phase !== "done")
      return {
        icon: "player" as const,
        title: "Tu música, en Retro Beats",
        text: "Buscaremos los archivos de audio del teléfono. Solo se lee la lista y el nombre de cada archivo; nada sale del teléfono.",
      }
    return {
      icon: "check" as const,
      title: `${tracks.length} canciones encontradas`,
      text: `${total} archivos de audio revisados${lib.scannedAt ? ` a las ${clock(lib.scannedAt)}` : ""}${totalTime > 0 ? ` · ${span(totalTime)} de música` : ""}`,
    }
  })()

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={{ gap: 4 }}>
        <T variant="label" color={theme.c.textMuted}>
          Biblioteca
        </T>
        <T variant="display">Música del teléfono</T>
      </View>

      {lib.isSample && (
      <Surface tone="surface2" style={styles.note}>
          <T variant="caption" color={theme.c.textMuted}>
            Vista previa en el navegador: estos archivos son de ejemplo. En el teléfono se leen los reales.
          </T>
        </Surface>
      )}

      <Surface style={styles.status}>
        <View style={styles.statusHead}>
          {scanning ? <ActivityIndicator color={theme.c.accent} /> : <Icon name={status.icon} size={26} color={theme.c.accent} />}
          <T variant="title" style={{ flex: 1 }}>
            {status.title}
          </T>
        </View>
        <T variant="caption" color={theme.c.textMuted}>
          {status.text}
        </T>
        <View style={styles.row}>
          {byFolder ? (
            <>
              <Button label={lib.folders.length ? "Añadir otra carpeta" : "Elegir carpeta de música"} icon="player" disabled={scanning} onPress={lib.addFolder} />
              {lib.folders.length > 0 && <Button label="Buscar de nuevo" variant="secondary" icon="check" disabled={scanning} onPress={() => lib.scan(false)} />}
            </>
          ) : access === "blocked" ? (
            <Button label="Abrir ajustes" icon="themes" onPress={() => Linking.openSettings().catch(() => {})} />
          ) : (
            <Button
              label={phase === "done" ? "Buscar de nuevo" : access === "denied" ? "Dar permiso y buscar" : "Reintentar"}
              icon="player"
              disabled={scanning}
              onPress={() => lib.scan(true)}
            />
          )}
          {tracks.length > 0 && <Button label="Ver canciones" variant="secondary" icon="home" onPress={onOpenHome} />}
        </View>
      </Surface>

      {byFolder && lib.folders.length > 0 && (
        <View style={{ gap: 10 }}>
          <T variant="title">Carpetas de música</T>
          {lib.folders.map((uri) => {
            const issue = lib.issues.find((i) => i.uri === uri)
            return (
              <Surface key={uri} style={{ padding: 12, gap: 6 }}>
                <View style={styles.statusHead}>
                  <T variant="body" style={{ flex: 1 }} numberOfLines={2}>
                    {folderLabel(uri)}
                  </T>
                  <Chip label="Quitar" active={false} onPress={() => lib.removeFolder(uri)} />
                </View>
                {issue && (
                  <T variant="caption" color={theme.c.danger}>
                    No se pudo leer esta carpeta; puede que Android haya quitado el permiso. Quítala y vuelve a elegirla.
                  </T>
                )}
              </Surface>
            )
          })}
        </View>
      )}

      {phase === "done" && (
        <View style={{ gap: 10 }}>
          <T variant="title">Archivos omitidos y por qué</T>
          {skipped.length === 0 && (
            <T variant="caption" color={theme.c.textMuted}>
              No se omitió ningún archivo.
            </T>
          )}
          {REASONS.filter((r) => count(r) > 0).map((r) => (
            <Surface key={r} style={{ padding: 12, gap: 6 }}>
              <View style={styles.statusHead}>
                <T variant="body" style={{ flex: 1 }}>
                  {SKIP_LABEL[r].title}
                </T>
                <T variant="number" color={theme.c.highlight}>
                  {count(r)}
                </T>
              </View>
              <T variant="caption" color={theme.c.textMuted}>
                {SKIP_LABEL[r].hint}
              </T>
              <View style={styles.row}>
                <Chip label={open === r ? "Ocultar" : "Ver archivos"} active={open === r} onPress={() => setOpen(open === r ? null : r)} />
                {r === "short" && (
                  <Chip
                    label={lib.minSeconds === 0 ? "Volver a omitirlos" : "Incluirlos"}
                    active={lib.minSeconds === 0}
                    onPress={() => lib.setMinSeconds(lib.minSeconds === 0 ? DEFAULT_MIN_SECONDS : 0)}
                  />
                )}
              </View>
              {open === r && <Names names={skipped.filter((f) => f.reason === r).map((f) => f.name)} />}
            </Surface>
          ))}
          {lib.minSeconds === 0 && (
            <T variant="caption" color={theme.c.textMuted}>
              Los archivos muy cortos están incluidos en tu biblioteca.
            </T>
          )}
        </View>
      )}

      {player.broken.length > 0 && (
        <View style={{ gap: 10 }}>
          <T variant="title">No se pudieron reproducir</T>
          <Surface style={{ padding: 12, gap: 6 }}>
            <T variant="caption" color={theme.c.textMuted}>
              Estos archivos fallaron al abrirse y se saltan hasta que los toques de nuevo. Puede ser un archivo movido, borrado o en una tarjeta SD desmontada.
            </T>
            <Chip label={open === "broken" ? "Ocultar" : `Ver ${player.broken.length}`} active={open === "broken"} onPress={() => setOpen(open === "broken" ? null : "broken")} />
            {open === "broken" && <Names names={player.broken.map((s) => `${s.artist} - ${s.title}`)} />}
          </Surface>
        </View>
      )}

      {tracks.length > 0 && (
        <View style={{ gap: 10 }}>
          <T variant="title">Carátulas y letras de internet</T>
          <Surface style={{ padding: 12, gap: 8 }}>
            <View style={styles.statusHead}>
              <T variant="body" style={{ flex: 1 }}>
                Buscar al reproducir
              </T>
              <Chip label={info.enabled ? "Activada" : "Desactivada"} active={info.enabled} onPress={() => info.setEnabled(!info.enabled)} />
            </View>
            <T variant="caption" color={theme.c.textMuted}>
              Al sonar una canción se busca su carátula original (catálogo de Apple Music, MusicBrainz y Cover Art Archive) y su letra (LRCLIB). Solo se envía el título y el artista, sin tu cuenta ni tus archivos. Lo que se encuentra se guarda en el teléfono y no se vuelve a pedir. Si activas «Romaji» en el reproductor, las líneas con kanji de la letra se envían una a una a Google Traductor para leerlas.
            </T>
            <T variant="caption" color={theme.c.highlight}>
              {info.withCover} con carátula · {info.withLyrics} con letra
            </T>
            {info.bulk ? (
              <View style={{ gap: 8 }}>
                <T variant="caption">
                  Buscando {info.bulk.done} de {info.bulk.total}… Sigue mientras la app esté abierta.
                </T>
                <View style={[styles.bar, { backgroundColor: theme.c.surface2 }]}>
                  <View style={{ width: `${info.bulk.total ? (info.bulk.done / info.bulk.total) * 100 : 0}%`, height: 6, backgroundColor: theme.c.accent }} />
                </View>
                <Button label="Detener" variant="secondary" icon="close" onPress={info.stopBulk} />
              </View>
            ) : (
              <Button label="Completar toda la biblioteca" icon="check" disabled={!info.enabled} onPress={() => info.enrichAll(player.library)} />
            )}
            {info.bulkError && (
              <T variant="caption" color={theme.c.danger}>
                {info.bulkError}
              </T>
            )}
          </Surface>
        </View>
      )}

      {tracks.length > 0 && byFolder && (
      <View style={{ gap: 10 }}>
        <T variant="title">Descargas de SnapTube</T>
        <Surface style={{ padding: 12, gap: 8 }}>
          <T variant="caption" color={theme.c.textMuted}>
            SnapTube guarda la miniatura del video de cada descarga. Elige su carpeta «db» (en Almacenamiento interno / snaptube) y la app la usa como carátula de las canciones que no tienen una oficial. Solo se lee el historial en el teléfono; las miniaturas se bajan de YouTube.
          </T>
          <T variant="caption" color={theme.c.highlight}>
            {info.withThumb} con miniatura de SnapTube
          </T>
          {info.thumbs ? (
            <View style={{ gap: 8 }}>
              <T variant="caption">
                Guardando {info.thumbs.done} de {info.thumbs.total}…
              </T>
              <View style={[styles.bar, { backgroundColor: theme.c.surface2 }]}>
                <View style={{ width: `${info.thumbs.total ? (info.thumbs.done / info.thumbs.total) * 100 : 0}%`, height: 6, backgroundColor: theme.c.accent }} />
              </View>
            </View>
          ) : (
            <Button
              label={info.snaptubeLinked ? "Actualizar desde SnapTube" : "Conectar SnapTube"}
              icon="check"
              onPress={() => info.importThumbnails(player.library, !info.snaptubeLinked)}
            />
          )}
          {info.snaptubeLinked && !info.thumbs && (
            <T variant="caption" color={theme.c.textMuted} onPress={() => info.importThumbnails(player.library, true)}>
              Elegir otra carpeta
            </T>
          )}
          {info.thumbsMessage && (
            <T variant="caption" color={theme.c.text}>
              {info.thumbsMessage}
            </T>
          )}
        </Surface>
      </View>
    )}

      <Surface tone="surface2" style={styles.note}>
        <T variant="label" color={theme.c.highlight}>
          Por ahora
        </T>
        <T variant="caption" color={theme.c.textMuted}>
          Los títulos y artistas salen del nombre de cada archivo (se limpian los textos que dejan las descargas de YouTube) y, cuando internet los reconoce, se corrigen. Las portadas son de pixel art hasta que se encuentra la original. {byFolder ? "La duración aparece la primera vez que suena cada canción. " : ""}Leer las etiquetas y la carátula que ya trae el archivo llega con la versión instalable de la app, que además lee toda la música sin elegir carpetas.
        </T>
      </Surface>
    </ScrollView>
  )
}

function Names({ names }: { names: string[] }) {
  const theme = useTheme()
  return (
    <View style={{ gap: 2, marginTop: 4 }}>
      {names.slice(0, SHOWN).map((n, i) => (
        <T key={i} variant="caption" numberOfLines={1} color={theme.c.text}>
          {n}
        </T>
      ))}
      {names.length > SHOWN && (
        <T variant="caption" color={theme.c.textMuted}>
          y {names.length - SHOWN} más
        </T>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  status: { padding: 14, gap: 10 },
  statusHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  note: { padding: 12, gap: 4 },
  bar: { height: 6, overflow: "hidden" },
})

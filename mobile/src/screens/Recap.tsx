import { useEffect, useReducer, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { Chip, Press, Surface, T } from "../components/ui"
import { formatListening, monthsWithData, Period, periodLabel, periodOf, Ranked, shiftPeriod, summarize } from "../recap"
import { useTheme } from "../themes/ThemeContext"
import { Listening } from "../useListening"

const TOP = 10

/** The recap of a month or a year of listening: hours, the song, artist and album heard most, and the top list. */
export default function Recap({ listening, initial }: { listening: Listening; initial?: Period | null }) {
  const theme = useTheme()
  const [today] = useState(() => new Date())
  const [kind, setKind] = useState<Period["kind"]>(initial?.kind ?? "month")
  const [period, setPeriod] = useState<Period>(initial ?? periodOf("month", today))
  // The time of the song that is playing keeps growing while this is open
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const timer = setInterval(refresh, 5000)
    return () => clearInterval(timer)
  }, [])
  const log = listening.read()
  const summary = summarize(log, period)
  const first = monthsWithData(log)[0]
  const earliest = first ? (kind === "year" ? first.slice(0, 4) : first) : null
  const now = periodOf(kind, today)
  const canBack = !!earliest && period.key > earliest
  const canForward = period.key < now.key

  const pick = (next: Period["kind"]) => {
    setKind(next)
    setPeriod(periodOf(next, today))
  }
  const label = periodLabel(period)
  const top = summary.songs.slice(0, TOP)
  const max = top[0]?.seconds || 1

  const highlight = (label: string, item: Ranked | undefined, empty: string, detail?: string) => (
    <Surface tone="surface2" style={styles.highlight}>
      <T variant="label" color={theme.c.textMuted}>
        {label}
      </T>
      <T variant="title" numberOfLines={2} color={item ? theme.c.text : theme.c.textMuted}>
        {item ? item.name : empty}
      </T>
      {item && (
        <T variant="caption" color={theme.c.warm} numberOfLines={1}>
          {detail ? `${detail} · ` : ""}
          {formatListening(item.seconds)}
        </T>
      )}
    </Surface>
  )

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <T variant="display">Resumen</T>
      <T variant="caption" color={theme.c.textMuted}>
        Cada canción que escuchas suma tiempo. Aquí ves cómo fue tu mes o tu año.
      </T>
      <View style={styles.row}>
        <Chip label="Mes" active={kind === "month"} onPress={() => pick("month")} />
        <Chip label="Año" active={kind === "year"} onPress={() => pick("year")} />
      </View>

      <View style={styles.nav}>
        <Press
          onPress={() => setPeriod(shiftPeriod(period, -1))}
          disabled={!canBack}
          accessibilityRole="button"
          accessibilityLabel={kind === "month" ? "Mes anterior" : "Año anterior"}
          radius={theme.radius.sm}
          style={[styles.arrow, { borderRadius: theme.radius.sm, borderColor: theme.c.border, opacity: canBack ? 1 : 0.35 }]}
        >
          <T variant="title">‹</T>
        </Press>
        <T variant="title" style={{ flex: 1, textAlign: "center" }}>
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </T>
        <Press
          onPress={() => setPeriod(shiftPeriod(period, 1))}
          disabled={!canForward}
          accessibilityRole="button"
          accessibilityLabel={kind === "month" ? "Mes siguiente" : "Año siguiente"}
          radius={theme.radius.sm}
          style={[styles.arrow, { borderRadius: theme.radius.sm, borderColor: theme.c.border, opacity: canForward ? 1 : 0.35 }]}
        >
          <T variant="title">›</T>
        </Press>
      </View>

      {summary.seconds <= 0 ? (
        <Surface style={{ padding: 18, gap: 6 }}>
          <T variant="title">Sin datos de este período</T>
          <T variant="caption" color={theme.c.textMuted}>
            Escucha música y el tiempo se irá sumando aquí. Al terminar el mes, y al terminar el año, te avisamos con tu resumen.
          </T>
        </Surface>
      ) : (
        <>
          <Surface style={{ padding: 18, gap: 4, backgroundColor: theme.c.accent }}>
            <T variant="label" color={theme.c.onAccent}>
              Tiempo escuchado
            </T>
            <T variant="display" color={theme.c.onAccent} accessibilityLabel={`Tiempo escuchado: ${formatListening(summary.seconds)}`}>
              {formatListening(summary.seconds)}
            </T>
            <T variant="caption" color={theme.c.onAccent}>
              {summary.songCount === 1 ? "1 canción distinta" : `${summary.songCount} canciones distintas`}
            </T>
          </Surface>

          {highlight("Canción más escuchada", summary.songs[0], "—", summary.songs[0]?.detail)}
          {highlight("Artista más escuchado", summary.artists[0], "Sin artista conocido")}
          {highlight("Álbum más escuchado", summary.albums[0], "Sin álbum conocido", summary.albums[0]?.detail)}
          {!summary.albums.length && (
            <T variant="caption" color={theme.c.textMuted}>
              El álbum sale de la búsqueda en internet de la pestaña Música: las canciones sin álbum no cuentan aquí.
            </T>
          )}

          <T variant="label" color={theme.c.textMuted} style={{ marginTop: 6 }}>
            Las más escuchadas
          </T>
          {top.map((song, i) => (
            <Surface key={`${song.name}-${i}`} style={styles.rank}>
              <T variant="number" color={theme.c.highlight} style={{ width: 24 }}>
                {i + 1}
              </T>
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="title" numberOfLines={1} style={{ fontSize: Math.min(theme.type.title.size, 16) }}>
                  {song.name}
                </T>
                <T variant="caption" numberOfLines={1} color={theme.c.textMuted}>
                  {song.detail} · {formatListening(song.seconds)}
                </T>
                <View style={[styles.bar, { backgroundColor: theme.c.border, borderRadius: theme.radius.sm }]}>
                  <View style={{ width: `${Math.max(4, (song.seconds / max) * 100)}%`, height: 4, backgroundColor: theme.c.accent, borderRadius: theme.radius.sm }} />
                </View>
              </View>
            </Surface>
          ))}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 20, paddingBottom: 28, gap: 12 },
  row: { flexDirection: "row", gap: 8 },
  nav: { flexDirection: "row", alignItems: "center", gap: 10 },
  arrow: { width: 44, height: 40, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  highlight: { padding: 14, gap: 4 },
  rank: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  bar: { height: 4, overflow: "hidden" },
})

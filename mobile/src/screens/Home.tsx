import { useDeferredValue, useMemo, useState } from "react"
import { FlatList, Keyboard, StyleSheet, TextInput, View } from "react-native"
import { lengthSuffix, Song } from "../data"
import { Equalizer } from "../components/Pixel"
import { Button, Cover, Icon, IconButton, IconName, Press, Surface, T, textStyle } from "../components/ui"
import { normalize } from "../library/names"
import { useTheme } from "../themes/ThemeContext"
import { DeviceLibrary } from "../library/useDeviceLibrary"
import { PlayerApi } from "../usePlayer"

export const SECTIONS: { key: Section; label: string; icon: IconName }[] = [
  { key: "added", label: "Agregadas", icon: "library" },
  { key: "fav", label: "Favoritas", icon: "heart" },
  { key: "top", label: "Top", icon: "top" },
  { key: "recent", label: "Recientes", icon: "recent" },
]

export type Section = "added" | "fav" | "top" | "recent"

const EMPTY: Record<Section, string> = {
  added: "Sin canciones",
  fav: "Toca el corazón para guardar favoritas",
  top: "Aún no hay datos",
  recent: "Nada escuchado todavía",
}

/** Songs in each Home section; also gives the counts shown in the side menu. */
export function sectionLists(library: Song[]): Record<Section, Song[]> {
  return {
    added: [...library].sort((a, b) => b.addedAt - a.addedAt),
    fav: library.filter((s) => s.fav),
    top: [...library].sort((a, b) => b.plays - a.plays).slice(0, 6),
    recent: library.filter((s) => s.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed),
  }
}

export default function Home({
  player,
  lib,
  section,
  onOpenPlayer,
  onOpenMenu,
  onOpenScan,
}: {
  player: PlayerApi
  lib: DeviceLibrary
  section: Section
  onOpenPlayer: () => void
  /** Opens the side menu, where the section is chosen */
  onOpenMenu: () => void
  onOpenScan: () => void
}) {
  const theme = useTheme()
  const { library, currentId, playing } = player
  const lists = useMemo(() => sectionLists(library), [library])
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState("")
  // The box answers each key at once; the list below catches up when the phone has a moment
  const asked = useDeferredValue(query)
  // A search looks through the whole library, whichever section is open
  const found = useMemo(() => {
    const words = normalize(asked).split(" ").filter(Boolean)
    if (!words.length) return null
    return lists.added.filter((s) => {
      const text = normalize(`${s.title} ${s.artist}`)
      return words.every((w) => text.includes(w))
    })
  }, [asked, lists.added])
  const list = found ?? lists[section]
  const closeSearch = () => {
    setSearching(false)
    setQuery("")
    Keyboard.dismiss()
  }
  const current = SECTIONS.find((s) => s.key === section)!

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Press
          onPress={onOpenMenu}
          accessibilityRole="button"
          accessibilityLabel={`Sección: ${current.label}. Abrir menú`}
          radius={theme.radius.md}
          style={[
            styles.trigger,
            { borderRadius: theme.radius.md, borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: theme.c.surface },
          ]}
        >
          <Icon name="menu" size={22} color={theme.c.accent} />
          <View>
            <T variant="label" color={theme.c.textMuted} style={{ fontSize: Math.min(theme.type.label.size, 10) }}>
              Inicio
            </T>
            <T variant="title" style={{ fontSize: Math.min(theme.type.title.size, 17) }}>
              {current.label}
            </T>
          </View>
        </Press>
        <View style={styles.topRight}>
          <IconButton icon={searching ? "close" : "search"} onPress={() => (searching ? closeSearch() : setSearching(true))} label={searching ? "Cerrar la búsqueda" : "Buscar canción"} color={theme.c.accent} />
          {!searching && <Equalizer playing={playing} bars={7} height={28} color={theme.c.accent} />}
        </View>
      </View>
      {searching && (
        <View
          style={[
            styles.search,
            { borderRadius: theme.radius.md, borderWidth: theme.border, borderColor: theme.c.accent, backgroundColor: theme.c.surface },
          ]}
        >
          <Icon name="search" size={20} color={theme.c.textMuted} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Título o artista"
            placeholderTextColor={theme.c.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Buscar canción por título o artista"
            style={[textStyle(theme, "body"), styles.input, { color: theme.c.text, textTransform: "none" }]}
          />
          {!!query && <IconButton icon="close" onPress={() => setQuery("")} label="Borrar lo escrito" color={theme.c.textMuted} size={20} boxed={false} />}
        </View>
      )}

      <FlatList
        data={list}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 16 }}>
            {found && (
              <T variant="caption" color={theme.c.textMuted}>
                {found.length === 1 ? "1 resultado" : `${found.length} resultados`}
              </T>
            )}
            {lib.tracks.length === 0 && (
              <Surface tone="surface2" style={styles.banner}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="title">Tu música del teléfono</T>
                  <T variant="caption" color={theme.c.textMuted}>
                    {lib.phase === "scanning" ? "Buscando archivos…" : "Busca los archivos de audio y escúchalos aquí."}
                  </T>
                </View>
                <Button label="Buscar" icon="player" onPress={onOpenScan} />
              </Surface>
            )}
          {!found && (
          <Surface style={styles.stats}>
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="label" color={theme.c.textMuted}>
                Biblioteca
              </T>
              <T variant="title">{library.length} temas</T>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="label" color={theme.c.textMuted}>
                Favoritas
              </T>
              <T variant="title">{lists.fav.length}</T>
            </View>
            <Button
              label="Mix"
              icon="shuffle"
              disabled={!library.length}
              onPress={() => {
                player.playMix()
                onOpenPlayer()
              }}
            />
          </Surface>
          )}
          </View>
        }
        ListEmptyComponent={
          <T variant="caption" color={theme.c.textMuted} style={{ textAlign: "center", marginTop: 24 }}>
            {found ? `Nada coincide con «${asked.trim()}»` : EMPTY[section]}
          </T>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item, index }) => {
          const active = item.id === currentId
          return (
            <Surface tone={active ? "surface2" : "surface"} style={styles.item}>
              <Press
                style={styles.itemMain}
                radius={theme.radius.sm}
                scaleTo={0.97}
                accessibilityLabel={`Reproducir ${item.title}`}
                onPress={() => {
                  Keyboard.dismiss()
                  player.play(item.id)
                  onOpenPlayer()
                }}
              >
                {section === "top" && (
                  <T variant="number" color={theme.c.highlight} style={{ width: 18 }}>
                    {index + 1}
                  </T>
                )}
                <Cover seed={item.id} size={44} behind={active ? theme.c.surface2 : theme.c.surface} />
                <View style={{ flex: 1 }}>
                  <T variant="title" numberOfLines={1} style={{ fontSize: Math.min(theme.type.title.size, 16) }}>
                    {item.title}
                  </T>
                  <T variant="caption" numberOfLines={1} color={theme.c.warm}>
                    {item.artist}{section === "top" ? ` · ${item.plays} reproducciones` : lengthSuffix(item.duration)}
                  </T>
                </View>
                {active && <Equalizer playing={playing} bars={3} height={16} color={theme.c.accent} />}
              </Press>
              <IconButton
                icon={item.fav ? "heartOn" : "heart"}
                onPress={() => player.toggleFav(item.id)}
                label={`Favorita ${item.title}`}
                color={item.fav ? theme.c.accent : theme.c.textMuted}
                boxed={false}
              />
            </Surface>
          )
        }}
      />

    </View>
  )
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, paddingLeft: 12, paddingRight: 4, minHeight: 46 },
  input: { flex: 1, paddingVertical: 8 },
  trigger: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingLeft: 12, paddingRight: 10 },
  content: { padding: 16, paddingBottom: 24, gap: 0 },
  stats: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  item: { flexDirection: "row", alignItems: "center", paddingLeft: 10, paddingRight: 4, paddingVertical: 8 },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
})

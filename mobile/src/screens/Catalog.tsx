import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native"
import { fmt } from "../data"
import { Button, Cover, Press, Surface, T } from "../components/ui"
import { useTheme } from "../themes/ThemeContext"
import { PlayerApi } from "../usePlayer"

export default function Catalog({ player, onOpenPlayer }: { player: PlayerApi; onOpenPlayer: () => void }) {
  const theme = useTheme()
  const { width } = useWindowDimensions()
  const { songs, library, currentId } = player
  const total = library.reduce((n, s) => n + s.duration, 0)
  const catalog = [...songs].sort((a, b) => Number(b.added) - Number(a.added) || b.addedAt - a.addedAt || a.id - b.id)
  // Two columns: screen minus 16px padding each side, 12px gap, card padding and border
  const coverSize = Math.floor((width - 32 - 12) / 2 - 16 - theme.border * 2 - 8)

  return (
    <FlatList
      data={catalog}
      numColumns={2}
      keyExtractor={(s) => String(s.id)}
      contentContainerStyle={styles.content}
      columnWrapperStyle={{ gap: 12 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 16, gap: 4 }}>
          <T variant="label" color={theme.c.textMuted}>
            Descubre música
          </T>
          <T variant="display">Catálogo</T>
          <T variant="caption" color={theme.c.textMuted}>
            {library.length} en tu biblioteca · {fmt(total)} min
          </T>
        </View>
      }
      renderItem={({ item }) => {
        const active = item.id === currentId
        return (
          <Surface tone={active ? "surface2" : "surface"} style={[styles.card, active && { borderColor: theme.c.accent }]}>
            <Press
              radius={theme.radius.sm}
              scaleTo={0.97}
              accessibilityLabel={`Reproducir ${item.title}`}
              onPress={() => {
                player.play(item.id)
                onOpenPlayer()
              }}
              style={{ gap: 6 }}
            >
              <View style={{ alignSelf: "center" }}>
                <Cover seed={item.id} size={coverSize} behind={active ? theme.c.surface2 : theme.c.surface} />
                <View style={[styles.badge, { backgroundColor: item.added ? theme.c.surface2 : theme.c.accent, borderRadius: theme.radius.sm }]}>
                  <T variant="label" color={item.added ? theme.c.text : theme.c.onAccent} style={{ fontSize: Math.min(theme.type.label.size, 10) }}>
                    {item.added ? "En biblioteca" : "+ Nueva"}
                  </T>
                </View>
              </View>
              <T variant="title" numberOfLines={1} style={{ fontSize: Math.min(theme.type.title.size, 15) }}>
                {item.title}
              </T>
              <T variant="caption" numberOfLines={1} color={theme.c.warm}>
                {item.artist} · {fmt(item.duration)}
              </T>
            </Press>
            <Button
              variant="secondary"
              icon={item.added ? "libraryOn" : "library"}
              label={item.added ? "Quitar" : "Guardar"}
              onPress={() => player.toggleLibrary(item.id)}
              style={{ marginTop: 8 }}
            />
          </Surface>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 24 },
  card: { flex: 1, padding: 8 },
  badge: { position: "absolute", left: 4, top: 4, paddingHorizontal: 6, paddingVertical: 3 },
})

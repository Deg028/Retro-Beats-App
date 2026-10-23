import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { fmt } from "../data"
import { Icon, ICONS, PixelCover } from "../components/Pixel"
import { PlayerApi } from "../usePlayer"
import { colors, fonts } from "../theme"

export default function Catalog({ player, onOpenPlayer }: { player: PlayerApi; onOpenPlayer: () => void }) {
  const { songs, library, currentId } = player
  const total = library.reduce((n, s) => n + s.duration, 0)
  const catalog = [...songs].sort(
    (a, b) => Number(b.added) - Number(a.added) || b.addedAt - a.addedAt || a.id - b.id,
  )

  return (
    <FlatList
      data={catalog}
      numColumns={2}
      keyExtractor={(s) => String(s.id)}
      contentContainerStyle={styles.content}
      columnWrapperStyle={{ gap: 12 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.label}>DESCUBRE MÚSICA</Text>
          <Text style={styles.title}>
            CATÁLOGO <Text style={{ color: colors.primary }}>▣</Text>
          </Text>
          <Text style={styles.sub}>
            {library.length} en tu biblioteca · {fmt(total)} min
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, item.id === currentId && styles.cardActive]}>
          <Pressable
            accessibilityLabel={`Reproducir ${item.title}`}
            onPress={() => {
              player.play(item.id)
              onOpenPlayer()
            }}
          >
            <View>
              <PixelCover seed={item.id} size={130} style={styles.cover} />
              <Text style={[styles.badge, { backgroundColor: item.added ? colors.panel2 : colors.primary }]}>
                {item.added ? "EN BIBLIOTECA" : "+ NUEVA"}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.songTitle}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={styles.songMeta}>
              {item.artist} · {fmt(item.duration)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => player.toggleLibrary(item.id)}
            accessibilityLabel={item.added ? `Quitar ${item.title} de la biblioteca` : `Guardar ${item.title}`}
            style={styles.save}
          >
            <Icon d={item.added ? ICONS.bookmarkOn : ICONS.bookmark} color={item.added ? colors.coral : colors.secondary} size={18} />
            <Text style={styles.saveText}>{item.added ? "QUITAR" : "GUARDAR"}</Text>
          </Pressable>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 24 },
  label: { fontFamily: fonts.pixel, fontSize: 8, color: colors.coral },
  title: { fontFamily: fonts.pixel, fontSize: 15, lineHeight: 24, color: colors.cream, marginTop: 8 },
  sub: { fontFamily: fonts.term, fontSize: 20, color: "rgba(255,246,224,0.7)", marginTop: 4 },
  card: { flex: 1, padding: 8, borderWidth: 3, borderColor: colors.blood, backgroundColor: colors.panel },
  cardActive: { borderColor: colors.coral, backgroundColor: colors.panel2 },
  cover: { alignSelf: "center", borderWidth: 2, borderColor: colors.secondary },
  badge: {
    position: "absolute",
    left: -4,
    top: -4,
    paddingHorizontal: 4,
    paddingVertical: 3,
    fontFamily: fonts.pixel,
    fontSize: 7,
    color: colors.cream,
  },
  songTitle: { marginTop: 8, fontFamily: fonts.pixel, fontSize: 8, lineHeight: 16, color: colors.cream },
  songMeta: { fontFamily: fonts.term, fontSize: 18, color: colors.coral },
  save: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
    backgroundColor: colors.panel2,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  saveText: { fontFamily: fonts.pixel, fontSize: 8, color: colors.cream },
})

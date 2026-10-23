import { useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { fmt, Song } from "../data"
import { Equalizer, PixelCover, PixelHeart } from "../components/Pixel"
import { PlayerApi } from "../usePlayer"
import { colors, fonts } from "../theme"

const SECTIONS = [
  { key: "added", label: "AGREGADAS" },
  { key: "fav", label: "FAVORITAS" },
  { key: "top", label: "TOP" },
  { key: "recent", label: "RECIENTES" },
] as const

type Section = (typeof SECTIONS)[number]["key"]

const EMPTY: Record<Section, string> = {
  added: "SIN CANCIONES",
  fav: "TOCA ♥ PARA GUARDAR FAVORITAS",
  top: "AÚN NO HAY DATOS",
  recent: "NADA ESCUCHADO TODAVÍA",
}

export default function Home({ player, onOpenPlayer }: { player: PlayerApi; onOpenPlayer: () => void }) {
  const [section, setSection] = useState<Section>("added")
  const { library, currentId, playing } = player

  const lists: Record<Section, Song[]> = {
    added: [...library].sort((a, b) => b.addedAt - a.addedAt),
    fav: library.filter((s) => s.fav),
    top: [...library].sort((a, b) => b.plays - a.plays).slice(0, 6),
    recent: library.filter((s) => s.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed),
  }
  const list = lists[section]

  return (
    <FlatList
      data={list}
      keyExtractor={(s) => String(s.id)}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <Text style={styles.title}>INICIO</Text>
            <Equalizer playing={playing} bars={7} height={32} />
          </View>

          <View style={styles.stats}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>BIBLIOTECA</Text>
              <Text style={styles.value}>{library.length} TEMAS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>FAVORITAS</Text>
              <View style={styles.row}>
                <Text style={styles.value}>{lists.fav.length}</Text>
                <PixelHeart active size={16} />
              </View>
            </View>
            <Pressable
              disabled={!library.length}
              onPress={() => {
                player.playMix()
                onOpenPlayer()
              }}
              accessibilityLabel="Reproducir biblioteca en orden aleatorio"
              style={[styles.btn, !library.length && { opacity: 0.4 }]}
            >
              <Text style={styles.btnText}>⤮ MIX</Text>
            </Pressable>
          </View>

          <View style={styles.chips}>
            {SECTIONS.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => setSection(s.key)}
                accessibilityState={{ selected: section === s.key }}
                style={[styles.chip, section === s.key && styles.chipOn]}
              >
                <Text style={[styles.chipText, section === s.key && { color: colors.cream }]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>{EMPTY[section]}</Text>}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item, index }) => {
        const active = item.id === currentId
        return (
          <View style={[styles.item, active && styles.itemActive]}>
            <Pressable
              style={styles.itemMain}
              accessibilityLabel={`Reproducir ${item.title}`}
              onPress={() => {
                player.play(item.id)
                onOpenPlayer()
              }}
            >
              <Text style={styles.rank}>{section === "top" ? index + 1 : ""}</Text>
              <PixelCover seed={item.id} size={44} style={styles.cover} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.songTitle}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.songMeta}>
                  {item.artist} · {section === "top" ? `${item.plays} PLAYS` : fmt(item.duration)}
                </Text>
              </View>
              {active && <Equalizer playing={playing} bars={3} height={16} />}
            </Pressable>
            <Pressable
              onPress={() => player.toggleFav(item.id)}
              accessibilityLabel={`Favorita ${item.title}`}
              hitSlop={8}
              style={styles.fav}
            >
              <PixelHeart active={item.fav} size={20} />
            </Pressable>
          </View>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontFamily: fonts.pixel, fontSize: 15, color: colors.cream },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: colors.secondary,
    backgroundColor: colors.panel,
  },
  label: { fontFamily: fonts.pixel, fontSize: 8, color: colors.coral },
  value: { fontFamily: fonts.pixel, fontSize: 11, color: colors.cream, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: { backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 10 },
  btnText: { fontFamily: fonts.pixel, fontSize: 9, color: colors.cream },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.panel2, borderWidth: 3, borderColor: colors.ink },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.pixel, fontSize: 8, color: "rgba(255,246,224,0.7)" },
  empty: {
    padding: 20,
    textAlign: "center",
    fontFamily: fonts.pixel,
    fontSize: 8,
    lineHeight: 20,
    color: colors.coral,
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: colors.blood,
  },
  item: { flexDirection: "row", alignItems: "center", padding: 8, borderWidth: 3, borderColor: colors.blood, backgroundColor: colors.panel },
  itemActive: { borderColor: colors.coral, backgroundColor: colors.panel2 },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  rank: { width: 14, textAlign: "center", fontFamily: fonts.pixel, fontSize: 8, color: colors.coral },
  cover: { borderWidth: 2, borderColor: colors.secondary },
  songTitle: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 16, color: colors.cream },
  songMeta: { fontFamily: fonts.term, fontSize: 18, color: colors.coral },
  fav: { padding: 6 },
})

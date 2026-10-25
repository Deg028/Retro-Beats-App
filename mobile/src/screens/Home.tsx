import { useEffect, useState } from "react"
import { Animated, FlatList, Pressable, StyleSheet, View } from "react-native"
import { fmt, Song } from "../data"
import { Equalizer } from "../components/Pixel"
import { Button, Cover, Icon, IconButton, IconName, motion, Press, Surface, T } from "../components/ui"
import { useTheme } from "../themes/ThemeContext"
import { PlayerApi } from "../usePlayer"

const SECTIONS: { key: Section; label: string; icon: IconName }[] = [
  { key: "added", label: "Agregadas", icon: "library" },
  { key: "fav", label: "Favoritas", icon: "heart" },
  { key: "top", label: "Top", icon: "top" },
  { key: "recent", label: "Recientes", icon: "recent" },
]

type Section = "added" | "fav" | "top" | "recent"

const EMPTY: Record<Section, string> = {
  added: "Sin canciones",
  fav: "Toca el corazón para guardar favoritas",
  top: "Aún no hay datos",
  recent: "Nada escuchado todavía",
}

export default function Home({ player, onOpenPlayer }: { player: PlayerApi; onOpenPlayer: () => void }) {
  const theme = useTheme()
  const [section, setSection] = useState<Section>("added")
  const [menuOpen, setMenuOpen] = useState(false)
  const [menu] = useState(() => new Animated.Value(0))
  const { library, currentId, playing } = player

  useEffect(() => {
    motion(theme, menu, menuOpen ? 1 : 0, 200).start()
  }, [menuOpen, menu, theme])

  const lists: Record<Section, Song[]> = {
    added: [...library].sort((a, b) => b.addedAt - a.addedAt),
    fav: library.filter((s) => s.fav),
    top: [...library].sort((a, b) => b.plays - a.plays).slice(0, 6),
    recent: library.filter((s) => s.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed),
  }
  const list = lists[section]
  const current = SECTIONS.find((s) => s.key === section)!

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Press
          onPress={() => setMenuOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={`Sección: ${current.label}. Cambiar sección`}
          accessibilityState={{ expanded: menuOpen }}
          radius={theme.radius.md}
          style={[
            styles.trigger,
            { borderRadius: theme.radius.md, borderWidth: theme.border, borderColor: menuOpen ? theme.c.accent : theme.c.border, backgroundColor: theme.c.surface },
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
          <Animated.View style={{ transform: [{ rotate: menu.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
            <Icon name="back" size={20} color={theme.c.textMuted} />
          </Animated.View>
        </Press>
        <Equalizer playing={playing} bars={7} height={28} color={theme.c.accent} />
      </View>

      <FlatList
        data={list}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
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
        }
        ListEmptyComponent={
          <T variant="caption" color={theme.c.textMuted} style={{ textAlign: "center", marginTop: 24 }}>
            {EMPTY[section]}
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
                    {item.artist} · {section === "top" ? `${item.plays} reproducciones` : fmt(item.duration)}
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

      {menuOpen && <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} accessibilityLabel="Cerrar menú" />}
      <Animated.View
        pointerEvents={menuOpen ? "auto" : "none"}
        style={[
          styles.menu,
          {
            backgroundColor: theme.c.surface,
            borderRadius: theme.radius.md,
            borderWidth: Math.max(1, theme.border),
            borderColor: theme.c.border,
            opacity: menu,
            transformOrigin: "top left",
            transform: [
              { translateY: menu.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
              { scale: menu.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            ],
          },
          theme.shadow !== "solid" &&{ elevation: 12, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16 },
        ]}
      >
        {SECTIONS.map((s) => {
          const on = s.key === section
          return (
            <Press
              key={s.key}
              onPress={() => {
                setSection(s.key)
                setMenuOpen(false)
              }}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: on }}
              radius={theme.radius.sm}
              scaleTo={0.97}
              style={[styles.menuItem, { borderRadius: theme.radius.sm }, on && { backgroundColor: theme.c.accent }]}
            >
              <Icon name={s.icon} size={20} color={on ? theme.c.onAccent : theme.c.highlight} />
              <T variant="body" color={on ? theme.c.onAccent : theme.c.text} style={{ flex: 1 }}>
                {s.label}
              </T>
              <T variant="number" color={on ? theme.c.onAccent : theme.c.textMuted}>
                {lists[s.key].length}
              </T>
            </Press>
          )
        })}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  trigger: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingLeft: 12, paddingRight: 10 },
  content: { padding: 16, paddingBottom: 24, gap: 0 },
  stats: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 16 },
  item: { flexDirection: "row", alignItems: "center", paddingLeft: 10, paddingRight: 4, paddingVertical: 8 },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  menu: { position: "absolute", top: 72, left: 16, width: 240, padding: 6, gap: 2 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
})

import { useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { PixelCover } from "../components/Pixel"
import { Chip, Icon, Press, Surface, T, textStyle } from "../components/ui"
import { useThemeControl } from "../themes/ThemeContext"
import { CATEGORY_LABEL, Theme, ThemeCategory, THEMES } from "../themes/themes"

const FILTERS: { key: ThemeCategory | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "retro", label: "Retro" },
  { key: "moderno", label: "Moderno" },
  { key: "combinado", label: "Combinado" },
]

/** Theme picker: each card is drawn with its own theme's colors, fonts and shapes. */
export default function Themes() {
  const { theme, themeId, setThemeId } = useThemeControl()
  const [filter, setFilter] = useState<ThemeCategory | "all">("all")
  const list = THEMES.filter((t) => filter === "all" || t.category === filter)
  const current = THEMES.find((t) => t.id === themeId) ?? THEMES[0]

  return (
    <FlatList
      data={list}
      numColumns={2}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.content}
      columnWrapperStyle={{ gap: 12 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 16 }}>
          <T variant="display">Temas</T>
          <T variant="caption" color={theme.c.textMuted}>
            Cada tema cambia toda la app: colores, letras, formas, animaciones y su detalle retro.
          </T>
          <Surface style={{ padding: 14, gap: 4 }}>
            <T variant="label" color={theme.c.highlight}>
              Tema actual · {CATEGORY_LABEL[current.category]}
            </T>
            <T variant="title">{current.name}</T>
            <T variant="caption" color={theme.c.textMuted}>
              {current.tagline}
            </T>
          </Surface>
          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </View>
        </View>
      }
      renderItem={({ item }) => <ThemeCard t={item} selected={item.id === themeId} onPress={() => setThemeId(item.id)} />}
    />
  )
}

function ThemeCard({ t, selected, onPress }: { t: Theme; selected: boolean; onPress: () => void }) {
  const { theme } = useThemeControl()
  const playRadius = t.play === "circle" ? 18 : t.play === "sticker" ? 10 : t.play === "morph" ? 12 : 0
  return (
    <Press
      onPress={onPress}
      radius={18}
      scaleTo={0.96}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Tema ${t.name}, ${CATEGORY_LABEL[t.category]}`}
      style={[styles.card, { borderColor: selected ? theme.c.accent : theme.c.border, borderWidth: selected ? 3 : 1 }]}
    >
      <View style={[styles.preview, { backgroundColor: t.c.bg }]}>
        <View style={[styles.previewTop, t.background === "tonal" && { backgroundColor: t.c.tonal }]}>
          <View
            style={{
              borderRadius: t.cover === "disc" ? 40 : Math.min(t.radius.cover, 14),
              overflow: "hidden",
              borderWidth: t.c.coverBorder ? 2 : 0,
              borderColor: t.c.coverBorder,
            }}
          >
            <PixelCover seed={3} size={76} palette={t.c.cover} bg={t.c.coverBg} />
          </View>
        </View>
        <Text numberOfLines={1} style={[textStyle(t, "title"), { fontSize: Math.min(t.type.title.size, 14), lineHeight: 20 }]}>
          {t.name}
        </Text>
        <View style={styles.previewRow}>
          <View style={{ flex: 1, height: 6, borderRadius: t.pixelCorners || t.progress === "blocks" ? 0 : 3, backgroundColor: t.c.surface2, overflow: "hidden" }}>
            <View style={{ width: "45%", height: 6, backgroundColor: t.c.accent }} />
          </View>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: playRadius,
              backgroundColor: t.c.accent,
              borderWidth: t.play === "square" || t.play === "sticker" ? 2 : 0,
              borderColor: t.play === "sticker" ? t.c.text : t.c.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={styles.triangle}>
              <View style={[styles.triangleShape, { borderLeftColor: t.c.onAccent }]} />
            </View>
          </View>
        </View>
        <View style={styles.swatches}>
          {[t.c.accent, t.c.highlight, t.c.warm, t.c.surface2].map((c, i) => (
            <View key={i} style={[styles.swatch, { backgroundColor: c, borderColor: t.c.border }]} />
          ))}
        </View>
      </View>
      <View style={styles.meta}>
        <T variant="label" color={theme.c.textMuted} style={{ flex: 1, fontSize: Math.min(theme.type.label.size, 10) }}>
          {CATEGORY_LABEL[t.category]}
        </T>
        {selected && <Icon name="check" size={18} color={theme.c.accent} />}
      </View>
    </Press>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 24 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { flex: 1, borderRadius: 18, overflow: "hidden" },
  preview: { padding: 12, gap: 10 },
  previewTop: { alignItems: "center", paddingVertical: 10, borderRadius: 12 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  triangle: { marginLeft: 3 },
  triangleShape: { width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 11, borderTopColor: "transparent", borderBottomColor: "transparent" },
  swatches: { flexDirection: "row", gap: 6 },
  swatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 1 },
  meta: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
})

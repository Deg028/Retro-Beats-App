import { ReactElement, useEffect, useMemo, useRef, useState } from "react"
import { FlatList, LayoutChangeEvent, PanResponder, StyleSheet, View } from "react-native"
import { groupByLetter } from "../alphabet"
import { tick } from "../haptics"
import { useTheme } from "../themes/ThemeContext"
import { T } from "./ui"

/** Height of one song row with the gap under it, and of a letter heading: fixed, so the list can jump to a letter at once */
export const ROW = 68
const HEADING = 38

type Item<S> = { kind: "head"; letter: string } | { kind: "song"; song: S }

/**
 * Songs in A-Z order, with a heading for each letter and the letters down the right edge: touching or sliding a
 * finger along them jumps to that part of the list (Japanese titles go under «和»).
 */
export default function AlphabetList<S extends { id: number; title: string }>({
  songs,
  renderSong,
  empty,
  keyboardShouldPersistTaps,
}: {
  songs: S[]
  /** One row; it is given `ROW - 8` dp of height */
  renderSong: (song: S) => ReactElement
  empty?: ReactElement
  keyboardShouldPersistTaps?: "always" | "never" | "handled"
}) {
  const theme = useTheme()
  const list = useRef<FlatList<Item<S>>>(null)
  const groups = useMemo(() => groupByLetter(songs), [songs])
  const { items, starts } = useMemo(() => {
    const items: Item<S>[] = []
    const starts: number[] = []
    for (const g of groups) {
      starts.push(items.length)
      items.push({ kind: "head", letter: g.letter })
      for (const song of g.songs) items.push({ kind: "song", song })
    }
    return { items, starts }
  }, [groups])
  // Where each row starts, to jump without drawing everything in between
  const offsets = useMemo(() => {
    const out: number[] = []
    let y = 0
    for (const it of items) {
      out.push(y)
      y += it.kind === "head" ? HEADING : ROW
    }
    return out
  }, [items])

  const [touched, setTouched] = useState<string | null>(null)
  // What the touch handlers need, kept where they can read it without being made again
  const rail = useRef({ height: 1, last: -1, jump: (_y: number) => {} })
  useEffect(() => {
    rail.current.jump = (y: number) => {
      const count = groups.length
      if (!count) return
      const i = Math.max(0, Math.min(count - 1, Math.floor((y / rail.current.height) * count)))
      if (i === rail.current.last) return
      rail.current.last = i
      // A tick per letter, like the index of the phone's contacts
      tick()
      setTouched(groups[i].letter)
      list.current?.scrollToOffset({ offset: offsets[starts[i]] ?? 0, animated: false })
    }
  }, [groups, offsets, starts])
  // `rail` is only read inside the touch callbacks, never while drawing
  /* eslint-disable react-hooks/refs */
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // The list must not take the drag back while a finger is on the letters
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        rail.current.last = -1
        rail.current.jump(e.nativeEvent.locationY)
      },
      onPanResponderMove: (e) => rail.current.jump(e.nativeEvent.locationY),
      onPanResponderRelease: () => setTouched(null),
      onPanResponderTerminate: () => setTouched(null),
    }),
  )
  /* eslint-enable react-hooks/refs */
  const measure = (e: LayoutChangeEvent) => {
    rail.current.height = Math.max(1, e.nativeEvent.layout.height)
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        data={items}
        keyExtractor={(it) => (it.kind === "head" ? `h-${it.letter}` : String(it.song.id))}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        getItemLayout={(_, i) => ({ length: items[i]?.kind === "head" ? HEADING : ROW, offset: offsets[i] ?? 0, index: i })}
        ListEmptyComponent={empty}
        renderItem={({ item }) =>
          item.kind === "head" ? (
            <View style={[styles.head, { height: HEADING }]}>
              <T variant="label" color={theme.c.accent} style={{ fontSize: 15 }}>
                {item.letter}
              </T>
              <View style={[styles.line, { backgroundColor: theme.c.border }]} />
            </View>
          ) : (
            <View style={{ height: ROW, paddingBottom: 8 }}>{renderSong(item.song)}</View>
          )
        }
        initialNumToRender={14}
        windowSize={9}
        removeClippedSubviews
      />
      {groups.length > 1 && (
        <View style={styles.railBox} pointerEvents="box-none">
          <View style={[styles.rail, { backgroundColor: theme.c.surface, borderColor: theme.c.border }]} onLayout={measure}>
            {groups.map((g) => (
              <T key={g.letter} variant="label" color={g.letter === touched ? theme.c.accent : theme.c.textMuted} style={styles.letter}>
                {g.letter}
              </T>
            ))}
            {/* Over the letters, so the finger is always on this one and its position is the rail's */}
            <View style={StyleSheet.absoluteFill} {...pan.panHandlers} accessibilityLabel="Índice de letras" />
          </View>
        </View>
      )}
      {touched && (
        <View style={[styles.bubble, { backgroundColor: theme.c.accent }]} pointerEvents="none">
          <T variant="display" color={theme.c.onAccent} style={{ fontSize: 40, lineHeight: 48 }}>
            {touched}
          </T>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingRight: 40, paddingTop: 4, paddingBottom: 24 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: 1 },
  railBox: { position: "absolute", top: 0, bottom: 0, right: 2, justifyContent: "center" },
  rail: { paddingVertical: 6, width: 26, alignItems: "center", borderRadius: 13, borderWidth: 1, opacity: 0.95, maxHeight: "100%" },
  letter: { fontSize: 11, lineHeight: 16, textAlign: "center", width: 26 },
  bubble: { position: "absolute", alignSelf: "center", top: "40%", width: 84, height: 84, borderRadius: 20, alignItems: "center", justifyContent: "center" },
})

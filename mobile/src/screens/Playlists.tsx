import { useEffect, useMemo, useState } from "react"
import { Alert, BackHandler, FlatList, Keyboard, StyleSheet, TextInput, View } from "react-native"
import { fmt, lengthSuffix, Song } from "../data"
import { Button, Cover, Icon, IconButton, Press, Surface, T, textStyle } from "../components/ui"
import { normalize } from "../library/names"
import { MAX_NAME, Playlist, PlaylistsApi } from "../playlists"
import { useTheme } from "../themes/ThemeContext"
import { PlayerApi } from "../usePlayer"
import { Sheet } from "./player/shared"

const songCount = (n: number) => (n === 1 ? "1 canción" : `${n} canciones`)

/** A box to type a name into, with a button to confirm. Used to make and to rename lists. */
function NameForm({ initial = "", placeholder, action, onSubmit, onCancel }: { initial?: string; placeholder: string; action: string; onSubmit: (name: string) => void; onCancel: () => void }) {
  const theme = useTheme()
  const [name, setName] = useState(initial)
  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.input, { borderRadius: theme.radius.md, borderWidth: theme.border, borderColor: theme.c.accent, backgroundColor: theme.c.surface }]}>
        <TextInput
          autoFocus
          value={name}
          onChangeText={setName}
          maxLength={MAX_NAME}
          placeholder={placeholder}
          placeholderTextColor={theme.c.textMuted}
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && onSubmit(name)}
          accessibilityLabel={placeholder}
          style={[textStyle(theme, "body"), { flex: 1, paddingVertical: 10, color: theme.c.text, textTransform: "none" }]}
        />
      </View>
      <View style={styles.row}>
        <Button label={action} icon="check" disabled={!name.trim()} onPress={() => onSubmit(name)} />
        <Button label="Cancelar" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  )
}

/** Playlists: make one with a name, fill it with the songs the person likes, and play it. */
export default function Playlists({ playlists, player, onOpenPlayer }: { playlists: PlaylistsApi; player: PlayerApi; onOpenPlayer: () => void }) {
  const theme = useTheme()
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [picking, setPicking] = useState(false)
  const open = playlists.lists.find((l) => l.id === openId) ?? null

  // Back closes the picker, then the list, before leaving the screen
  useEffect(() => {
    if (!open && !creating) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (picking) setPicking(false)
      else if (renaming) setRenaming(false)
      else if (creating) setCreating(false)
      else setOpenId(null)
      return true
    })
    return () => sub.remove()
  }, [open, creating, picking, renaming])

  const byId = useMemo(() => new Map(player.songs.map((s) => [s.id, s])), [player.songs])

  if (open && picking) return <Picker list={open} songs={player.songs} playlists={playlists} onDone={() => setPicking(false)} />
  if (open) {
    const songs = open.songIds.map((id) => byId.get(id)).filter((s): s is Song => !!s)
    const total = songs.reduce((sum, s) => sum + s.duration, 0)
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.head}>
          <Button label="Listas" variant="secondary" onPress={() => setOpenId(null)} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T variant="label" color={theme.c.textMuted}>
              Lista
            </T>
            <T variant="title" numberOfLines={1}>
              {open.name}
            </T>
          </View>
          <IconButton
            icon="close"
            label="Eliminar la lista"
            color={theme.c.textMuted}
            onPress={() =>
              Alert.alert("Eliminar lista", `«${open.name}» se borrará. Tus canciones no se tocan.`, [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Eliminar",
                  style: "destructive",
                  onPress: () => {
                    playlists.remove(open.id)
                    setOpenId(null)
                  },
                },
              ])
            }
          />
        </View>
        <FlatList
          data={songs}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 14 }}>
              <T variant="caption" color={theme.c.textMuted}>
                {songCount(open.songIds.length)}
                {total > 0 ? ` · ${fmt(total)}` : ""}
              </T>
              {renaming ? (
                <NameForm
                  initial={open.name}
                  placeholder="Nombre de la lista"
                  action="Guardar"
                  onSubmit={(name) => {
                    playlists.rename(open.id, name)
                    setRenaming(false)
                    Keyboard.dismiss()
                  }}
                  onCancel={() => setRenaming(false)}
                />
              ) : (
                <View style={styles.row}>
                  <Button
                    label="Reproducir"
                    icon="play"
                    disabled={!songs.length}
                    onPress={() => {
                      player.playList(open.songIds, open.name)
                      onOpenPlayer()
                    }}
                  />
                  <Button
                    label="Aleatorio"
                    icon="shuffle"
                    variant="secondary"
                    disabled={!songs.length}
                    onPress={() => {
                      player.playList(open.songIds, open.name, { shuffle: true })
                      onOpenPlayer()
                    }}
                  />
                </View>
              )}
              {!renaming && (
                <View style={styles.row}>
                  <Button label="Agregar canciones" icon="playlist" variant="secondary" onPress={() => setPicking(true)} />
                  <Button label="Renombrar" variant="secondary" onPress={() => setRenaming(true)} />
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <T variant="caption" color={theme.c.textMuted} style={{ textAlign: "center", marginTop: 24 }}>
              La lista está vacía. Usa «Agregar canciones» para elegir las que quieras.
            </T>
          }
          renderItem={({ item }) => (
            <Surface style={styles.item}>
              <Press
                style={styles.itemMain}
                radius={theme.radius.sm}
                scaleTo={0.97}
                accessibilityLabel={`Reproducir ${item.title}`}
                onPress={() => {
                  player.playList(open.songIds, open.name, { startId: item.id })
                  onOpenPlayer()
                }}
              >
                <Cover seed={item.id} size={44} behind={theme.c.surface} />
                <View style={{ flex: 1 }}>
                  <T variant="title" numberOfLines={1} style={{ fontSize: Math.min(theme.type.title.size, 16) }}>
                    {item.title}
                  </T>
                  <T variant="caption" numberOfLines={1} color={theme.c.warm}>
                    {item.artist}
                    {lengthSuffix(item.duration)}
                  </T>
                </View>
              </Press>
              <IconButton icon="close" onPress={() => playlists.removeSong(open.id, item.id)} label={`Quitar ${item.title} de la lista`} color={theme.c.textMuted} boxed={false} size={20} />
            </Surface>
          )}
        />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={playlists.lists}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 16 }}>
            <T variant="display">Listas</T>
            <T variant="caption" color={theme.c.textMuted}>
              Crea tus propias listas con las canciones que prefieras.
            </T>
            {creating ? (
              <NameForm
                placeholder="Nombre de la lista"
                action="Crear"
                onSubmit={(name) => {
                  const id = playlists.create(name)
                  setCreating(false)
                  Keyboard.dismiss()
                  if (id) {
                    setOpenId(id)
                    setPicking(true)
                  }
                }}
                onCancel={() => setCreating(false)}
              />
            ) : (
              <Button label="Nueva lista" icon="playlist" onPress={() => setCreating(true)} />
            )}
          </View>
        }
        ListEmptyComponent={
          !creating ? (
            <T variant="caption" color={theme.c.textMuted} style={{ textAlign: "center", marginTop: 24 }}>
              Todavía no tienes listas.
            </T>
          ) : undefined
        }
        renderItem={({ item }) => <PlaylistRow list={item} songs={byId} onOpen={() => setOpenId(item.id)} />}
      />
    </View>
  )
}

function PlaylistRow({ list, songs, onOpen }: { list: Playlist; songs: Map<number, Song>; onOpen: () => void }) {
  const theme = useTheme()
  const first = list.songIds.find((id) => songs.has(id))
  return (
    <Press onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Abrir la lista ${list.name}`} radius={theme.radius.md} scaleTo={0.98}>
      <Surface style={styles.item}>
        <View style={styles.itemMain}>
          {first !== undefined ? <Cover seed={first} size={52} behind={theme.c.surface} /> : <Icon name="playlist" size={36} color={theme.c.accent} />}
          <View style={{ flex: 1 }}>
            <T variant="title" numberOfLines={1}>
              {list.name}
            </T>
            <T variant="caption" color={theme.c.textMuted}>
              {songCount(list.songIds.length)}
            </T>
          </View>
          <Icon name="arrow" size={20} color={theme.c.textMuted} />
        </View>
      </Surface>
    </Press>
  )
}

/** Every song of the library with a tick: tapping adds it to the list or takes it out. */
function Picker({ list, songs, playlists, onDone }: { list: Playlist; songs: Song[]; playlists: PlaylistsApi; onDone: () => void }) {
  const theme = useTheme()
  const [query, setQuery] = useState("")
  const shown = useMemo(() => {
    const words = normalize(query).split(" ").filter(Boolean)
    const all = [...songs].sort((a, b) => a.title.localeCompare(b.title))
    return words.length ? all.filter((s) => words.every((w) => normalize(`${s.title} ${s.artist}`).includes(w))) : all
  }, [songs, query])
  const inList = new Set(list.songIds)
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="label" color={theme.c.textMuted}>
            Agregar a «{list.name}»
          </T>
          <T variant="title">{songCount(list.songIds.length)}</T>
        </View>
        <Button label="Listo" icon="check" onPress={onDone} />
      </View>
      <View style={[styles.input, { marginHorizontal: 16, marginBottom: 8, borderRadius: theme.radius.md, borderWidth: theme.border, borderColor: theme.c.border, backgroundColor: theme.c.surface }]}>
        <Icon name="search" size={20} color={theme.c.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por título o artista"
          placeholderTextColor={theme.c.textMuted}
          autoCorrect={false}
          accessibilityLabel="Buscar canciones para agregar"
          style={[textStyle(theme, "body"), { flex: 1, paddingVertical: 10, color: theme.c.text, textTransform: "none" }]}
        />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <T variant="caption" color={theme.c.textMuted} style={{ textAlign: "center", marginTop: 24 }}>
            Nada coincide con la búsqueda
          </T>
        }
        renderItem={({ item }) => {
          const on = inList.has(item.id)
          return (
            <Press
              onPress={() => playlists.toggleSong(list.id, item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${item.title}, ${item.artist}`}
              radius={theme.radius.md}
              scaleTo={0.98}
            >
              <Surface tone={on ? "surface2" : "surface"} style={styles.item}>
                <View style={styles.itemMain}>
                  <Cover seed={item.id} size={44} behind={on ? theme.c.surface2 : theme.c.surface} />
                  <View style={{ flex: 1 }}>
                    <T variant="title" numberOfLines={1} style={{ fontSize: Math.min(theme.type.title.size, 16) }}>
                      {item.title}
                    </T>
                    <T variant="caption" numberOfLines={1} color={theme.c.warm}>
                      {item.artist}
                    </T>
                  </View>
                  <View style={[styles.tick, { borderRadius: theme.radius.sm, borderColor: on ? theme.c.accent : theme.c.border, backgroundColor: on ? theme.c.accent : "transparent" }]}>
                    {on && <Icon name="check" size={18} color={theme.c.onAccent} />}
                  </View>
                </View>
              </Surface>
            </Press>
          )
        }}
      />
    </View>
  )
}

/** Opened from the player: put the song that is playing in one of the lists, or in a new one. */
export function AddToPlaylistSheet({ visible, onClose, song, playlists }: { visible: boolean; onClose: () => void; song: Song | null; playlists: PlaylistsApi }) {
  const theme = useTheme()
  const [creating, setCreating] = useState(false)
  if (!song) return null
  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setCreating(false)
        onClose()
      }}
      title="Agregar a una lista"
    >
      <T variant="caption" color={theme.c.textMuted} numberOfLines={1} style={{ marginTop: -8, marginBottom: 12 }}>
        {song.title}
      </T>
      {creating ? (
        <NameForm
          placeholder="Nombre de la lista"
          action="Crear y agregar"
          onSubmit={(name) => {
            playlists.create(name, [song.id])
            setCreating(false)
            Keyboard.dismiss()
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <>
          <Press onPress={() => setCreating(true)} accessibilityRole="button" radius={theme.radius.sm} scaleTo={0.97} style={[styles.option, { borderRadius: theme.radius.sm }]}>
            <Icon name="playlist" size={22} color={theme.c.accent} />
            <T variant="body" color={theme.c.accent}>
              Nueva lista
            </T>
          </Press>
          <FlatList
            data={playlists.lists}
            keyExtractor={(l) => l.id}
            style={{ maxHeight: 300 }}
            ListEmptyComponent={
              <T variant="caption" color={theme.c.textMuted} style={{ padding: 12 }}>
                Aún no tienes listas.
              </T>
            }
            renderItem={({ item }) => {
              const on = item.songIds.includes(song.id)
              return (
                <Press
                  onPress={() => playlists.toggleSong(item.id, song.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={item.name}
                  radius={theme.radius.sm}
                  scaleTo={0.97}
                  style={[styles.option, { borderRadius: theme.radius.sm }, on && { backgroundColor: theme.c.surface2 }]}
                >
                  <View style={{ flex: 1 }}>
                    <T variant="body" numberOfLines={1} color={on ? theme.c.accent : theme.c.text}>
                      {item.name}
                    </T>
                    <T variant="caption" color={theme.c.textMuted}>
                      {songCount(item.songIds.length)}
                    </T>
                  </View>
                  {on && <Icon name="check" size={20} color={theme.c.accent} />}
                </Press>
              )
            }}
          />
        </>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  content: { padding: 16, paddingBottom: 24 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  input: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 8, minHeight: 46 },
  item: { flexDirection: "row", alignItems: "center", paddingLeft: 10, paddingRight: 8, paddingVertical: 8 },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  tick: { width: 28, height: 28, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 12 },
})

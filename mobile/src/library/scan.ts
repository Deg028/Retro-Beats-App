import { Platform } from "react-native"
import { Asset, AssetField, getPermissionsAsync, MediaType, Query, requestPermissionsAsync } from "expo-media-library"
import { Directory } from "expo-file-system"
import { AUDIO_EXTENSIONS, extensionOf, RawFile } from "./files"

/**
 * granted: can read. denied: not asked yet or refused once. blocked: refused for good, only system settings can change it.
 * unavailable: this build of the app can't ask for the audio permission (Expo Go on Android 13 or later), so folders are used instead.
 */
export type Access = "granted" | "denied" | "blocked" | "unavailable"

// Only the music permission; the library would otherwise ask for photos and videos too
const AUDIO = ["audio" as const]

export async function checkAccess(ask: boolean): Promise<Access> {
  if (Platform.OS === "web") return "granted"
  try {
    const r = ask ? await requestPermissionsAsync(false, AUDIO) : await getPermissionsAsync(false, AUDIO)
    if (r.granted) return "granted"
    return r.canAskAgain ? "denied" : "blocked"
  } catch (e) {
    if (/not declared in AndroidManifest/i.test(e instanceof Error ? e.message : String(e))) return "unavailable"
    throw e
  }
}

const PAGE = 1000
const LIMIT = 200_000

/** Reads every audio file in the system's media index, page by page. `onProgress` gets the number read so far. */
export async function scanFiles(onProgress: (n: number) => void): Promise<RawFile[]> {
  if (Platform.OS === "web") return sampleFiles()
  const files: RawFile[] = []
  for (let offset = 0; offset < LIMIT; offset += PAGE) {
    const page = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: true })
      .limit(PAGE)
      .offset(offset)
      .exeForMetadata()
    for (const a of page) {
      // On Android the id is already the content address; otherwise ask the library for it
      const uri = a.id.includes("://") ? a.id : await new Asset(a.id).getUri()
      files.push({ uri, name: a.filename ?? uri.split("/").pop() ?? "Sin nombre", duration: a.duration == null ? null : a.duration / 1000, added: a.creationTime })
    }
    onProgress(files.length)
    if (page.length < PAGE) break
  }
  return files
}

/** Stand-in for the phone's index when the app runs in a browser, where there is no media library. */
function sampleFiles(): RawFile[] {
  const day = 86_400_000
  const song = (i: number, name: string, duration: number | null): RawFile => ({ uri: `sample://${i}`, name, duration, added: Date.now() - (30 - i) * day })
  return [
    song(1, "01 - Estrella Fugaz - Cometa de Cristal.mp3", 214),
    song(2, "02 - Estrella Fugaz - Marea Baja.mp3", 187),
    song(3, "Los Hermanos Luna - Camino al Sur.flac", 243),
    song(4, "Los Hermanos Luna - Noche de Neón.m4a", 198),
    song(5, "Pista_07.mp3", 156),
    song(6, "Coral Eléctrico - Ventana al Mar.ogg", 272),
    song(7, "Coral Eléctrico - Luces de Puerto.mp3", 231),
    song(8, "Mapa de Estrellas - Despertar.mp3", 205),
    song(9, "grabación de voz 014.m4a", 7),
    song(10, "notificación_suave.ogg", 2),
    song(11, "tono_de_llamada_clasico.mp3", 11),
    song(12, "Concierto en vivo - parte 2.wma", 1800),
    song(13, "Respaldo viejo - Disco 3.ape", 320),
    song(14, "Descarga incompleta.mp3", null),
    song(15, "Sin terminar - maqueta.mp3", 0),
  ]
}

// ---------- Folders: reading music without the media-library permission

/** Where the system file picker opens: the Music folder of the main storage. */
const MUSIC_HINT = "content://com.android.externalstorage.documents/document/primary%3AMusic"

/** Asks Android for a folder. The access is kept by the system between launches. Returns null if the person backs out. */
export async function pickFolder(hint: string = MUSIC_HINT): Promise<string | null> {
  try {
    return (await Directory.pickDirectoryAsync(hint)).uri
  } catch (e) {
    // Backing out of the picker is not an error; only a rejected starting folder is worth a second try without it
    if (/cancel/i.test(e instanceof Error ? e.message : String(e))) return null
    try {
      return (await Directory.pickDirectoryAsync()).uri
    } catch {
      return null
    }
  }
}

/** "Almacenamiento interno / Music" from a folder address like content://.../tree/primary%3AMusic. */
export function folderLabel(uri: string) {
  const tree = uri.split("/tree/")[1]?.split("/document/")[0]
  if (!tree) return uri
  const [volume, ...path] = decodeURIComponent(tree).split(":")
  const where = volume === "primary" ? "Almacenamiento interno" : "Tarjeta SD"
  const rest = path.join(":").replace(new RegExp("/+$"), "")
  return rest ? `${where} / ${rest.split("/").join(" / ")}` : where
}

/** File name from a document address, without asking the system: the last piece of the decoded document id. */
function nameFromUri(uri: string) {
  const id = uri.split("/document/")[1] ?? uri
  const decoded = decodeURIComponent(id).replace(new RegExp("/+$"), "")
  return decoded.slice(decoded.lastIndexOf("/") + 1)
}

export type FolderIssue = { uri: string; message: string }

const MAX_DEPTH = 12
const MAX_FILES = 100_000
const idle = () => new Promise<void>((r) => setTimeout(r, 0))

/** Walks the chosen folders and lists their audio files. A folder that can't be read is reported, not hidden. */
export async function scanFolders(
  folders: string[],
  onProgress: (n: number) => void,
  /** Folder names to leave out, given in lower case */
  skip: (name: string) => boolean = () => false,
): Promise<{ files: RawFile[]; issues: FolderIssue[] }> {
  const files: RawFile[] = []
  const issues: FolderIssue[] = []
  const seen = new Set<string>()
  // Lyrics files by the name of the song they belong to ("Song_private.lrc" and "Song.lrc" both belong to "Song")
  const lyricFiles = new Map<string, string>()

  async function walk(dir: Directory, depth: number) {
    // Give the screen a turn between folders so the progress count keeps moving
    await idle()
    for (const item of dir.list()) {
      if (item instanceof Directory) {
        const name = nameFromUri(item.uri)
        if (depth < MAX_DEPTH && !name.startsWith(".") && !skip(name.toLowerCase())) await walk(item, depth + 1)
        continue
      }
      const name = nameFromUri(item.uri)
      if (extensionOf(name) === "lrc") {
        lyricFiles.set(name.slice(0, -4).replace(/_private$/i, "").toLowerCase(), item.uri)
        continue
      }
      if (!AUDIO_EXTENSIONS.has(extensionOf(name)) || seen.has(item.uri) || files.length >= MAX_FILES) continue
      seen.add(item.uri)
      files.push({ uri: item.uri, name, duration: null, added: null, unknownDuration: true })
    }
    onProgress(files.length)
  }

  for (const uri of folders) {
    try {
      await walk(new Directory(uri), 0)
    } catch (e) {
      issues.push({ uri, message: e instanceof Error ? e.message : String(e) })
    }
  }
  for (const f of files) {
    const own = lyricFiles.get(f.name.slice(0, f.name.lastIndexOf(".")).toLowerCase())
    if (own) f.lyricsUri = own
  }
  return { files, issues }
}

// ---------- Whole phone: finding the music wherever it is kept

const STORAGE = "file:///storage"
/** Folders that hold system sounds, voice messages and app backups (XMusic saves its backups as .wav), or app data nobody can read anyway */
const NOT_MUSIC = new Set(["android", "ringtones", "notifications", "alarms", "ui", "lost.dir", "voice notes", "whatsapp voice notes", "call recordings", "recordings"])

/** Main storage and every memory card, as folder addresses. */
async function storageRoots() {
  const roots = [`${STORAGE}/emulated/0`]
  try {
    for (const item of new Directory(STORAGE).list()) {
      const name = item.uri.replace(new RegExp("/+$"), "").split("/").pop() ?? ""
      // Memory cards are named like 1A2B-3C4D; "emulated" is the main storage and "self" points back to it
      if (item instanceof Directory && /^[0-9A-F]{4}-[0-9A-F]{4}$/i.test(name)) roots.push(`${STORAGE}/${name}`)
    }
  } catch {
    // Can't list /storage: the main storage is still tried
  }
  return roots
}

/**
 * Walks the phone's storage from the top and lists every audio file it finds, whether or not the system's media index
 * knows it (folders with a .nomedia file, files copied in by hand, music kept by Telegram or other apps). Needs
 * "all files access"; without it Android shows little or nothing and the result is just short.
 */
export async function scanDevice(onProgress: (n: number) => void): Promise<RawFile[]> {
  if (Platform.OS !== "android") return []
  return (await scanFolders(await storageRoots(), onProgress, (name) => NOT_MUSIC.has(name) || name.includes("backup"))).files
}

export type MusicFolder = { uri: string; count: number }

/** The folders that hold music, biggest first, from the files' own addresses. */
export function musicFolders(files: { uri: string }[]): MusicFolder[] {
  const counts = new Map<string, number>()
  for (const f of files) {
    if (!f.uri.startsWith("file://")) continue
    const dir = f.uri.slice(0, f.uri.lastIndexOf("/"))
    counts.set(dir, (counts.get(dir) ?? 0) + 1)
  }
  return [...counts].map(([uri, count]) => ({ uri, count })).sort((a, b) => b.count - a.count)
}

/** "Almacenamiento interno / Download / Telegram" from file:///storage/emulated/0/Download/Telegram. */
export function pathLabel(uri: string) {
  const [volume, ...path] = decodeURIComponent(uri.replace("file:///storage/", "")).split("/")
  const where = volume === "emulated" ? "Almacenamiento interno" : "Tarjeta SD"
  const rest = (volume === "emulated" ? path.slice(1) : path).join(" / ")
  return rest ? `${where} / ${rest}` : where
}

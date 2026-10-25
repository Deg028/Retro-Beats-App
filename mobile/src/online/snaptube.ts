import { Platform } from "react-native"
import { Directory, File, Paths } from "expo-file-system"
import { openDatabaseAsync } from "expo-sqlite"
import { NetworkError } from "./http"

/** Where the system file picker opens: SnapTube's database folder on the main storage. */
export const SNAPTUBE_HINT = "content://com.android.externalstorage.documents/document/primary%3Asnaptube%2Fdb"

/** File name (with extension) -> address of the thumbnail the downloader saved for that video. */
export type Thumbnails = Map<string, string>

const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1)

/**
 * SnapTube keeps a history of its downloads in a small database, with the video's thumbnail for each one.
 * The folder the person picked is read, its files copied into the app's own storage, and the history queried there.
 */
export async function readThumbnails(folder: string): Promise<Thumbnails> {
  if (Platform.OS === "web") return new Map()
  const work = new Directory(Paths.document, "snaptube-copy")
  work.create({ intermediates: true, idempotent: true })
  // The database and its write-ahead log are copied together: the newest downloads are only in the log
  const wanted = ["app_database.db", "app_database.db-wal", "app_database.db-shm"]
  let found = false
  for (const item of new Directory(folder).list()) {
    if (!(item instanceof File)) continue
    const name = fileName(decodeURIComponent(item.uri))
    const name2 = name.slice(name.lastIndexOf(":") + 1)
    if (!wanted.includes(name2)) continue
    const copy = new File(work, name2)
    if (copy.exists) copy.delete()
    item.copy(copy)
    found ||= name2 === wanted[0]
  }
  if (!found) throw new NetworkError("En esa carpeta no está la base de datos de SnapTube (app_database.db).")
  const db = await openDatabaseAsync("app_database.db", { useNewConnection: true }, work.uri.replace(/^file:\/\//, "").replace(/\/$/, ""))
  try {
    const rows = await db.getAllAsync<{ path: string | null; cover: string | null }>("SELECT path, cover FROM history WHERE cover IS NOT NULL AND cover != ''")
    const out: Thumbnails = new Map()
    for (const r of rows) if (r.path && r.cover) out.set(fileName(r.path), r.cover)
    return out
  } finally {
    await db.closeAsync()
  }
}

/** The largest thumbnail YouTube keeps for the video: widescreen and with no black bars, when it has one. */
function sizes(url: string) {
  const id = url.match(/\/vi\/([\w-]{11})\//)?.[1]
  return id ? [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, url] : [url]
}

/** Downloads a thumbnail into the app's storage. Returns where it was saved. */
export async function saveThumbnail(id: number, url: string): Promise<string> {
  if (Platform.OS === "web") return url
  const dir = new Directory(Paths.document, "covers")
  dir.create({ intermediates: true, idempotent: true })
  const file = new File(dir, `${id}-video.jpg`)
  for (const candidate of sizes(url)) {
    try {
      await File.downloadFileAsync(candidate, file, { idempotent: true })
      return file.uri
    } catch {
      try {
        file.delete()
      } catch {
        // nothing to remove
      }
    }
  }
  throw new NetworkError("No se pudo descargar la miniatura")
}

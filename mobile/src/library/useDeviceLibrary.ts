import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { AppState, Platform } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { addListener } from "expo-media-library"
import { classify, RawFile } from "./files"
import { UNKNOWN_ARTIST } from "./names"
import { isOpaqueName, readTags, Tags } from "./tags"
import { Access, checkAccess, FolderIssue, musicFolders, pickFolder, scanDevice, scanFiles, scanFolders } from "./scan"

const MIN_KEY = "retro-beats:min-seconds"
const FOLDERS_KEY = "retro-beats:folders"
// 2: also read for songs whose file name gives no artist; 3: the whole tag, since the artist can come after the cover
const TAGS_KEY = "retro-beats:tag-names:3"
/** Files shorter than this are treated as tones and system sounds unless the person includes them. */
export const DEFAULT_MIN_SECONDS = 15
/** Coming back to the app rescans, but not more often than this. */
const RESCAN_AFTER_MS = 5 * 60_000
/** Walking all the storage is slower than reading the index, so rescans reuse its result for this long. */
const DEEP_AFTER_MS = 10 * 60_000

/** Files the media index knows, plus the ones only the folder walk found (same file name = same song). */
function merge(indexed: RawFile[], walked: RawFile[]) {
  const names = new Set(indexed.map((f) => f.name.toLowerCase()))
  return indexed.concat(walked.filter((f) => !names.has(f.name.toLowerCase()) && names.add(f.name.toLowerCase())))
}

/** A rescan that finds the same files keeps the old list, so nothing downstream is rebuilt. */
function sameFiles(a: RawFile[], b: RawFile[]) {
  return a.length === b.length && a.every((f, i) => f.uri === b[i].uri && f.duration === b[i].duration)
}

export type ScanPhase = "idle" | "scanning" | "done" | "error"
/** library: the phone's media index, read with the audio permission. folders: folders the person chose, for builds that can't get the permission. */
export type ScanMode = "library" | "folders"

/**
 * The phone's music: permission or chosen folders, a single scan at a time, and the result split into
 * songs and skipped files. It scans by itself when the app opens, when the phone's media index changes
 * and when the app comes back to the foreground.
 */
export function useDeviceLibrary() {
  const [mode, setMode] = useState<ScanMode>("library")
  const [access, setAccess] = useState<Access>("denied")
  const [phase, setPhase] = useState<ScanPhase>("idle")
  const [files, setFiles] = useState<RawFile[]>([])
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [scannedAt, setScannedAt] = useState<number | null>(null)
  const [minSeconds, setMinSecondsState] = useState(DEFAULT_MIN_SECONDS)
  const [folders, setFolders] = useState<string[]>([])
  const [issues, setIssues] = useState<FolderIssue[]>([])
  const running = useRef(false)
  const lastScan = useRef(0)
  // What walking the whole storage found, kept between scans
  const walked = useRef({ at: 0, files: [] as RawFile[] })
  const [walkedFiles, setWalkedFiles] = useState<RawFile[]>([])
  const folderList = useMemo(() => musicFolders(walkedFiles), [walkedFiles])

  const { tracks: byName, skipped } = useMemo(() => classify(files, minSeconds), [files, minSeconds])

  // Files named only with numbers ("1_4945510745191220486.mp3") get their title from the tag inside the file, and
  // files whose name gives no artist get the artist saved there (downloaders write the channel or the singer)
  const [tagged, setTagged] = useState<Record<string, Tags>>({})
  const tagsLoaded = useRef(false)
  useEffect(() => {
    AsyncStorage.getItem(TAGS_KEY)
      .then((saved) => saved && setTagged((prev) => ({ ...JSON.parse(saved), ...prev })))
      .catch(() => {})
      .finally(() => (tagsLoaded.current = true))
  }, [])
  const readOpaque = useEffectEvent(async () => {
    const pending = byName.filter((t) => (isOpaqueName(t.title) || t.artist === UNKNOWN_ARTIST) && !(t.uri in tagged))
    if (!pending.length || !tagsLoaded.current) return
    const found: Record<string, Tags> = {}
    for (const t of pending) {
      const tags = await readTags(t.uri)
      // A file with no tag is remembered too, so it is not opened again on every scan
      found[t.uri] = tags ?? { title: "", artist: "" }
    }
    setTagged((prev) => {
      const next = { ...prev, ...found }
      AsyncStorage.setItem(TAGS_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  })
  useEffect(() => {
    readOpaque()
  }, [byName])
  const tracks = useMemo(
    () =>
      byName.map((t) => {
        const tag = tagged[t.uri]
        if (!tag?.title) return t
        const title = isOpaqueName(t.title) ? tag.title : t.title
        const artist = t.artist === UNKNOWN_ARTIST ? tag.artist : t.artist
        return title === t.title && artist === t.artist ? t : { ...t, title, artist }
      }),
    [byName, tagged],
  )

  const run = async (ask: boolean, chosen: string[]) => {
    if (running.current) return
    running.current = true
    setPhase("scanning")
    setProgress(0)
    setError(null)
    try {
      let useFolders = mode === "folders"
      if (!useFolders) {
        const a = await checkAccess(ask)
        setAccess(a)
        if (a === "unavailable") {
          // This build can't ask for the audio permission (Expo Go), so music comes from chosen folders
          setMode("folders")
          useFolders = true
        } else if (a !== "granted") return setPhase("idle")
      }
      if (useFolders) {
        if (!chosen.length) {
          setFiles([])
          return setPhase("idle")
        }
        const found = await scanFolders(chosen, setProgress)
        setFiles((prev) => (sameFiles(prev, found.files) ? prev : found.files))
        setIssues(found.issues)
      } else {
        const read = await scanFiles(setProgress)
        const first = merge(read, walked.current.files)
        setFiles((prev) => (sameFiles(prev, first) ? prev : first))
        setIssues([])
        // Then look through every folder for music the index doesn't list (it only costs time, so it runs after the first list is shown)
        if (ask || Date.now() - walked.current.at > DEEP_AFTER_MS) {
          const extra = await scanDevice((n) => setProgress(read.length + n)).catch(() => [])
          walked.current = { at: Date.now(), files: extra }
          setWalkedFiles(extra)
          const all = merge(read, extra)
          setFiles((prev) => (sameFiles(prev, all) ? prev : all))
        }
      }
      lastScan.current = Date.now()
      setScannedAt(lastScan.current)
      setPhase("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase("error")
    } finally {
      running.current = false
    }
  }

  /** ask: show the system permission dialog if needed. Without it, only scan when access already exists. */
  const scan = (ask = true) => run(ask, folders)

  /** Opens Android's folder picker and adds the choice to the list, then scans. */
  const addFolder = async () => {
    const uri = await pickFolder()
    if (!uri) return
    const next = folders.includes(uri) ? folders : [...folders, uri]
    setFolders(next)
    AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(next)).catch(() => {})
    await run(true, next)
  }

  const removeFolder = (uri: string) => {
    const next = folders.filter((f) => f !== uri)
    setFolders(next)
    AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(next)).catch(() => {})
    run(false, next)
  }

  const setMinSeconds = (seconds: number) => {
    setMinSecondsState(seconds)
    AsyncStorage.setItem(MIN_KEY, String(seconds)).catch(() => {})
  }

  const startup = useEffectEvent(() => {
    Promise.all([AsyncStorage.getItem(MIN_KEY), AsyncStorage.getItem(FOLDERS_KEY)])
      .then(([min, saved]) => {
        if (min !== null && Number.isFinite(Number(min))) setMinSecondsState(Number(min))
        const list: string[] = saved ? JSON.parse(saved) : []
        setFolders(list)
        return run(false, list)
      })
      .catch(() => {})
  })
  useEffect(() => startup(), [])

  // The index changes while the app is open (a download finishes, a file is deleted): rescan after things settle
  const rescan = useEffectEvent(() => run(false, folders))
  useEffect(() => {
    if (Platform.OS === "web" || mode !== "library" || access !== "granted") return
    let timer: ReturnType<typeof setTimeout> | undefined
    const sub = addListener(() => {
      clearTimeout(timer)
      timer = setTimeout(rescan, 5000)
    })
    return () => {
      clearTimeout(timer)
      sub.remove()
    }
  }, [mode, access])

  // Folders have no change notification, so look again when the person returns to the app
  const comeBack = useEffectEvent(() => {
    if (mode === "folders" && folders.length && Date.now() - lastScan.current > RESCAN_AFTER_MS) run(false, folders)
  })
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && comeBack())
    return () => sub.remove()
  }, [])

  return {
    mode,
    access,
    phase,
    progress,
    error,
    scannedAt,
    tracks,
    skipped,
    folders,
    issues,
    /** Folders found by walking the whole storage that hold music, with their song counts (library mode) */
    musicFolders: folderList,
    minSeconds,
    setMinSeconds,
    scan,
    addFolder,
    removeFolder,
    /** True when the list is made-up sample data (browser preview) */
    isSample: Platform.OS === "web",
  }
}

export type DeviceLibrary = ReturnType<typeof useDeviceLibrary>

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { AppState, Platform } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { addListener } from "expo-media-library"
import { classify, RawFile } from "./files"
import { Access, checkAccess, FolderIssue, pickFolder, scanFiles, scanFolders } from "./scan"

const MIN_KEY = "retro-beats:min-seconds"
const FOLDERS_KEY = "retro-beats:folders"
/** Files shorter than this are treated as tones and system sounds unless the person includes them. */
export const DEFAULT_MIN_SECONDS = 15
/** Coming back to the app rescans, but not more often than this. */
const RESCAN_AFTER_MS = 5 * 60_000

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

  const { tracks, skipped } = useMemo(() => classify(files, minSeconds), [files, minSeconds])

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
        setFiles((prev) => (sameFiles(prev, read) ? prev : read))
        setIssues([])
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

import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { addListening, finishedPeriods, ListeningLog, Period, periodLabel } from "./recap"
import type { PlayerApi } from "./usePlayer"

const LOG_KEY = "retro-beats:listening:v1"
const SEEN_KEY = "retro-beats:recap-seen"
const TICK_MS = 1000
const SAVE_EVERY_MS = 10_000
// A pause longer than this between two ticks was the phone asleep, not music: it is not counted as listening
const MAX_GAP_S = 15

/**
 * Counts the time each song is actually heard, by month. It reads the clock while the player is playing, so
 * seeking forward never adds time. Kept in a ref (the screen reads it when opened) so counting never redraws the app.
 */
export function useListening(player: PlayerApi) {
  const log = useRef<ListeningLog>({})
  const last = useRef<number | null>(null)
  const lastSave = useRef(0)
  const dirty = useRef(false)
  const [seen, setSeen] = useState<string[]>([])
  // Months and years that ended, known once what was saved has been read
  const [finished, setFinished] = useState<Period[]>([])

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(LOG_KEY), AsyncStorage.getItem(SEEN_KEY)])
      .then(([raw, seenRaw]) => {
        if (raw) {
          // Whatever was counted before this was read is added on top of what was saved
          const saved = JSON.parse(raw) as ListeningLog
          const fresh = log.current
          log.current = saved
          for (const [month, stats] of Object.entries(fresh)) {
            for (const [id, stat] of Object.entries(stats)) {
              const into = ((log.current[month] ??= {})[id] ??= { ...stat, s: 0 })
              into.s += stat.s
            }
          }
        }
        setSeen(seenRaw ? (JSON.parse(seenRaw) as string[]) : [])
        setFinished(finishedPeriods(log.current, new Date()))
      })
      .catch(() => {})
  }, [])

  const current = player.current
  const now = useRef(current)
  useEffect(() => {
    now.current = current
  })
  const save = useCallback(() => {
    if (!dirty.current) return
    dirty.current = false
    lastSave.current = Date.now()
    AsyncStorage.setItem(LOG_KEY, JSON.stringify(log.current)).catch(() => {})
  }, [])
  /** Adds the time since the last look to the song that is playing */
  const count = useCallback(() => {
    const t = Date.now()
    const gap = last.current === null ? 0 : (t - last.current) / 1000
    last.current = t
    const song = now.current
    if (!song || gap <= 0 || gap > MAX_GAP_S) return
    addListening(log.current, { id: song.id, title: song.title, artist: song.artist, album: song.album }, gap, new Date(t))
    dirty.current = true
    if (t - lastSave.current > SAVE_EVERY_MS) save()
  }, [save])
  useEffect(() => {
    if (!player.playing) return
    last.current = Date.now()
    const timer = setInterval(count, TICK_MS)
    return () => {
      count()
      clearInterval(timer)
      last.current = null
      save()
    }
  }, [player.playing, count, save])

  // Whatever is pending is written when the app goes to the background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        count()
        save()
      }
    })
    return () => sub.remove()
  }, [count, save])

  const read = useCallback(() => {
    count()
    return log.current
  }, [count])

  /** A month or year that just ended, with something recorded and not yet looked at. */
  const ready = finished.find((p) => !seen.includes(`${p.kind}:${p.key}`)) ?? null
  const markSeen = (period: Period) => {
    const next = [...seen, `${period.kind}:${period.key}`]
    setSeen(next)
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {})
  }

  return {
    /** The counted time right now, including the seconds of the song that is playing */
    read,
    ready,
    readyLabel: ready ? periodLabel(ready) : null,
    markSeen,
  }
}

export type Listening = ReturnType<typeof useListening>

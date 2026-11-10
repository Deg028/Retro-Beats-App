import { useEffect, useRef } from "react"
import { AppState } from "react-native"
// Only the enum: the package's entry point must not be loaded (see notifications.ts)
import { SchedulableTriggerInputTypes } from "expo-notifications/build/Notifications.types"
import { formatListening, Period, periodLabel, periodOf, shiftPeriod, summarize } from "./recap"
import { loadNotifications, LocalNotifications } from "./notifications"
import type { Listening } from "./useListening"

const CHANNEL = "recap"
const MONTH_ID = "recap-month"
const YEAR_ID = "recap-year"
// The morning after the period ends, so the notice does not wake anyone at midnight
const HOUR = 10

const setup = async (n: LocalNotifications) => {
  await n.setNotificationChannelAsync(CHANNEL, { name: "Resumen de escucha", description: "Aviso de tu resumen al terminar el mes y el año", importance: 4 })
  const { granted } = await n.requestPermissionsAsync()
  return granted
}

/**
 * Keeps two notices scheduled with the system, so they arrive with the app closed: the month's recap on the first
 * morning of the next month (with the artist heard most) and the year's on the first of January (its number one is
 * kept for the Rewind). They are rebuilt with the latest counts every time the app goes to the background. Tapping
 * one calls `onOpen` with its period.
 */
export function useRecapNotice(listening: Listening, onOpen: (period: Period) => void) {
  const ready = useRef<Promise<boolean> | null>(null)
  const open = useRef(onOpen)
  const counts = useRef(listening)
  useEffect(() => {
    open.current = onOpen
    counts.current = listening
  })

  useEffect(() => {
    const n = loadNotifications()
    if (!n) return
    const handle = (data: unknown) => {
      const period = (data as { recap?: Period } | undefined)?.recap
      if (period?.kind && period.key) open.current(period)
    }
    // The app was opened by tapping the notice
    const last = n.getLastNotificationResponse()
    if (last) {
      handle(last.notification.request.content.data)
      n.clearLastNotificationResponse()
    }
    const sub = n.addNotificationResponseReceivedListener((r) => handle(r.notification.request.content.data))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    const n = loadNotifications()
    if (!n) return
    const schedule = async () => {
      const log = counts.current.read()
      const now = new Date()
      const month = periodOf("month", now)
      const year = periodOf("year", now)
      const monthSum = summarize(log, month)
      const yearSum = summarize(log, year)
      if (monthSum.seconds <= 0 && yearSum.seconds <= 0) return
      ready.current ??= setup(n).catch(() => false)
      if (!(await ready.current)) return
      const nextMonth = shiftPeriod(month, 1)
      const [y, m] = nextMonth.key.split("-").map(Number)
      await n.cancelScheduledNotificationAsync(MONTH_ID).catch(() => {})
      if (monthSum.seconds > 0) {
        const artist = monthSum.artists[0]
        await n.scheduleNotificationAsync({
          identifier: MONTH_ID,
          content: {
            title: `Tu resumen de ${periodLabel(month)} está listo`,
            body: `Escuchaste ${formatListening(monthSum.seconds)} de música.${artist ? ` Tu artista más escuchado: ${artist.name}.` : ""} Toca para verlo.`,
            data: { recap: month },
          },
          trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(y, m - 1, 1, HOUR), channelId: CHANNEL },
        })
      }
      await n.cancelScheduledNotificationAsync(YEAR_ID).catch(() => {})
      if (yearSum.seconds > 0) {
        await n.scheduleNotificationAsync({
          identifier: YEAR_ID,
          content: {
            title: `✨ Tu Rewind ${year.key} ya está aquí`,
            body: `${formatListening(yearSum.seconds)} de música este año. ¿Cuál fue tu canción número 1? Toca para descubrirla.`,
            data: { recap: year },
          },
          trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(Number(year.key) + 1, 0, 1, HOUR), channelId: CHANNEL },
        })
      }
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") schedule().catch(() => {})
    })
    return () => sub.remove()
  }, [])
}

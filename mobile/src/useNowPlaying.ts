import { useEffect, useEffectEvent, useRef } from "react"
import { Platform } from "react-native"
import { isRunningInExpoGo } from "expo"
import type { AndroidImportance, AndroidNotificationPriority } from "expo-notifications"
import { LocalNotifications, loadNotifications } from "./notifications"
import { CATEGORY_LABEL, Theme } from "./themes/themes"
import { PlayerApi } from "./usePlayer"

const ID = "now-playing"
const CHANNEL = "playback"
// Enum values written out so the package entry point is never loaded (see notifications.ts)
const IMPORTANCE_LOW = 4 as AndroidImportance
const PRIORITY_LOW = "low" as AndroidNotificationPriority

async function setup(n: LocalNotifications) {
  // Shown in the notification shade only: no banner or sound while the app is open
  n.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  })
  await n.setNotificationChannelAsync(CHANNEL, {
    name: "Reproducción",
    description: "Canción actual y tema de Retro Beats",
    importance: IMPORTANCE_LOW,
    sound: null,
    vibrationPattern: null,
    showBadge: false,
  })
  const actions = (toggle: string) => [
    { identifier: "prev", buttonTitle: "⏮ Anterior", options: { opensAppToForeground: false } },
    { identifier: "toggle", buttonTitle: toggle, options: { opensAppToForeground: false } },
    { identifier: "next", buttonTitle: "Siguiente ⏭", options: { opensAppToForeground: false } },
  ]
  await n.setNotificationCategoryAsync("playing", actions("⏸ Pausar"))
  await n.setNotificationCategoryAsync("paused", actions("▶ Reproducir"))
  const { granted } = await n.requestPermissionsAsync()
  return granted
}

/**
 * "Now playing" notification showing the song and the chosen theme. In a native build the media
 * notification from expo-audio carries the same text; in Expo Go, which can't run that service,
 * a regular notification with play/pause and skip buttons takes its place when available.
 */
export function useNowPlaying(player: PlayerApi, theme: Theme) {
  const ready = useRef<Promise<boolean> | null>(null)
  const { current, playing } = player
  const title = current?.title
  const artist = current?.artist
  const artwork = current?.cover
  const subtitle = `Tema ${theme.name} · ${CATEGORY_LABEL[theme.category]}`
  const local = isRunningInExpoGo() && Platform.OS === "android"

  const onAction = useEffectEvent((action: string) => {
    if (action === "prev") player.step(-1)
    else if (action === "next") player.step(1)
    else if (action === "toggle") player.togglePlaying()
  })
  const setNowPlaying = useEffectEvent(player.setNowPlaying)

  useEffect(() => {
    const n = local ? loadNotifications() : null
    if (!n) return
    const sub = n.addNotificationResponseReceivedListener((r) => onAction(r.actionIdentifier))
    return () => sub.remove()
  }, [local])

  useEffect(() => {
    if (!title) return
    if (!isRunningInExpoGo()) {
      setNowPlaying({ title: `${theme.emoji} ${title}`, artist, albumTitle: `Retro Beats · ${subtitle}`, artworkUrl: artwork }, theme.c.accent)
      return
    }
    const n = local ? loadNotifications() : null
    if (!n) return
    // Ask for permission the first time a song plays, not at launch
    ready.current ??= setup(n).catch(() => false)
    ready.current
      .then((granted) => {
        if (!granted) return
        return n.scheduleNotificationAsync({
          identifier: ID,
          content: {
            title: `${theme.emoji} ${title}`,
            body: `${artist} · ${playing ? "Sonando" : "En pausa"}`,
            subtitle,
            color: theme.c.accent,
            categoryIdentifier: playing ? "playing" : "paused",
            // Can't be swiped away while music plays; dismissible once paused
            sticky: playing,
            autoDismiss: false,
            sound: false,
            priority: PRIORITY_LOW,
          },
          trigger: { channelId: CHANNEL },
        })
      })
      .catch(() => {})
  }, [local, title, artist, artwork, playing, subtitle, theme.emoji, theme.c.accent])
}

import { requireOptionalNativeModule } from "expo"
import type * as N from "expo-notifications"

/*
 * expo-notifications' entry point loads its push-topic module at import time, and Expo Go on Android
 * doesn't ship that module, so importing the package crashes the app before it starts. This loads
 * only the local-notification pieces the now-playing notification uses, and only after checking
 * that their native modules exist; otherwise the notification is skipped and the app keeps running.
 */
export type LocalNotifications = {
  setNotificationHandler: typeof N.setNotificationHandler
  setNotificationChannelAsync: typeof N.setNotificationChannelAsync
  setNotificationCategoryAsync: typeof N.setNotificationCategoryAsync
  requestPermissionsAsync: typeof N.requestPermissionsAsync
  scheduleNotificationAsync: typeof N.scheduleNotificationAsync
  addNotificationResponseReceivedListener: typeof N.addNotificationResponseReceivedListener
}

const NATIVE = [
  "ExpoNotificationsHandlerModule",
  "ExpoNotificationChannelManager",
  "ExpoNotificationCategoriesModule",
  "ExpoNotificationPermissionsModule",
  "ExpoNotificationScheduler",
  "ExpoNotificationsEmitter",
]

let cached: LocalNotifications | null | undefined

export function loadNotifications(): LocalNotifications | null {
  if (cached !== undefined) return cached
  if (NATIVE.some((name) => !requireOptionalNativeModule(name))) {
    cached = null
    return cached
  }
  /* eslint-disable @typescript-eslint/no-require-imports */
  cached = {
    ...require("expo-notifications/build/NotificationsHandler"),
    ...require("expo-notifications/build/setNotificationChannelAsync"),
    ...require("expo-notifications/build/setNotificationCategoryAsync"),
    ...require("expo-notifications/build/NotificationPermissions"),
    ...require("expo-notifications/build/scheduleNotificationAsync"),
    ...require("expo-notifications/build/NotificationsEmitter"),
  } as LocalNotifications
  /* eslint-enable @typescript-eslint/no-require-imports */
  return cached
}

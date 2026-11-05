import { ReactNode } from "react"
import { isRunningInExpoGo } from "expo"
import type * as S from "expo-share-intent"

/*
 * Text that another app shares to Retro Beats (the "Compartir" menu of a lyrics page, a notes app, a browser).
 * expo-share-intent has native code that Expo Go doesn't ship, so there it is left out and the app runs without
 * this feature; in the installed app it is always on.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lib: typeof S | null = isRunningInExpoGo() ? null : require("expo-share-intent")

export type SharedText = {
  /** What was shared, or null when nothing is waiting */
  text: string | null
  /** Forget it (after it was used or dismissed) */
  clear: () => void
}

export function SharedTextProvider({ children }: { children: ReactNode }) {
  return lib ? <lib.ShareIntentProvider>{children}</lib.ShareIntentProvider> : <>{children}</>
}

const NONE: SharedText = { text: null, clear: () => {} }
const useNone = (): SharedText => NONE
const useReal = (): SharedText => {
  const { hasShareIntent, shareIntent, resetShareIntent } = lib!.useShareIntentContext()
  const text = hasShareIntent ? (shareIntent.text ?? shareIntent.webUrl ?? null) : null
  return { text, clear: resetShareIntent }
}
export const useSharedText = lib ? useReal : useNone

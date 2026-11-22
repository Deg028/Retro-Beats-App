import { useEffect, useRef } from "react"
import { AppState } from "react-native"
import { requireOptionalNativeModule } from "expo"
import { THEMES } from "./themes/themes"

type ThemeIconModule = { setIcon: (id: string, all: string[]) => boolean }
// Missing in Expo Go and in builds older than the one that added it
const native = requireOptionalNativeModule<ThemeIconModule>("ThemeIcon")
const ALL = THEMES.map((t) => t.id)

/** Switches the launcher icon now. Android may close the app when the icon it was opened from is switched off. */
export function applyThemeIcon(themeId: string) {
  try {
    native?.setIcon(themeId, ALL)
  } catch {
    // the icon just stays as it was
  }
}

/**
 * Keeps the app's launcher icon in the style of the chosen theme. The switch is made when the app goes to the background,
 * so the launcher never changes the icon under the screen the person is looking at, and only while nothing plays:
 * switching off the icon the app was opened from makes Android close the app (DONT_KILL_APP notwithstanding), and the
 * music with it. With music playing the switch waits for the next time the app is left with the music stopped.
 */
export function useThemeIcon(themeId: string, playing: boolean) {
  const playingRef = useRef(playing)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(() => {
    if (!native) return
    const sub = AppState.addEventListener("change", (state) => state === "background" && !playingRef.current && applyThemeIcon(themeId))
    return () => sub.remove()
  }, [themeId])
}
